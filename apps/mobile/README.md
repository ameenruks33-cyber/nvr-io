# NVR.io Mobile (Phase 2)

App display name: **NVR.io**

## Install (with user permission)

- Open the website `/app` and tap **Install NVR.io** (browser asks for permission), or
- Install from Google Play / App Store when published

No silent install. No auto-hide. No dial-pad stealth activation.

## Access flow

```text
Open NVR.io (normal icon)
  → Login / PIN / optional biometric
  → App (all data saved on server / website)
```

## Data storage

Sensitive and borrower records are stored on the **NVR.io backend** (same database as the website). The phone does not keep a permanent local customer/identity database; photos go to private server storage, not the device gallery.

## Screens (Flutter — when SDK available)

Login · Dashboard · Registration · Repayments · Settings
