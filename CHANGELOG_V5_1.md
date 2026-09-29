# Version 5.1 — component download flow fix

- Fixes repeated verification/check loop while a model is still downloading.
- DownloadManager is now authoritative until a transfer reports SUCCESSFUL.
- Each completed component gets one SHA-256 verification pass.
- Startup checks once, downloads only the lightweight core component, verifies once, then enters the app.
- Optional detailed component is never downloaded during startup.
- Detailed component is offered only when Detailed Plan is selected or from Settings.
- Component errors are shown as a single stable setup screen instead of repeated toast pop-ups.
- Knowledge pack is still checked on every launch and refreshed from the packaged app version when changed.
