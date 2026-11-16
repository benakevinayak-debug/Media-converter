Unicode true
!include "MUI2.nsh"
!include "x64.nsh"
!define APP_EXECUTABLE_FILENAME "MediaConvert.exe"
!define MUI_ICON "${ICON_PATH}"
!define MUI_UNICON "${ICON_PATH}"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Your media. Your device."
!define MUI_WELCOMEPAGE_TEXT "Welcome to MediaConvert ${APP_VERSION}. Convert video and audio offline, with outputs saved beside your originals.$\r$\n$\r$\nCreated by Vinayak Benake.$\r$\nSupport: Benakevinayak@gmail.com"
!define MUI_FINISHPAGE_RUN "$INSTDIR\MediaConvert.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Open MediaConvert"
!define MUI_FINISHPAGE_RUN_NOTCHECKED
Name "MediaConvert"
OutFile "${OUTPUT_PATH}"
InstallDir "$LOCALAPPDATA\Programs\MediaConvert"
InstallDirRegKey HKCU "Software\VinayakBenake\MediaConvert" "InstallPath"
RequestExecutionLevel user
SetCompressor /SOLID lzma
VIProductVersion "${APP_VERSION}.0"
VIAddVersionKey /LANG=1033 "ProductName" "MediaConvert"
VIAddVersionKey /LANG=1033 "CompanyName" "Vinayak Benake"
VIAddVersionKey /LANG=1033 "FileDescription" "MediaConvert Setup"
VIAddVersionKey /LANG=1033 "LegalCopyright" "Copyright © 2026 Vinayak Benake"
VIAddVersionKey /LANG=1033 "FileVersion" "${APP_VERSION}.0"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${PROJECT_DIR}/LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
!include "${PROJECT_DIR}/desktop/installer.nsh"
Function .onInit
  SetRegView 64
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "This version of MediaConvert needs 64-bit Windows."
    Abort
  ${EndIf}
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "CurrentBuildNumber"
  IntCmp $0 19041 version_ok version_old version_ok
  version_old:
    MessageBox MB_OK|MB_ICONSTOP "MediaConvert requires Windows 10 version 2004 (build 19041) or newer."
    Abort
  version_ok:
FunctionEnd
Function un.onInit
  SetRegView 64
FunctionEnd
Section "MediaConvert" SEC_MAIN
  SectionIn RO
  SetOutPath "$INSTDIR"
  File /r "${APP_DIR}/*"
  WriteRegStr HKCU "Software\VinayakBenake\MediaConvert" "InstallPath" "$INSTDIR"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\MediaConvert"
  CreateShortcut "$SMPROGRAMS\MediaConvert\MediaConvert.lnk" "$INSTDIR\MediaConvert.exe"
  CreateShortcut "$SMPROGRAMS\MediaConvert\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\MediaConvert.lnk" "$INSTDIR\MediaConvert.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\VinayakBenake.MediaConvert" "DisplayName" "MediaConvert"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\VinayakBenake.MediaConvert" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\VinayakBenake.MediaConvert" "Publisher" "Vinayak Benake"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\VinayakBenake.MediaConvert" "DisplayIcon" "$INSTDIR\MediaConvert.exe,0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\VinayakBenake.MediaConvert" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\VinayakBenake.MediaConvert" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\VinayakBenake.MediaConvert" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\VinayakBenake.MediaConvert" "NoRepair" 1
  !insertmacro customInstall
SectionEnd
Section "Uninstall"
  !insertmacro customUnInstall
  !include "${UNINSTALL_LIST}"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  Delete "$DESKTOP\MediaConvert.lnk"
  Delete "$SMPROGRAMS\MediaConvert\MediaConvert.lnk"
  Delete "$SMPROGRAMS\MediaConvert\Uninstall.lnk"
  RMDir "$SMPROGRAMS\MediaConvert"
  DeleteRegKey HKCU "Software\VinayakBenake\MediaConvert"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\VinayakBenake.MediaConvert"
SectionEnd
