# NVR.io Mobile

App display name: **NVR.io**  
Logo: `assets/logo.jpg` / `assets/icon.png`

## Fastest path (recommended)

1. Open **https://nvr-io-web.vercel.app/app** on your phone  
2. Tap **Install NVR.io** (or Safari → Share → Add to Home Screen)  
3. Sign in — same account as the website  
4. Change name / email / password in **Settings**

The installed PWA uses the same logo, blue theme, and mobile bottom navigation.

## Flutter native shell

This folder wraps the live website in a WebView with the NVR.io splash logo.

```bash
cd apps/mobile
flutter pub get
flutter run
# optional custom URL:
flutter run --dart-define=NVR_APP_URL=https://nvr-io-web.vercel.app/login
```

Create Android/iOS projects once if missing:

```bash
flutter create . --project-name nvr_io --org io.nvr
```

Then set the launcher icon to `assets/icon.png` (e.g. with `flutter_launcher_icons`).

## Rules

- Install only with user permission  
- No silent / hidden install  
- All records stay on the NVR.io server
