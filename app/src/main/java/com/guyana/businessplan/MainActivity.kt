package com.guyana.businessplan

import android.app.Activity
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Environment
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

    companion object {
        private const val PREFS = "gbpb_ai"
        private const val KEY_DOWNLOAD_ID = "qwen_download_id"
        private const val KEY_VERIFIED = "qwen_verified"
        private const val MODEL_NAME = "Qwen3-1.7B-Q4_K_M.gguf"
        private const val MODEL_URL =
            "https://huggingface.co/ggml-org/Qwen3-1.7B-GGUF/resolve/daeb8e2d528a760970442092f6bf1e55c3b659eb/Qwen3-1.7B-Q4_K_M.gguf?download=true"
        private const val MODEL_SHA256 =
            "d2387ca2dbfee2ffabce7120d3770dadca0b293052bc2f0e138fdc940d9bc7b5"

        private const val SYSTEM_PROMPT = """
You are the offline AI engine inside Guyana Business Plan Builder.
Write practical, lender-friendly business-plan content for a Guyanese small business.
Use ONLY the user information, deterministic financial figures, and curated knowledge supplied in the prompt.
Never invent a current tax rate, licence, law, grant, market statistic, supplier price, rent, interest rate, or competitor fact.
When a figure is not supplied, label it ESTIMATE or say VERIFY.
Do not expose chain-of-thought or hidden reasoning. Return the requested business plan directly.
"""
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
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

    private fun modelFile(): File {
        val dir = getExternalFilesDir("models") ?: File(filesDir, "models")
        if (!dir.exists()) dir.mkdirs()
        return File(dir, MODEL_NAME)
    }

    private fun prefs() = getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun callJs(function: String, vararg args: String) {
        val quoted = args.joinToString(",") { JSONObject.quote(it) }
        runOnUiThread {
            web.evaluateJavascript("window.$function($quoted);", null)
        }
    }

    inner class Bridge {
        @JavascriptInterface
        fun toast(message: String) {
            runOnUiThread {
                Toast.makeText(this@MainActivity, message, Toast.LENGTH_SHORT).show()
            }
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
                assets.open("knowledge/knowledge.json").bufferedReader().use { it.readText() }
            } catch (e: Exception) {
                """{"version":"unavailable","chunks":[]}"""
            }
        }

        @JavascriptInterface
        fun getModelStatus(): String {
            val out = JSONObject()
            val file = modelFile()
            val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val id = prefs().getLong(KEY_DOWNLOAD_ID, -1L)

            out.put("model", "Qwen3 1.7B Q4_K_M")
            out.put("fileName", MODEL_NAME)
            out.put("path", file.absolutePath)
            out.put("bytes", if (file.exists()) file.length() else 0L)
            out.put("verified", prefs().getBoolean(KEY_VERIFIED, false))

            if (file.exists() && file.length() > 900_000_000L) {
                out.put("stage", "ready")
                out.put("installed", true)
                out.put("percent", 100)
                return out.toString()
            }

            if (id > 0L) {
                val cursor = dm.query(DownloadManager.Query().setFilterById(id))
                cursor.use {
                    if (it != null && it.moveToFirst()) {
                        val status = it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                        val downloaded = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
                        val total = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
                        val percent = if (total > 0) ((downloaded * 100.0) / total).roundToInt() else 0
                        out.put("bytes", downloaded)
                        out.put("totalBytes", total)
                        out.put("percent", percent.coerceIn(0, 100))
                        when (status) {
                            DownloadManager.STATUS_RUNNING -> out.put("stage", "downloading")
                            DownloadManager.STATUS_PAUSED -> out.put("stage", "paused")
                            DownloadManager.STATUS_PENDING -> out.put("stage", "pending")
                            DownloadManager.STATUS_SUCCESSFUL -> out.put("stage", "finishing")
                            DownloadManager.STATUS_FAILED -> {
                                out.put("stage", "failed")
                                out.put(
                                    "reason",
                                    it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
                                )
                            }
                            else -> out.put("stage", "not_downloaded")
                        }
                        out.put("installed", false)
                        return out.toString()
                    }
                }
            }

            out.put("stage", "not_downloaded")
            out.put("installed", false)
            out.put("percent", 0)
            return out.toString()
        }

        @JavascriptInterface
        fun startModelDownload(wifiOnly: Boolean): String {
            val file = modelFile()
            if (file.exists() && file.length() > 900_000_000L) {
                return """{"ok":true,"message":"Model is already downloaded."}"""
            }

            try {
                if (file.exists()) file.delete()
                prefs().edit().putBoolean(KEY_VERIFIED, false).apply()

                val request = DownloadManager.Request(Uri.parse(MODEL_URL))
                    .setTitle("Guyana Business Plan AI")
                    .setDescription("Downloading Qwen3 1.7B local AI model")
                    .setMimeType("application/octet-stream")
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setAllowedOverMetered(!wifiOnly)
                    .setAllowedOverRoaming(false)
                    .setDestinationInExternalFilesDir(
                        this@MainActivity,
                        "models",
                        MODEL_NAME
                    )

                if (wifiOnly) {
                    request.setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI)
                }

                val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                val id = dm.enqueue(request)
                prefs().edit().putLong(KEY_DOWNLOAD_ID, id).apply()
                return """{"ok":true,"message":"Download started.","id":$id}"""
            } catch (e: Exception) {
                return JSONObject()
                    .put("ok", false)
                    .put("message", e.message ?: "Unable to start download.")
                    .toString()
            }
        }

        @JavascriptInterface
        fun cancelModelDownload(): String {
            val id = prefs().getLong(KEY_DOWNLOAD_ID, -1L)
            if (id > 0L) {
                val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                dm.remove(id)
            }
            prefs().edit().remove(KEY_DOWNLOAD_ID).putBoolean(KEY_VERIFIED, false).apply()
            modelFile().delete()
            return """{"ok":true}"""
        }

        @JavascriptInterface
        fun deleteModel(): String {
            return try {
                val id = prefs().getLong(KEY_DOWNLOAD_ID, -1L)
                if (id > 0L) {
                    (getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).remove(id)
                }
                val deleted = !modelFile().exists() || modelFile().delete()
                prefs().edit().clear().apply()
                JSONObject().put("ok", deleted).toString()
            } catch (e: Exception) {
                JSONObject().put("ok", false).put("message", e.message).toString()
            }
        }

        @JavascriptInterface
        fun verifyModel(requestId: String) {
            val file = modelFile()
            worker.launch {
                try {
                    if (!file.exists()) throw IllegalStateException("Model file is not downloaded.")
                    val digest = MessageDigest.getInstance("SHA-256")
                    file.inputStream().buffered().use { input ->
                        val buffer = ByteArray(1024 * 1024)
                        while (true) {
                            val n = input.read(buffer)
                            if (n <= 0) break
                            digest.update(buffer, 0, n)
                        }
                    }
                    val hash = digest.digest().joinToString("") { "%02x".format(it) }
                    val ok = hash.equals(MODEL_SHA256, ignoreCase = true)
                    prefs().edit().putBoolean(KEY_VERIFIED, ok).apply()
                    callJs("onModelVerified", requestId, if (ok) "true" else "false", hash)
                } catch (e: Exception) {
                    callJs("onModelVerificationError", requestId, e.message ?: "Verification failed.")
                }
            }
        }

        @JavascriptInterface
        fun generateBusinessPlan(requestId: String, prompt: String) {
            val file = modelFile()
            if (!file.exists() || file.length() < 900_000_000L) {
                callJs("onAiError", requestId, "Local AI model is not downloaded.")
                return
            }

            worker.launch {
                try {
                    val threads = (Runtime.getRuntime().availableProcessors() - 1).coerceIn(2, 6)
                    val model = Llama.loadModel(
                        modelPath = file.absolutePath,
                        config = LlamaConfig(contextSize = 4096, threads = threads)
                    )
                    try {
                        val result = Llama.complete(
                            model,
                            prompt = prompt,
                            systemPrompt = SYSTEM_PROMPT.trimIndent(),
                            maxTokens = 1500
                        )
                        callJs(
                            "onAiResult",
                            requestId,
                            result.text,
                            result.tokensPerSecond.toString()
                        )
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
