# Validation — MediaConvert 1.2.0

## Completed

- 5 Node tests passed: folder recursion, Unicode paths, duplicate selections,
  collision-safe output creation, original-file preservation, request validation,
  cold/later Explorer launch queues (mock Electron host), Store placeholder
  rejection, release-check requirements, and escaped manifest generation.
- Headless Chromium tests used the real desktop HTML/CSS/renderer and a test HTTP
  bridge to the real filesystem service. A WAV with a Hindi filename converted
  to MP3 and saved beside its input. The Show in folder button rendered.
- A generated one-second video/audio clip converted to all 13 output formats:
  MP4, MOV, MKV, WebM, AVI, GIF, MP3, WAV, FLAC, AAC, M4A, OGG, OPUS. Every command
  returned success and produced readable output bytes. This is a smoke check,
  not validation of every codec, source type, duration, or large-file behavior.
- Browser interaction checks passed for keyboard activation of file selection,
  About credits, Privacy dialog, theme switching, and no horizontal overflow at
  1280, 920, and 640 CSS pixels. Preview PNGs were captured from the interface.
- Fixed numeric FFmpeg CLI arguments by converting each argument to a string
  before execution, preventing video encoding calls from failing at the bridge.
- Windows x64 app packaged with creator/version information and branded icons.
- Native NSIS setup compiled with embedded app files and an uninstaller. The
  final archive was checked for integrity and expected contents.
- Store manifest template is well-formed XML. Placeholder account fields are
  intentionally rejected; no fake upload-ready MSIX is generated.

## Still required on Windows before public release

- Run the actual setup, application, preload IPC, native file/folder dialogs,
  drag/drop from Explorer, right-click actions, install/uninstall, and upgrade.
- Install and test the final signed/test-signed MSIX after adding the exact
  Partner Center identity. Run MakeAppx validation and Windows App Certification
  Kit, then keyboard/screen-reader testing. No WACK pass is claimed here.
- Recapture listing screenshots from the installed Windows release. The included
  screenshots are browser-rendered previews, not Windows certification evidence.
- Complete the public privacy URL, source/license obligations, age-rating
  questionnaire, pricing, markets, and Partner Center listing review.

Earlier Linux Electron headless launch attempts crashed in this environment.
Browser checks do not replace the Windows application checks above. The native
NSIS compilation avoids the Wine failure seen with the earlier installer build.
