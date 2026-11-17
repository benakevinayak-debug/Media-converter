# MediaConvert 1.3.0 desktop validation

Completed locally:

- Five Node tests pass for file/folder imports, collision-safe saves, source
  preservation, launch queues, trusted IPC requests, and Store metadata handling.
- The real HTML/CSS/renderer was exercised in headless Chromium with a local
  test bridge to the actual filesystem service. Two WAV inputs converted to
  different per-file outputs (MP3 and FLAC), beside their originals. The FLAC
  signature was checked. Existing inputs were preserved.
- Stop-after-current-file finished the first file and left the second queued.
  Resuming completed that file. The open-folder option invoked the native bridge
  once for the final saved output.
- Search, selection controls, queue filters, current-queue history, tool presets,
  themes, creator credits, privacy, and all 13 format options were exercised.
- A generated short video/audio sample successfully produced output in all 13
  formats. This is a smoke test, not a claim about every source codec or file size.
- Layouts at 1280, 960, and 640 CSS pixels had no horizontal overflow. New dark,
  light, queue, and credits screenshots were captured from the actual interface.

GitHub's Windows workflow builds the 1.3 installer from this source and runs the
Node suite. Browser tests use a test bridge; installation, actual Explorer
interactions, native dialogs, screen readers, and physical-PC conversion testing
remain required. No Windows App Certification Kit or Microsoft Store approval is
claimed. Source/license review and reserved Store identity remain outstanding.

The standalone HTML is a design preview with real local file selection, search,
format controls, and dialogs. Conversion is explicitly disabled in that preview.
