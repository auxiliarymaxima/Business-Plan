# Version 5 changes

- Seamless first-launch component check.
- Automatic lightweight component download on Wi-Fi only.
- No mobile-data path for model downloads.
- Continue-to-home option when Wi-Fi is unavailable.
- Re-check components whenever plan creation needs them.
- Generic customer-facing component labels; implementation/model names removed from Settings and plan UI.
- Packaged planning-resource check on every launch, with automatic refresh when the app ships a newer knowledge pack.
- Expanded offline knowledge pack to 52 retrieval-ready items including 12 sector playbooks.
- Simple Plan is default and uses the lightweight local component.
- Detailed Plan uses the larger optional component and downloads it on demand over Wi-Fi.
- Multi-stage business-plan generation progress UI.
- Generated plan narrative can be edited and saved locally.
- Version bumped to 5.0 / versionCode 5.
- GitHub Actions builds the debug APK and can additionally build signed release APK/AAB artifacts when signing secrets are configured.
