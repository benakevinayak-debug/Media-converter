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
$output = Join-Path $PWD "dist\MediaConvert-$version-x64.msix"
& $MakeAppxPath pack /d (Join-Path $PWD 'dist\store-staging') /p $output /o
if ($LASTEXITCODE -ne 0) { throw 'MakeAppx validation or packaging failed. Review the manifest errors above.' }
Write-Host "Created unsigned Microsoft Store package: $output"
Write-Host 'Use a test certificate for local sideload testing. Microsoft signs accepted Store packages.'
Write-Host 'Run the Windows App Certification Kit and complete npm run store:check before submission.'
