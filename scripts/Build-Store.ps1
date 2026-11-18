param([string]$MakeAppxPath = '')
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
node scripts/store-config.cjs
if ($LASTEXITCODE -ne 0) { throw 'Complete store/identity.json first. No placeholder identity may be submitted.' }
npm run pack:win
if ($LASTEXITCODE -ne 0) { throw 'Windows application packaging failed.' }
node scripts/store-config.cjs --prepare
if ($LASTEXITCODE -ne 0) { throw 'Manifest/staging preparation failed.' }
if (-not $MakeAppxPath) {
    $sdk = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
    $MakeAppxPath = Get-ChildItem -Path "$sdk\*\x64\makeappx.exe" | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $MakeAppxPath -or -not (Test-Path -LiteralPath $MakeAppxPath)) { throw 'Install the Windows 10/11 SDK, or pass -MakeAppxPath.' }
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$output = Join-Path $PWD "dist\QuickConvert-Media-$version-x64.msix"
& $MakeAppxPath pack /d (Join-Path $PWD 'dist\store-staging') /p $output /o
if ($LASTEXITCODE -ne 0) { throw 'MakeAppx validation or packaging failed. Review the manifest errors above.' }
Write-Host "Created unsigned Microsoft Store package: $output"
Write-Host 'Use a test certificate for local sideload testing. Microsoft signs accepted Store packages.'
Write-Host 'Run the Windows App Certification Kit and complete npm run store:check before submission.'

$verification = Join-Path $PWD 'dist\store-verification'
& $MakeAppxPath unpack /p $output /d $verification /o
if ($LASTEXITCODE -ne 0) { throw 'Could not unpack the finished MSIX for verification.' }
[xml]$manifest = Get-Content (Join-Path $verification 'AppxManifest.xml') -Raw
$identity = Get-Content store/identity.json -Raw | ConvertFrom-Json
$actual = [ordered]@{
    identityName = [string]$manifest.Package.Identity.Name
    publisher = [string]$manifest.Package.Identity.Publisher
    publisherDisplayName = [string]$manifest.Package.Properties.PublisherDisplayName
    displayName = [string]$manifest.Package.Properties.DisplayName
    version = [string]$manifest.Package.Identity.Version
    architecture = [string]$manifest.Package.Identity.ProcessorArchitecture
}
foreach ($key in @('identityName', 'publisher', 'publisherDisplayName', 'displayName')) {
    if ($actual[$key] -cne $identity.$key) { throw "Packaged $key does not match the configured Store identity." }
}
if ($actual.version -cne "$version.0" -or $actual.architecture -cne 'x64') { throw 'Incorrect packaged version or architecture.' }
$actual | ConvertTo-Json | Set-Content dist/MSIX-IDENTITY-REPORT.json -Encoding utf8
Copy-Item (Join-Path $verification 'AppxManifest.xml') dist/MSIX-AppxManifest.xml -Force
@"
QuickConvert Media - Microsoft Store upload
1. Extract this downloaded artifact ZIP.
2. In Partner Center, open QuickConvert Media > submission > Packages.
3. Upload QuickConvert-Media-$version-x64.msix (not this ZIP).
4. Complete the listing, public privacy policy URL, age ratings and certification requirements.

This is an unsigned x64 Store package. Microsoft signs accepted Store packages.
It is not a double-click installer for local testing without a trusted test certificate.
MakeAppx validation and exact packaged identity checks passed during this build.
The CI artifact also includes image-compression-checks.json and a screenshot.
The image checks run the application extracted from the finished MSIX; they do not install/register the MSIX or replace Store certification.
Windows installation tests, Windows App Certification Kit, accessibility and GPL corresponding-source/license review remain pending.
Creator: Vinayak Benake
Support: Benakevinayak@gmail.com
Store product: https://apps.microsoft.com/detail/9NNM1PVXN2HR
"@ | Set-Content dist/Upload-Instructions.txt -Encoding utf8
Write-Host 'Finished MSIX identity verified against store/identity.json.'
