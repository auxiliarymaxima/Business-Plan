# Guyana Business Plan Builder v4 — Offline AI

This version upgrades the original WebView-based Android project into an offline-first AI business-plan app.

## What changed

- **On-device Qwen**: the app can download `Qwen3-1.7B-Q4_K_M.gguf` once and run it locally.
- **No AI API key**: generation uses an Android llama.cpp runtime, not OpenAI or a paid search API.
- **Curated Guyana RAG pack**: 30 local knowledge chunks cover planning, financing, GRA/VAT/TIN references, NIS, SBB and sector playbooks.
- **Deterministic financial planning**: startup allocation and 12-month projections remain app calculations rather than AI arithmetic.
- **Anti-hallucination rules**: missing current facts are labelled `VERIFY` or `ESTIMATE`.
- **Fallback mode**: the app still creates a useful offline template plan when Qwen is not downloaded.
- **Model Manager**: Settings shows download progress, Wi-Fi-only option, deletion and SHA-256 verification.
- **GitHub Actions**: `.github/workflows/android.yml` builds a debug APK.

## Local AI model

Default model:
- `ggml-org/Qwen3-1.7B-GGUF`
- file: `Qwen3-1.7B-Q4_K_M.gguf`
- approx. 1.28 GB
- Apache-2.0 model license
- expected SHA-256: `d2387ca2dbfee2ffabce7120d3770dadca0b293052bc2f0e138fdc940d9bc7b5`

The model is **not included in the APK**. The user downloads it from inside the app and it is stored in the app's private external-files directory.

## Runtime

The project uses the Maven Central AAR:

`dev.ffmpegkit-maintained:llama-android:0.1.1`

This wraps llama.cpp for on-device GGUF inference. The free AAR supports arm64-v8a and Android API 24+.

## Build

The repository includes a GitHub Actions workflow. You can also build locally with Java 17 and Gradle:

```bash
gradle assembleDebug
```

APK output:

```text
app/build/outputs/apk/debug/app-debug.apk
```

## Important limitations

- The first Qwen generation can be slow because the model must be loaded from storage.
- The app targets arm64-v8a phones.
- Regulatory information is a dated planning reference, not legal/tax advice. Refresh the local knowledge pack periodically.
- The payment screen still uses the prototype unlock. MMG should be connected later using a verified merchant/backend flow rather than storing merchant secrets in the APK.

## Local knowledge files

```text
app/src/main/assets/knowledge/
├── knowledge.json
├── formulas.json
└── sources.json
```

Reviewed: 2026-09-28
