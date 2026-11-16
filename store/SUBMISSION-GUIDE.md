# Microsoft Store submission — MediaConvert 1.2.0

Prepared for Vinayak Benake. Support: Benakevinayak@gmail.com.

## Current status

The Windows app, branding, draft listing, privacy policy, image assets, manifest
template, and Windows build workflow are prepared. This ZIP is **not a certified
or upload-ready Microsoft Store package**. Partner Center identity is not yet
available; no identity or publisher GUID has been invented. The release checks
in `identity.json` deliberately remain false until completed.

## 1. Register and reserve

Create/verify your Microsoft Store developer account and reserve an available
app name in Partner Center. Copy the exact Product identity values into
`store/identity.json` in the source project:

- `identityName`: Package/Identity/Name.
- `publisher`: Package/Identity/Publisher, including `CN=`.
- `publisherDisplayName`: exact Properties/PublisherDisplayName.
- `displayName`: a reserved app display name (currently MediaConvert).

Your personal credit remains Vinayak Benake even if your verified account's
publisher display name differs.

## 2. Publish the privacy policy and sources

Review `privacy-policy.html`, then host it at a public HTTPS URL, for example
using GitHub Pages. Put that live URL in `identity.json` and Partner Center.
A local HTML file is not a substitute for the Store's public policy URL.

Upload the final application source. Review `THIRD-PARTY-NOTICES.md`: the bundled
FFmpeg core enables GPL codec libraries. Make the complete corresponding source
and build instructions available as required by the applicable licenses. The
included upstream source references alone are not a complete source archive.
Review licensing/patent requirements before publishing; the source/license
release check must not be set to true without completing that review.

## 3. Build on Windows

Install Node.js 22+ and the Windows 10/11 SDK (including MakeAppx.exe). From the
source folder run:

```
npm ci
npm test
npm run store:build
```

The script checks identity fields, packages the x64 app, creates a manifest with
version `1.2.0.0`, and calls the SDK's MakeAppx with validation enabled. It emits
`dist/MediaConvert-1.2.0-x64.msix`. The package is intentionally unsigned for
Store upload. Microsoft signs accepted packages. A test certificate matching
your manifest publisher is needed for local sideload testing; do not distribute
a development certificate as a trusted public release.

Alternatively, add the complete source to your GitHub repository and run the
**Build Microsoft Store MSIX** workflow with your identity values and privacy
URL. Download the generated MSIX artifact. This workflow builds; it does not
submit or publish anything.

## 4. Test the actual package on Windows

Install and test the release package on a clean Windows 10/11 x64 test machine.
Use a development certificate or package flight suitable for your account.
Verify launch, file/folder drag/drop, Unicode paths, each claimed output format,
read-only destination errors, repeated conversions, output names, dark mode,
keyboard access, screen reader labels, single-instance activation, uninstall,
and an upgrade from a lower package version.

Run the Windows App Certification Kit against the installed release package.
Review all results. A build on Linux and browser renderer tests do not replace
these checks. `MaxVersionTested` is a manifest targeting value, not a claim that
Windows testing has already been completed.

## Explorer integration

The traditional installer and portable helpers add file and folder context menu
entries under the current user's registry. The MSIX instead declares file type
associations and a **Convert with MediaConvert** verb in its manifest. It does
not change default file associations automatically. Exact visibility depends on
Windows association state; test **Open with** and classic **Show more options**.
Folder/background context menu registration is available in the traditional
installer, not the MSIX. A packaged native Explorer command extension would be
needed for that additional integration. Dragging folders works in both editions.
No manual registry helper is shipped at the root of the Store package.

## 5. Complete the Store listing

Use `listing.en-US.json` as copy to review and paste, not as an API submission
payload. Choose pricing, markets, category, and accurate IARC age ratings in
Partner Center. Add your email and hosted privacy URL. Declare `runFullTrust`
and explain that Electron performs local user-selected file conversions; the
manifest requests no camera, microphone, account, or internet capability.

Artwork is in `build/assets`. Screenshots in the kit are browser-rendered
previews of the actual interface; recapture the installed Windows release before
submitting. Use PNG desktop screenshots at least 1366 × 768. Show the current
app without added marketing overlays. Do not describe an unfinished feature as
available in the Store edition.

## 6. Review and submit

Mark the completed release checks in `identity.json`, then run
`npm run store:check`. The script cannot verify your account, the truth of your
attestations, or certification outcomes. Review everything in Partner Center and
submit the MSIX yourself. Approval is Microsoft's decision. Increase the package
version for subsequent updates; the fourth component remains zero for the Store.

## Primary references (checked 16 November 2026)

- https://learn.microsoft.com/en-us/windows/apps/publish/store-readiness-checklist
- https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-manual-conversion
- https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/package-version-numbering
- https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/screenshots-and-images
- https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/desktop-to-uwp-extensions
- https://ffmpeg.org/legal.html
- https://github.com/ffmpegwasm/ffmpeg.wasm/blob/v0.12.10/Dockerfile
