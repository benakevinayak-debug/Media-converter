# QuickConvert Media 1.5.0

Created by **Vinayak Benake** · Support: **Benakevinayak@gmail.com**

A private Windows video/audio converter with a dark purple workspace with a sidebar and live conversion queue, light and
dark themes, folder importing, a conversion queue, and local output saving.
The FFmpeg WebAssembly engine is bundled, so conversion works offline.

## Install the Windows app

Extract the final ZIP and run `MediaConvert Setup 1.5.0.exe`. The setup is an
unsigned, standalone x64 Windows installer. It installs for the current user,
creates shortcuts, adds Explorer file/folder menu entries, and supplies an
uninstaller. Close MediaConvert before installing or uninstalling. Requires
Windows 10 version 2004 (build 19041) or later.

Drag files or folders into the app, choose a format, and click Convert. Subfolders
are included. Outputs use `name.ext` beside the original, preserving the original basename and changing only its extension, with numbered
names when needed. Originals and previous outputs are preserved. Read-only source
folders produce a save error; move media to a writable folder and retry.

The standalone edition's **Convert with MediaConvert** menu opens selected media
in the app. Windows 11 may show it under **Show more options**. The Store edition
uses declared file associations; see the Store guide for its integration limits.

## Development and builds

Install Node.js 22 or later, then:

```
npm ci
npm test
npm start
```

Package the Windows x64 app with `npm run pack:win`. For an unsigned build with
version/icon resources preserved, pass `-- --config.win.signExecutable=false`.
On Windows, `npm run dist:win -- --x64` produces the electron-builder NSIS setup.

The standalone setup delivered in this kit is built from `desktop/setup.nsi`:
install NSIS 3, set `NSIS_PATH` to `makensis.exe` when needed, then run
`npm run setup:compile` after packaging. This method also supports native NSIS
on Linux without Wine. It removes only shipped files during uninstall, leaving
unrelated files in the installation folder intact.

The app and setup are unsigned. Configure your own signing credentials before a
signed standalone release. Microsoft signs accepted MSIX Store distributions.

## Microsoft Store

The submission kit is in `store/`. Read `store/SUBMISSION-GUIDE.md` first. It
contains account identity placeholders, listing copy, a privacy policy draft,
manifest generation, Windows SDK packaging, and release checks. Run
`npm run store:build` on Windows after configuring the reserved identity and
public privacy-policy URL. There is no generated Store MSIX in this kit because
those account details are not yet available. No Store publication is performed.

Use the included Windows Actions workflows to build the standalone installer or
Store MSIX after uploading the source to your own repository.

## Credits and licenses

Credits appear in the app header, footer, About dialog, version information, and
installer. Application source is MIT-licensed; FFmpeg and other dependencies keep
their own licenses. See `THIRD-PARTY-NOTICES.md` and `licenses/`. Before publishing,
complete the corresponding-source/license review described in the Store guide.

## Limitations and verification

The WebAssembly engine has memory limits; very large files can fail. Quality
presets do not change lossless WAV/FLAC or fixed GIF settings, and copied streams
retain their original quality. See `VALIDATION.md` for the checks completed and
Windows tests still required.

`index (1).html` and the existing work tracker in `index.html` are preserved from
the original repository and are not used as the desktop entry point.

## Desktop 1.3 workspace

Search and filter the queue, select individual files, override output formats per
row, use quick Tools presets, or stop a batch after its current file finishes.
Auto quality uses the Balanced preset. Originals are always kept. History shows
completed entries in the current queue and clears with that queue. The optional
Open folder setting reveals the last saved result after a batch finishes.

Generate the self-contained HTML design preview with
`node scripts/create-browser-preview.cjs`. It supports the interface and local
file selection; conversion is explicitly disabled in the browser preview.

### Windows 1.3.2

The Settings page saves the default output format, quality, theme, Smart stream copy, and open-folder preference locally. Save applies these choices to pending files and future sessions. Restore defaults resets them. Conversion controls in the main workspace can override these defaults for the current session. Outputs keep their source basename; a number is added only if the destination already exists, including same-format conversions. Originals are never overwritten.

### Windows 1.4.0 — Tools workspace

Open **Tools** in the sidebar to use SVG Optimizer, GIF Optimizer, HTML Converter, WebP / AVIF Converter, APNG Converter, Lottie Converter, Sprite Sheet Generator, PNG Sequence Converter, Image Metadata Cleaner, and Batch Asset Optimizer. The three original media presets remain below the tool cards. Each tool has native file selection, export options and per-file results with Show in folder. All processing happens locally. The HTML preview shows the interface; native conversion requires the installed Windows application.

- SVG cleanup preserves IDs, geometry, animation data and styles. GIF optimization retains frames, timing and looping. Optimizers keep original bytes when re-encoding would increase size.
- AVIF exports still images. WebP supports GIF/WebP animations. Animated PNG inputs use APNG Converter so they are not silently flattened.
- HTML export supports self-contained pages with inline CSS and data-embedded images/fonts. JavaScript and external requests are disabled. PNG captures the selected viewport; PDF prints the document; video captures CSS animations for a chosen duration.
- Lottie export supports keyframe-based SVG animations with embedded images, up to 20 seconds. Expressions, effects and external assets/fonts are rejected. Output supports GIF, MP4 and numbered PNG frames.
- Sprite sheets accept one GIF, APNG or WebP, or multiple equal-sized PNGs. PNG sequences accept up to 300 equal-sized frames, ordered naturally by filename.
- Metadata cleaning re-encodes pixels without optional metadata; it can change lossy image detail and does not guarantee smaller files.
- Batch optimization processes up to 500 selected files or files in a folder tree. Each output stays beside its source, preserving the basename and using a numeric suffix for collisions. A per-file failure does not cancel other files.
- Rendering supports up to 1920×1080, 30 fps and 20 seconds, with additional total-pixel/frame limits. Temporary frames are removed after processing; an interrupted process may leave temporary files in the system temp folder.

Run `npm test` for native image/animation, output naming and launch tests. On a Windows desktop, `npm run test:render` verifies real HTML → PNG/PDF/MP4/WebM and Lottie → GIF/MP4/PNG exports and requires a completed seven-export report. CI runs both before packaging the NSIS EXE.

## Image Compression — Windows 1.5

Open **Image Compression**, directly below **Convert**. Drop files/folders or use Add Files/Add Folder. Smart compression starts automatically by default; disable Compress on add to queue a batch and choose Lossless before starting. Results show thumbnails, actual processing stages, before/after sizes and savings, with total savings in the results header and footer. Save writes a copy through the native file dialog. Save All as ZIP includes successful results only and gives duplicate names numeric suffixes. Original files and existing exports are never overwritten. Failed images stay in the list and do not stop the next file.

Format, stored dimensions, orientation, original color profiles, alpha and animation are preservation requirements. A mismatched candidate fails explicitly. If a valid candidate is not smaller, the result is the exact original bytes and is labeled **No size savings**. This local workflow uses TinyPNG as a workflow reference; it does not call Tinify or upload images.

| Format | Smart | Lossless |
| --- | --- | --- |
| PNG/APNG | Recompresses filtered image streams without quantization or resizing; retains every ancillary chunk, ICC/EXIF, frame control, loop and delay | Same preservation path |
| JPEG | Quality 82, with exact ICC and orientation validation; CMYK uses the lossless path | libjpeg-turbo entropy optimization, coefficient/pixel data retained |
| WebP | Quality 82 with alpha quality 100; checks original ICC, dimensions, orientation and all frame delays/loops/alpha | Removes unused container padding without touching encoded image frames |
| AVIF | Re-encodes only compatible 8-bit opaque stills without protected color/orientation properties; otherwise lossless container path | Removes trailing `free` boxes only, leaving all item offsets, metadata, coded pixels and animation streams intact |
| JPEG XL | Lossless Brotli optimization of uncompressed EXIF/XML metadata boxes; preserves the complete codestream, color information and animation | Same preservation path |

AVIF/JXL container optimization may produce no reduction in already compact files; these paths do not claim to recompress their pixel codestreams. JXL thumbnails use a bundled decoder. Animated AVIF thumbnails use the bundled FFmpeg.

Limits: 500 images, 50 MB per file, 1 GB selected data, 40 megapixels of total decoded frame pixels per image, and 300 animation frames. Symlinks are skipped; source changes after selection are reported. Compressed results live in the system temp folder until the batch/app is cleared; interrupted applications can leave temporary files. Nothing is uploaded.

### Verification

`npm test` checks Smart/Lossless across five formats with P3 ICC, orientation 6, alpha gradients, APNG/WebP/JXL/AVIF animations, unchanged PNG/APNG scanline streams/decoded frames, exact no-savings bytes, unchanged sources, duplicate ZIP names, saved bytes, edited sources and failure continuation. The Windows workflow builds the pinned modern JPEG engine before these tests. Local Linux JPEG development uses the development-only jpegtran binary.

After packaging, `scripts/test-packaged-compression.cjs` launches **the actual packaged Windows EXE**, which runs nine image cases in both modes, validates preservation, exercises real Save/ZIP backend operations, checks the sidebar order and displayed result rows/thumbnails, and creates `image-compression-checks.json` plus a screenshot. The report records the actual platform, package status and app version. It explicitly distinguishes these checks from native file-dialog clicks and physical installation/uninstallation, which are not automated.

The self-contained HTML preview shows the page and controls; compression and native save actions require the Windows app.
