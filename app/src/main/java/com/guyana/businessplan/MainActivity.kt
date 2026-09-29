package com.guyana.businessplan

import android.app.Activity
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import dev.ffmpegkit.llama.Llama
import dev.ffmpegkit.llama.LlamaConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import kotlin.math.roundToInt

class MainActivity : Activity() {
    private lateinit var web: WebView
    private val worker = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private data class ModelSpec(
        val key: String,
        val fileName: String,
        val url: String,
        val sha256: String,
        val minimumBytes: Long,
        val contextSize: Int,
        val maxTokens: Int
    )

    companion object {
        private const val PREFS = "gbpb_components_v5"
        private const val KNOWLEDGE_ASSET = "knowledge/knowledge.json"

        // Lightweight default component: ~429 MB.
        private val SIMPLE_MODEL = ModelSpec(
            key = "simple",
            fileName = "core-planning-component.gguf",
            url = "https://huggingface.co/ggml-org/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_0.gguf?download=true",
            sha256 = "da2572f16c06133561ce56accaa822216f2391ef4d37fba427801cd6736417d4",
            minimumBytes = 350_000_000L,
            contextSize = 3072,
            maxTokens = 1150
        )

        // Optional detailed component: ~1.28 GB.
        private val DETAILED_MODEL = ModelSpec(
            key = "detailed",
            fileName = "detailed-planning-component.gguf",
            url = "https://huggingface.co/ggml-org/Qwen3-1.7B-GGUF/resolve/daeb8e2d528a760970442092f6bf1e55c3b659eb/Qwen3-1.7B-Q4_K_M.gguf?download=true",
            sha256 = "d2387ca2dbfee2ffabce7120d3770dadca0b293052bc2f0e138fdc940d9bc7b5",
            minimumBytes = 900_000_000L,
            contextSize = 4096,
            maxTokens = 1900
        )

        private const val SYSTEM_PROMPT = """
You are the private offline planning engine inside Guyana Business Plan Builder.
Write practical, lender-friendly business-plan content for a Guyanese small business.
Use ONLY the user information, deterministic financial figures, and curated knowledge supplied in the prompt.
Never invent a current tax rate, licence, law, grant, market statistic, supplier price, rent, interest rate, or competitor fact.
When a current fact is absent, label it VERIFY. When a number is a planning assumption, label it ESTIMATE where appropriate.
Keep the writing concrete and commercially useful. Do not expose hidden chain-of-thought. Return only the requested plan.
"""
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ensureKnowledgePack()

        web = WebView(this)
        setContentView(web)

        val settings: WebSettings = web.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = false

        web.addJavascriptInterface(Bridge(), "Android")
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                if (uri.scheme == "file") return false
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    true
                } catch (_: Exception) {
                    true
                }
            }
        }
        web.loadUrl("file:///android_asset/index.html")
    }

    private fun prefs() = getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun modelSpec(mode: String): ModelSpec =
        if (mode.equals("detailed", ignoreCase = true)) DETAILED_MODEL else SIMPLE_MODEL

    private fun componentDir(): File {
        val dir = getExternalFilesDir("components") ?: File(filesDir, "components")
        if (!dir.exists()) dir.mkdirs()
        return dir
    }

    private fun modelFile(spec: ModelSpec): File = File(componentDir(), spec.fileName)

    private fun knowledgeFile(): File {
        val dir = File(filesDir, "planning-resources")
        if (!dir.exists()) dir.mkdirs()
        return File(dir, "knowledge.json")
    }

    private fun sha256(bytes: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
        return digest.joinToString("") { "%02x".format(it) }
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().buffered().use { input ->
            val buffer = ByteArray(1024 * 1024)
            while (true) {
                val n = input.read(buffer)
                if (n <= 0) break
                digest.update(buffer, 0, n)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    /**
     * The knowledge pack ships inside the APK. Every launch compares the packaged copy
     * with the installed working copy. Updating the app with a newer pack automatically
     * refreshes the working copy without a network request.
     */
    private fun ensureKnowledgePack() {
        try {
            val assetBytes = assets.open(KNOWLEDGE_ASSET).use { it.readBytes() }
            val packagedHash = sha256(assetBytes)
            val local = knowledgeFile()
            val localHash = if (local.exists()) runCatching { sha256(local) }.getOrNull() else null
            if (localHash != packagedHash) {
                local.outputStream().use { it.write(assetBytes) }
            }
            prefs().edit().putString("knowledge_hash", packagedHash).apply()
        } catch (_: Exception) {
            // The web layer has a small built-in fallback so the UI can still open.
        }
    }

    private fun isWifiConnected(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
    }

    private fun callJs(function: String, vararg args: String) {
        val quoted = args.joinToString(",") { JSONObject.quote(it) }
        runOnUiThread { web.evaluateJavascript("window.$function($quoted);", null) }
    }

    private fun downloadIdKey(spec: ModelSpec) = "download_id_${spec.key}"
    private fun verifiedKey(spec: ModelSpec) = "verified_${spec.key}"

    private fun readModelStatus(spec: ModelSpec): JSONObject {
        val out = JSONObject()
        val file = modelFile(spec)
        val verified = prefs().getBoolean(verifiedKey(spec), false)
        val id = prefs().getLong(downloadIdKey(spec), -1L)

        out.put("mode", spec.key)
        out.put("bytes", if (file.exists()) file.length() else 0L)
        out.put("verified", verified)

        if (file.exists() && file.length() >= spec.minimumBytes && verified) {
            out.put("stage", "ready")
            out.put("installed", true)
            out.put("percent", 100)
            return out
        }

        if (file.exists() && file.length() >= spec.minimumBytes && !verified) {
            out.put("stage", "needs_verification")
            out.put("installed", true)
            out.put("percent", 99)
            return out
        }

        if (id > 0L) {
            val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val cursor = dm.query(DownloadManager.Query().setFilterById(id))
            cursor.use {
                if (it != null && it.moveToFirst()) {
                    val status = it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                    val downloaded = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
                    val total = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
                    val percent = if (total > 0L) ((downloaded * 100.0) / total).roundToInt() else 0
                    out.put("bytes", downloaded)
                    out.put("totalBytes", total)
                    out.put("percent", percent.coerceIn(0, 99))
                    out.put("installed", false)
                    when (status) {
                        DownloadManager.STATUS_RUNNING -> out.put("stage", "downloading")
                        DownloadManager.STATUS_PAUSED -> out.put("stage", "paused")
                        DownloadManager.STATUS_PENDING -> out.put("stage", "pending")
                        DownloadManager.STATUS_SUCCESSFUL -> out.put("stage", "needs_verification")
                        DownloadManager.STATUS_FAILED -> {
                            out.put("stage", "failed")
                            out.put("reason", it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)))
                        }
                        else -> out.put("stage", "missing")
                    }
                    return out
                }
            }
        }

        out.put("stage", "missing")
        out.put("installed", false)
        out.put("percent", 0)
        return out
    }

    private fun readKnowledgeStatus(): JSONObject {
        val out = JSONObject()
        return try {
            ensureKnowledgePack()
            val file = knowledgeFile()
            val json = JSONObject(file.readText())
            val chunks = json.optJSONArray("chunks")
            out.put("ready", file.exists() && (chunks?.length() ?: 0) > 0)
            out.put("version", json.optString("version", "unknown"))
            out.put("updated", json.optString("updated", "unknown"))
            out.put("items", chunks?.length() ?: 0)
            out
        } catch (_: Exception) {
            out.put("ready", false)
            out.put("version", "unavailable")
            out.put("items", 0)
            out
        }
    }

    inner class Bridge {
        @JavascriptInterface
        fun toast(message: String) {
            runOnUiThread { Toast.makeText(this@MainActivity, message, Toast.LENGTH_SHORT).show() }
        }

        @JavascriptInterface
        fun printPlan() {
            runOnUiThread {
                val pm = getSystemService(Context.PRINT_SERVICE) as PrintManager
                pm.print(
                    "Guyana Business Plan",
                    web.createPrintDocumentAdapter("Guyana Business Plan"),
                    PrintAttributes.Builder().build()
                )
            }
        }

        @JavascriptInterface
        fun getKnowledgeJson(): String {
            return try {
                ensureKnowledgePack()
                knowledgeFile().readText()
            } catch (_: Exception) {
                try {
                    assets.open(KNOWLEDGE_ASSET).bufferedReader().use { it.readText() }
                } catch (_: Exception) {
                    """{"version":"unavailable","chunks":[]}"""
                }
            }
        }

        @JavascriptInterface
        fun getComponentStatus(): String {
            val knowledge = readKnowledgeStatus()
            val simple = readModelStatus(SIMPLE_MODEL)
            val detailed = readModelStatus(DETAILED_MODEL)
            return JSONObject()
                .put("wifi", isWifiConnected())
                .put("knowledge", knowledge)
                .put("simple", simple)
                .put("detailed", detailed)
                .put(
                    "coreReady",
                    knowledge.optBoolean("ready", false) && simple.optString("stage") == "ready"
                )
                .toString()
        }

        @JavascriptInterface
        fun startComponentDownload(mode: String): String {
            val spec = modelSpec(mode)
            val file = modelFile(spec)
            val existing = readModelStatus(spec)
            if (existing.optString("stage") == "ready") {
                return JSONObject().put("ok", true).put("alreadyReady", true).toString()
            }

            if (!isWifiConnected()) {
                return JSONObject()
                    .put("ok", false)
                    .put("needsWifi", true)
                    .put("message", "Wi-Fi is required to download components.")
                    .toString()
            }

            return try {
                val previousId = prefs().getLong(downloadIdKey(spec), -1L)
                if (previousId > 0L) {
                    (getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).remove(previousId)
                }
                if (file.exists()) file.delete()
                prefs().edit().putBoolean(verifiedKey(spec), false).apply()

                val request = DownloadManager.Request(Uri.parse(spec.url))
                    .setTitle("Guyana Business Plan components")
                    .setDescription("Downloading required components")
                    .setMimeType("application/octet-stream")
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI)
                    .setAllowedOverMetered(false)
                    .setAllowedOverRoaming(false)
                    .setDestinationInExternalFilesDir(this@MainActivity, "components", spec.fileName)

                val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                val id = dm.enqueue(request)
                prefs().edit().putLong(downloadIdKey(spec), id).apply()
                JSONObject().put("ok", true).put("id", id).toString()
            } catch (e: Exception) {
                JSONObject().put("ok", false).put("message", e.message ?: "Unable to download components.").toString()
            }
        }

        @JavascriptInterface
        fun verifyComponent(mode: String, requestId: String) {
            val spec = modelSpec(mode)
            val file = modelFile(spec)
            worker.launch {
                try {
                    if (!file.exists() || file.length() < spec.minimumBytes) {
                        throw IllegalStateException("Component file is incomplete.")
                    }
                    val hash = sha256(file)
                    val ok = hash.equals(spec.sha256, ignoreCase = true)
                    prefs().edit().putBoolean(verifiedKey(spec), ok).apply()
                    callJs("onComponentVerified", requestId, spec.key, if (ok) "true" else "false")
                } catch (e: Exception) {
                    callJs("onComponentVerificationError", requestId, spec.key, e.message ?: "Verification failed.")
                }
            }
        }

        @JavascriptInterface
        fun openWifiSettings() {
            runOnUiThread {
                try {
                    startActivity(Intent(Settings.ACTION_WIFI_SETTINGS))
                } catch (_: Exception) {
                    startActivity(Intent(Settings.ACTION_WIRELESS_SETTINGS))
                }
            }
        }

        @JavascriptInterface
        fun generateBusinessPlan(requestId: String, prompt: String, mode: String) {
            val spec = modelSpec(mode)
            val file = modelFile(spec)
            val status = readModelStatus(spec)
            if (status.optString("stage") != "ready" || !file.exists()) {
                callJs("onAiError", requestId, "Required components are not ready.")
                return
            }

            worker.launch {
                try {
                    callJs("onAiNativeStage", requestId, "loading")
                    val threads = (Runtime.getRuntime().availableProcessors() - 1).coerceIn(2, 6)
                    val model = Llama.loadModel(
                        modelPath = file.absolutePath,
                        config = LlamaConfig(contextSize = spec.contextSize, threads = threads)
                    )
                    try {
                        callJs("onAiNativeStage", requestId, "writing")
                        val result = Llama.complete(
                            model,
                            prompt = prompt,
                            systemPrompt = SYSTEM_PROMPT.trimIndent(),
                            maxTokens = spec.maxTokens
                        )
                        callJs("onAiNativeStage", requestId, "finalizing")
                        callJs("onAiResult", requestId, result.text, result.tokensPerSecond.toString())
                    } finally {
                        Llama.releaseModel(model)
                    }
                } catch (e: Throwable) {
                    callJs("onAiError", requestId, e.message ?: e.javaClass.simpleName)
                }
            }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        worker.cancel()
        web.removeJavascriptInterface("Android")
        web.destroy()
        super.onDestroy()
    }
}
