param([switch]$Remove)
$ErrorActionPreference = 'Stop'
$exe = Join-Path $PSScriptRoot 'MediaConvert.exe'
if (-not $Remove -and -not (Test-Path -LiteralPath $exe)) {
    throw 'Extract the whole ZIP first, and keep this script beside MediaConvert.exe.'
}
$extensions = 'mp4 mov mkv webm avi gif mp3 wav flac aac m4a ogg opus wmv flv ts 3gp wma aiff aif hevc m2ts mts mpeg mpg m4v mka oga vob'.Split(' ')
$entries = @($extensions | ForEach-Object { @{ Key = "SystemFileAssociations\.$_"; Argument = '%1' } })
$entries += @{ Key = 'Directory'; Argument = '%1' }
$entries += @{ Key = 'Directory\Background'; Argument = '%V' }
foreach ($entry in $entries) {
    $key = 'HKCU:\Software\Classes\' + $entry.Key + '\shell\MediaConvert'
    if ($Remove) {
        if (Test-Path -LiteralPath $key) { Remove-Item -LiteralPath $key -Recurse -Force }
    } else {
        New-Item -Path $key -Value 'Convert with MediaConvert' -Force | Out-Null
        Set-ItemProperty -LiteralPath $key -Name 'Icon' -Value ('"{0}",0' -f $exe)
        Set-ItemProperty -LiteralPath $key -Name 'MultiSelectModel' -Value 'Player'
        $command = '"{0}" --convert "{1}"' -f $exe, $entry.Argument
        New-Item -Path ($key + '\command') -Value $command -Force | Out-Null
    }
}
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class ExplorerRefresh {
    [DllImport("shell32.dll")]
    public static extern void SHChangeNotify(uint eventId, uint flags, IntPtr item1, IntPtr item2);
}
'@
[ExplorerRefresh]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
if ($Remove) { Write-Host 'MediaConvert right-click menu removed.' }
else { Write-Host 'MediaConvert right-click menu added. Windows 11: choose Show more options.' }
