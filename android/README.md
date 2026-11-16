# MediaConvert Android — test APK

Created by **Vinayak Benake**. Support: **Benakevinayak@gmail.com**.

Android 10+ with an up-to-date Android System WebView/Chrome is required. The
same peach/coral interface and bundled single-thread FFmpeg WebAssembly core
are used. The APK contains no architecture-specific native FFmpeg library and
runs conversion locally. The app requests no broad storage permission and no
Internet permission; all UI/engine resources are intercepted from bundled assets.

## Files and folders

- **Choose files** opens Android's document picker. After selecting media, choose
  an output folder. Android does not grant arbitrary sibling-write access just
  because a file was selected.
- **Choose a folder** grants access to a folder tree and imports supported media
  in its subfolders. Outputs are created beside their source documents.
- Outputs use `name-converted.ext`, then numbered names. Originals are preserved.
- Android restricts certain locations, including storage roots, Android/data,
  Android/obb, and the Downloads root on recent Android versions. Create/select
  a subfolder such as `Documents/MediaConvert` instead.
- **Open result** hands the saved document to an installed media app.
- Desktop right-click menus do not apply on Android.

Keep the app in the foreground while converting. The screen stays awake during
conversion. Large files can exceed WebView memory limits. This first Android
version limits inputs to 100 MB, outputs to 256 MB, and a folder import to 1000
media files and 32 directory levels. Begin testing with short clips. Interrupted
writes are removed where possible; force-stopping the process can leave a partial
output. Document providers may have additional limits or rename created files.

Android manages document grants; selected URI references are held in app memory.
Color preferences/cache can be stored locally. A selected cloud document provider
may transfer/sync files under its own policy even though MediaConvert itself has
no upload service or Internet permission.

## Build and validation

With Node.js 22+, Java 17, Gradle 8.11.1, and Android SDK 35 installed:

```
npm ci
node scripts/prepare-android.cjs
gradle -p android assembleDebug
gradle -p android connectedDebugAndroidTest
```

The GitHub **Build Android APK** workflow builds a debug-signed installable APK
and runs a WebView audio-conversion smoke test in an Android 15 emulator before
uploading it. This does not replace physical-device tests of pickers, permissions,
folder writes, collision handling, codecs, lifecycle, and low-memory conditions.

This is a test APK, not a Google Play production release. A debug signing key may
change between builds; uninstall a previous test APK if Android rejects an update
for a signing mismatch. A production release needs a stable private signing key,
Play metadata/privacy/data-safety review, and dependency/source-license review.
Keep signing keys private and outside the repository. FFmpeg license/source
obligations are described in ../THIRD-PARTY-NOTICES.md.
