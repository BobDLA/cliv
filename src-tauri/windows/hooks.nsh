!include "LogicLib.nsh"

!macro CLIV_WRITE_PATH_SCRIPT
  InitPluginsDir
  FileOpen $0 "$PLUGINSDIR\cliv-path.ps1" w
  FileWrite $0 "$$ErrorActionPreference = 'Stop'$\r$\n"
  FileWrite $0 "param([ValidateSet('add','remove')][string]$$Mode, [string]$$InstallDir)$\r$\n"
  FileWrite $0 "$$Target = [System.EnvironmentVariableTarget]::User$\r$\n"
  FileWrite $0 "$\r$\n"
  FileWrite $0 "function Normalize-PathEntry([string]$$Value) {$\r$\n"
  FileWrite $0 "  if ([string]::IsNullOrWhiteSpace($$Value)) { return $$null }$\r$\n"
  FileWrite $0 "  return $$Value.Trim().TrimEnd('\').ToLowerInvariant()$\r$\n"
  FileWrite $0 "}$\r$\n"
  FileWrite $0 "$\r$\n"
  FileWrite $0 "function Broadcast-EnvironmentChange() {$\r$\n"
  FileWrite $0 "  $$signature = @'$\r$\n"
  FileWrite $0 "[System.Runtime.InteropServices.DllImport($\"user32.dll$\", CharSet = System.Runtime.InteropServices.CharSet.Auto, SetLastError = true)]$\r$\n"
  FileWrite $0 "public static extern System.IntPtr SendMessageTimeout(System.IntPtr hWnd, System.UInt32 Msg, System.IntPtr wParam, string lParam, System.UInt32 fuFlags, System.UInt32 uTimeout, out System.IntPtr lpdwResult);$\r$\n"
  FileWrite $0 "'@$\r$\n"
  FileWrite $0 "  $$type = Add-Type -MemberDefinition $$signature -Name 'CliVNativeMethods' -Namespace 'CliVInstaller' -PassThru$\r$\n"
  FileWrite $0 "  $$result = [System.IntPtr]::Zero$\r$\n"
  FileWrite $0 "  [void]$$type::SendMessageTimeout([System.IntPtr]0xffff, 0x1A, [System.IntPtr]::Zero, 'Environment', 0x0002, 5000, [ref]$$result)$\r$\n"
  FileWrite $0 "}$\r$\n"
  FileWrite $0 "$\r$\n"
  FileWrite $0 "$$normalizedInstallDir = Normalize-PathEntry $$InstallDir$\r$\n"
  FileWrite $0 "$$currentPath = [Environment]::GetEnvironmentVariable('Path', $$Target)$\r$\n"
  FileWrite $0 "$$entries = @()$\r$\n"
  FileWrite $0 "if ($$currentPath) {$\r$\n"
  FileWrite $0 "  $$entries = @($$currentPath -split ';' | Where-Object { -not [string]::IsNullOrWhiteSpace($$_) })$\r$\n"
  FileWrite $0 "}$\r$\n"
  FileWrite $0 "$\r$\n"
  FileWrite $0 "if ($$Mode -eq 'add') {$\r$\n"
  FileWrite $0 "  $$normalizedEntries = @($$entries | ForEach-Object { Normalize-PathEntry $$_ })$\r$\n"
  FileWrite $0 "  if ($$normalizedEntries -notcontains $$normalizedInstallDir) {$\r$\n"
  FileWrite $0 "    [Environment]::SetEnvironmentVariable('Path', (($$entries + $$InstallDir) -join ';'), $$Target)$\r$\n"
  FileWrite $0 "    Broadcast-EnvironmentChange$\r$\n"
  FileWrite $0 "  }$\r$\n"
  FileWrite $0 "  exit 0$\r$\n"
  FileWrite $0 "}$\r$\n"
  FileWrite $0 "$\r$\n"
  FileWrite $0 "$$remaining = @($$entries | Where-Object { (Normalize-PathEntry $$_) -ne $$normalizedInstallDir })$\r$\n"
  FileWrite $0 "$$newValue = if ($$remaining.Count -gt 0) { $$remaining -join ';' } else { $$null }$\r$\n"
  FileWrite $0 "[Environment]::SetEnvironmentVariable('Path', $$newValue, $$Target)$\r$\n"
  FileWrite $0 "Broadcast-EnvironmentChange$\r$\n"
  FileClose $0
!macroend

!macro CLIV_RUN_PATH_SCRIPT MODE
  !insertmacro CLIV_WRITE_PATH_SCRIPT
  DetailPrint "cliV: updating current-user PATH (${MODE})"
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -NonInteractive -File "$PLUGINSDIR\cliv-path.ps1" "${MODE}" "$INSTDIR"'
  Pop $1
  ${If} $1 != 0
    DetailPrint "cliV: PATH update exited with code $1"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  !insertmacro CLIV_RUN_PATH_SCRIPT add
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro CLIV_RUN_PATH_SCRIPT remove
!macroend
