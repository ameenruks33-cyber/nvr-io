# NVR.io Mobile

App display name: **NVR.io**  
Logo: `assets/logo.jpg` / `assets/icon.png`

## Secret gallery (private — not device Photos)

Open **Gallery** in the app / PWA:

1. Take a photo or pick an image  
2. It uploads straight to the NVR.io server  
3. It does **not** save into the phone Photos / Gallery app  
4. Admins verify the same items on the **website** (Gallery → Verify / Reject)

## Fastest path

1. https://nvr-io-web.vercel.app/app → Install NVR.io  
2. Sign in → **Gallery** tab  

## Mobile vs website

| Action | Mobile app | Website |
|--------|------------|---------|
| Secret gallery upload | Yes | Yes |
| Verify / reject gallery | Admin only | Admin only |
| Change username / password | No | Settings |
| Clear old database | No | Users (admin) |

## Flutter shell

```bash
cd apps/mobile
flutter pub get
flutter run
```
