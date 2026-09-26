# NVR.io Mobile

App display name: **NVR.io**  
Logo: `assets/logo.jpg` / `assets/icon.png`

## Fastest path (recommended)

1. Open **https://nvr-io-web.vercel.app/app** on your phone  
2. Tap **Install NVR.io** (or Safari → Share → Add to Home Screen)  
3. Sign in — same account as the website  

## Mobile vs website

| Action | Mobile app | Website (computer) |
|--------|------------|--------------------|
| Change username / password | Not available | Settings |
| Clear old database | Not available | Users (admin panel) |
| People / receipts / records | Yes | Yes |

## Flutter native shell

```bash
cd apps/mobile
flutter pub get
flutter run
```

## Rules

- Install only with user permission  
- No silent / hidden install  
- All records stay on the NVR.io server
