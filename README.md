# Guyana Business Plan Builder v5

Android business-plan builder with private on-device generation and an updateable offline Guyana planning knowledge pack.

## v5 experience

- Every launch performs a quiet component check.
- The lightweight planning component is downloaded automatically **only when Wi-Fi is available**.
- If Wi-Fi is unavailable, the user can continue to the home screen and finish setup later.
- Starting a plan re-checks required components and resumes setup when Wi-Fi is available.
- No mobile-data download path is exposed for the large model files.
- The Settings screen hides model/provider details and only exposes generic **Download Components** and **Check Components** controls.
- The packaged knowledge pack is checked every launch and refreshed automatically when a newer app build contains a changed pack.
- **Simple Plan** is the default and uses the lightweight local component.
- **Detailed Plan** is optional and downloads a larger local component on first use, over Wi-Fi only.
- Plan creation displays staged progress: preparing idea, reading resources, building finances, loading planner, writing and finalizing.
- Generated narrative is editable and can be saved locally before printing/export.

## Local planning components

Developer details are intentionally not shown in the customer UI:

- Simple mode: Qwen3-0.6B Q4_0 GGUF, ~429 MB.
- Detailed mode: Qwen3-1.7B Q4_K_M GGUF, ~1.28 GB.
- Runtime: `dev.ffmpegkit-maintained:llama-android:0.1.1` / llama.cpp.
- Both components are downloaded from Hugging Face and SHA-256 verified on-device.

## Knowledge pack

`app/src/main/assets/knowledge/knowledge.json` currently contains 52 retrieval-ready items compiled from the Guyana Business Plan Knowledge Pack and its 12 sector playbooks. The app copies this asset to app-private working storage and compares it on every launch. When the asset changes in a future version, the installed working copy is replaced automatically.

To expand it in later versions, update `knowledge.json` while preserving this shape:

```json
{
  "version": "5.x-date",
  "updated": "YYYY-MM-DD",
  "chunks": [
    {
      "id": "unique.id",
      "title": "Title",
      "tags": ["sector", "topic"],
      "priority": 3,
      "status": "GUIDANCE or CONFIRMED",
      "reviewed": "YYYY-MM-DD",
      "text": "Retrieval-ready content",
      "source": "Source label",
      "url": "https://..."
    }
  ]
}
```

## GitHub Actions

Pushes to `main` build a debug APK automatically.

For signed release APK/AAB artifacts, configure these GitHub Actions secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

The workflow will then create both:

- `app-release.apk`
- `app-release.aab`

Keep the same production signing key for all future Play Store updates.

## Important

This is an independent planning tool and is not an official Government of Guyana service. Time-sensitive regulatory, tax, licensing and market information in the offline pack must be periodically reviewed and updated.
