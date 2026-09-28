# Guyana Business Plan Builder — Android prototype

A local-first Android prototype based on the supplied reference screens.

## Included
- Guyana-themed mobile home screen and business categories
- Guided business idea form
- Local business-plan generation from the user's inputs
- Executive summary, opportunity, marketing, operations, funding, 12-month projection, SWOT and implementation sections
- Saved plans stored on-device using WebView local storage
- Business tips, payment/unlock prototype and settings
- Android print framework support for Print / Save PDF
- No external web libraries or runtime dependencies inside the app
- GitHub Actions workflow that builds a debug APK

## Build in GitHub
1. Create a GitHub repository and upload this project with the same folder structure.
2. Open the **Actions** tab.
3. Run **Build Android APK** (or push to `main`).
4. Download the `guyana-business-plan-debug-apk` artifact.
5. Extract and install `app-debug.apk` on Android.

## Local Android Studio build
Open the project root in Android Studio, let Gradle sync, then use **Build > Build APK(s)**.

## Production work still needed
The included GYD $500 unlock is intentionally a demo-only local unlock. Before publishing, connect a verified payment provider and server-side receipt validation. Review all financial language, privacy policy, branding, Play Store requirements, and any business-registration/tax guidance you add later.

This prototype is an independent planning tool and does not claim Government of Guyana affiliation.
