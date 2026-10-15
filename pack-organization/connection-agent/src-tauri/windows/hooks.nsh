; ---
; EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
; ---
; Purpose: NSIS hooks — embed WireGuard for Windows MSI install (idempotent).
; Invariants:
; - Install WG only when wireguard.exe missing; never uninstall WG with the app.
; - MSI path must match Tauri resources map → $INSTDIR\wireguard-amd64.msi
; Related:
; - tauri.windows.conf.json (installerHooks, perMachine, resources)
; - windows/wireguard/VERSION.json
; ---

!macro NSIS_HOOK_PREINSTALL
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Prefer Program Files (x64); fall back to classic Program Files.
  StrCpy $R0 "$PROGRAMFILES64\WireGuard\wireguard.exe"
  IfFileExists "$R0" eliteew_wg_skip 0
  StrCpy $R0 "$PROGRAMFILES\WireGuard\wireguard.exe"
  IfFileExists "$R0" eliteew_wg_skip 0

  StrCpy $R1 "$INSTDIR\wireguard-amd64.msi"
  IfFileExists "$R1" 0 eliteew_wg_missing_msi

  DetailPrint "EliteEW: installing WireGuard for Windows (quiet)…"
  ; 0 = success, 3010 = success reboot required — both OK for first install.
  ExecWait 'msiexec /i "$R1" /qn /norestart' $R2
  IntCmp $R2 0 eliteew_wg_ok
  IntCmp $R2 3010 eliteew_wg_ok
  DetailPrint "EliteEW: WireGuard msiexec exit $R2 (tunnel step may need manual WireGuard install)"
  Goto eliteew_wg_done

  eliteew_wg_ok:
    DetailPrint "EliteEW: WireGuard install finished (exit $R2)"
    Goto eliteew_wg_done

  eliteew_wg_missing_msi:
    DetailPrint "EliteEW: wireguard-amd64.msi missing under $INSTDIR — rebuild after packaging/windows/fetch-wireguard-msi.sh"
    Goto eliteew_wg_done

  eliteew_wg_skip:
    DetailPrint "EliteEW: WireGuard already present — skip MSI"

  eliteew_wg_done:
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Do not remove WireGuard — shared system component.
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
!macroend
