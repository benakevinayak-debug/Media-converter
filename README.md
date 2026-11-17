# MediaConvert 1.3.0

Created by **Vinayak Benake** · Support: **Benakevinayak@gmail.com**

A private Windows video/audio converter with a dark purple workspace with a sidebar and live conversion queue, light and
dark themes, folder importing, a conversion queue, and local output saving.
The FFmpeg WebAssembly engine is bundled, so conversion works offline.

## Install the Windows app

Extract the final ZIP and run `MediaConvert-Setup-1.3.0-x64.exe`. The setup is an
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
