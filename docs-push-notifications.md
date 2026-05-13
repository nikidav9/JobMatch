# Android push notifications troubleshooting

This app uses Expo push notifications. The Android build must have two Firebase/Expo pieces in sync:

1. `google-services.json` in the repository. This file registers the Android app with FCM and must match `expo.android.package` (`com.nikidav23.onspaceapp`).
2. The FCM V1 service account key uploaded to EAS credentials for the same Android application identifier and Firebase project.

If the device log shows:

```text
Fetching the token failed: java.util.concurrent.ExecutionException: java.io.IOException: FIS_AUTH_ERROR
```

then the app failed before Expo can save an Expo push token. It is usually a Firebase Installations / Google API key authentication problem, not a Supabase insert problem.

## Checklist for `FIS_AUTH_ERROR`

1. In Firebase Console, open the Firebase project used by `google-services.json` and confirm the Android app package is `com.nikidav23.onspaceapp`.
2. Download a fresh `google-services.json` for that exact Android app and replace the repository file if it changed.
3. In Google Cloud Console > APIs & Services > Credentials, open the API key from `google-services.json` (`client[0].api_key[0].current_key`). If the key has API restrictions, include at least:
   - Firebase Installations API
   - FCM Registration API
   - Firebase Cloud Messaging API
4. If the API key has Android app restrictions, add the SHA-1/SHA-256 certificate fingerprints for the build you installed:
   - EAS development/preview/production signing key, or
   - Google Play app signing key if the app is installed from Play.
5. In Expo EAS credentials, upload the FCM V1 service account JSON for the same Firebase project. Do not commit that service account JSON.
6. Rebuild and reinstall the Android app after changing `google-services.json`, API key restrictions, signing keys, or EAS credentials. OTA updates cannot change native Firebase configuration.

The runtime now logs `[push] Registration config` before token registration and prints a `[push] Registration hint` when native token registration fails.
