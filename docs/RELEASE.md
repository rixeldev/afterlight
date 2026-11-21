# Release guide

AFTERLIGHT ships as an Android App Bundle to Play Console and, eventually, an iOS archive built on
macOS. This document covers identity, versioning, signing and the exact commands used.

> **Secrets policy.** `keystore.properties` and every `*.jks`/`*.keystore` file are gitignored.
> The upload keystore lives outside this repository. Never paste passwords into an issue, a log,
> a screenshot or a commit. `.github/workflows/ci.yml` fails if a secret file is tracked.

---

## App identity

| Field | Value |
| --- | --- |
| Name | AFTERLIGHT |
| Slug | `afterlight` |
| Android package | `dev.rixel.afterlight` |
| iOS bundle id | `dev.rixel.afterlight` |
| Orientation | Landscape |
| Current version | `0.1.0` (versionCode `1`, buildNumber `1`) |
| Min SDK | Expo SDK 58 defaults (Android 7+) |

Identity lives in `app.json`. Changing the package name after the first Play upload is not
possible, so treat it as permanent.

---

## Versioning

Play Console rejects an AAB whose `versionCode` was already used. For every upload:

1. Bump `expo.android.versionCode` (integer, monotonic).
2. Bump `expo.version` (user-facing) and `expo.ios.buildNumber` when relevant.
3. Rebuild. Do not reuse build directories between uploads.

```bash
node -e "const f='app.json';const j=require('./'+f);j.expo.android.versionCode++;console.log(j.expo.android.versionCode)"
```

---

## Android AAB with the local upload keystore

```bash
# 1. Generate the native project (android/ is gitignored, regenerate freely).
npx expo prebuild --platform android --clean

# 2. Inject the Gradle loader that reads ../keystore.properties at build time.
node tools/android/configure-signing.mjs

# 3. Build the bundle.
cd android
./gradlew bundleRelease

# 4. Verify and upload.
ls -lh app/build/outputs/bundle/release/app-release.aab
# Play Console → Release → Production/Internal testing → Upload AAB
```

The script never copies secrets into `build.gradle`. It adds:

```gradle
def afterlightKeystore = new Properties()
def afterlightKeystoreFile = rootProject.file("../keystore.properties")
if (afterlightKeystoreFile.exists()) {
    afterlightKeystoreFile.withInputStream { afterlightKeystore.load(it) }
}
def afterlightReleaseSigning = !afterlightKeystore.isEmpty()
```

and selects `signingConfigs.release` only when the properties file exists. A debug-only machine
still builds `assembleDebug` normally.

Verify the signature before uploading:

```bash
$ANDROID_HOME/build-tools/36.0.0/apksigner verify --print-certs \
  android/app/build/outputs/bundle/release/app-release.aab
```

(An AAB is signed as a JAR; `apksigner` may warn about the bundle format. `jarsigner -verify` also
works.)

### If you prefer EAS

Upload the same keystore to EAS once (`eas credentials`), then:

```bash
npx eas-cli build --platform android --profile production
```

EAS never reads `keystore.properties`; the credentials live in Expo's encrypted store.

---

## Play Console checklist

- [ ] App name, short description, full description, screenshots (phone + 7" + 10" tablet)
- [ ] Feature graphic 1024×500 and 512×512 icon
- [ ] Privacy policy URL (the game collects nothing; state that plainly)
- [ ] Data safety form: **no data collected, no data shared**
- [ ] Content rating questionnaire (fantasy violence, no user-generated content)
- [ ] Target audience and ads declaration: no ads
- [ ] Internal testing track first; install from the Play link on a physical device
- [ ] Verify offline first launch, save/continue, background/foreground, and no network permission
- [ ] Only then promote to closed/production

---

## iOS

iOS requires macOS with Xcode 16+.

```bash
npx expo prebuild --platform ios --clean
npx expo run:ios --configuration Release --device
# or:
npx eas-cli build --platform ios --profile production
```

Before archiving:

- Set the Apple Developer team and provisioning profile in Xcode/EAS.
- Confirm landscape-only orientations in `Info.plist` (set in `app.json`).
- The app uses `expo-gl` (OpenGL ES); iOS supports it, but verify on a physical iPhone.
- Run the device checklist in `docs/TESTING.md`.

---

## Store assets and screenshots

Store screenshots are not committed yet. Capture them on a physical device in landscape at
1080×2400 or higher, with the HUD visible: menu, homestead at dusk, crafting panel, map and the
chapter finale. Do not include developer overlays or the FPS counter.
