# Third-party notices

MediaConvert is created by Vinayak Benake. The application source is MIT-licensed.
This does not replace the separate licenses of its dependencies.

## Electron and Chromium

Electron 42.11.18: https://github.com/electron/electron
The Windows application includes `LICENSE.electron.txt` and
`LICENSES.chromium.html` from the Electron distribution. These notices cover
Electron, Chromium, Node.js, and their bundled components; keep them with the app.

## ffmpeg.wasm JavaScript interface

`@ffmpeg/ffmpeg` 0.12.10 and `@ffmpeg/util` 0.12.1 use the MIT license.
Source: https://github.com/ffmpegwasm/ffmpeg.wasm
The MIT license text is included in `licenses/ffmpeg-wasm-MIT.txt`.
The current desktop interface uses the FFmpeg wrapper; util remains a pinned
project dependency from the original browser app.

## FFmpeg WebAssembly core

`@ffmpeg/core` 0.12.6 is included unmodified. Its npm package metadata does not
supersede the licenses of the compiled FFmpeg and codec libraries. The upstream
core build enables GPL components, including x264 and x265. GPL-2.0-or-later and
LGPL-2.1-or-later texts are included in `licenses/`.

Upstream source/build recipe for the matching core release:
https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.10
https://github.com/ffmpegwasm/ffmpeg.wasm/blob/v0.12.10/Dockerfile
https://github.com/FFmpeg/FFmpeg/tree/n5.1.4
https://ffmpeg.org/legal.html
https://ffmpegwasm.netlify.app/docs/faq/

The matching Dockerfile is copied into `licenses/ffmpeg-wasm-v0.12.10-Dockerfile`
and identifies the upstream dependency sources, versions, build options, and
Emscripten toolchain. The build includes FFmpeg, x264, x265, libvpx, LAME, Ogg,
Theora, Opus, Vorbis, zlib, libwebp, FreeType, FriBidi, HarfBuzz, libass, and zimg.

Before public distribution, make the complete corresponding sources and build
instructions for the exact distributed GPL/LGPL binaries available in a manner
that meets their licenses. Source links and a Dockerfile alone are not a complete
corresponding-source bundle, especially for dependencies pinned to moving
branches. Review applicable codec patent obligations for your distribution.
`store/identity.json` keeps the source/license release check false until reviewed.

Original contributors retain all copyright and license rights. No endorsement by
Microsoft, Electron, or FFmpeg is implied.

## Asset tools (Windows 1.4)

Sharp 0.35.5 is Apache-2.0 licensed and includes libvips and image codec libraries with their own licenses. SVGO 4.1.0 and Lottie Web 5.13.0 are MIT licensed. Native FFmpeg is provided by ffmpeg-static 5.3.0 (GPL-3.0-or-later); the actual FFmpeg version/build options depend on the platform binary. The Windows build records these and copies the upstream platform notices into `licenses/asset-tools/`.

Sources and build recipes:
- https://github.com/lovell/sharp/tree/v0.35.5
- https://github.com/lovell/sharp-libvips
- https://github.com/svg/svgo/tree/v4.1.0
- https://github.com/airbnb/lottie-web/tree/v5.13.0
- https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1

These notices and source links do not replace complete corresponding-source, relinking or other obligations for the exact GPL/LGPL binaries. The publisher must review and satisfy these before public distribution; the Store license-review check remains pending.
