# Parkside mobile app

React Native app for iOS and Android, built with Expo. It uses the existing FastAPI backend for user records, live availability, reservations, 14-day spot estimates, and the Gemini availability assistant.

## Requirements

- Node.js 22.13 or newer (required by Expo SDK 57 and React Native 0.86).
- Android Studio for a local Android emulator, or Expo Go on a device.
- A Mac with Xcode for local iOS simulator/device builds, or Expo's cloud build service.

## Configure the backend URL

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_BASE_URL`:

- Android emulator: `http://10.0.2.2:8000/api/v1`.
- iOS simulator: `http://127.0.0.1:8000/api/v1`.
- Physical Android/iPhone: `http://<your-computer-LAN-IP>:8000/api/v1` (both devices must be on the same network).

Run the backend from `backend` and bind it to all interfaces so a phone can reach it:

```powershell
uv run uvicorn parking_api.main:app --reload --host 0.0.0.0 --port 8000
```

Use HTTPS for a deployed backend. Do not put the Gemini API key in the mobile app; it stays in the backend `.env`.

## Run the app

```powershell
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go. Press `a` to open an installed Android emulator. For a native Android build, run `npx expo run:android`. Local iOS builds require macOS; use `eas build --platform ios` for a cloud build.

## Location and booking

The app asks for foreground location only when the user books a spot. The backend independently checks the submitted coordinates against its configured geofence. Coordinates are sent for that booking and are not saved. The browser/native location check can be spoofed; a site QR code or network-based check is needed for stronger proof of presence.
