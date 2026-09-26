# NVR.io Mobile

App display name: **NVR.io**  
Logo: `assets/logo.jpg` / `assets/icon.png`

## Cloud gallery (separate from device Photos)

Open **Gallery** in the app / PWA:

1. Tap **Open in-app camera** (live camera inside NVR.io — not the phone gallery)  
2. Tap **Save Cloud** — uploads straight to NVR.io server storage
3. Never opens device Photos / Files, and never saves into phone storage  
4. Admins verify the same cloud items on the website (Verify / Reject)

## Fastest path

1. https://nvr-io-web.vercel.app/app → Install NVR.io  
2. Sign in → **Gallery** tab  

## Mobile vs website

| Action | Mobile app | Website |
|--------|------------|---------|
| Cloud gallery capture | Yes (in-app camera) | Yes (in-app camera) |
| Device Photos / Files picker | No | No |
| Verify / reject gallery | Admin only | Admin only |
| Change username / password | No | Settings |
| Clear old database | No | Users (admin) |

## Flutter shell

```bash
cd apps/mobile
flutter pub get
flutter run
```
