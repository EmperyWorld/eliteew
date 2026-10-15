# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error — FoFline taskbar network chip stayed red on EmpiierOS.
# ---

# FoFline taskbar network chip ignored the OS link

| Field | Value |
|-------|--------|
| **product_id** | `desktop-shell` |
| **status** | `contained` |
| **date** | `2026-09-20` |
| **also_affects** | `desktop-client` |
| **canon** | `documentation/product/desktop/DESKTOP-TASKBAR-ARCHITECTURE.md` |
| **commit** | — |

## Symptom

On EmpiierOS the FoFline taskbar network chip stays red (`Network` / `Inactive`) even when the OS tray shows Wi-Fi or a live cable.

## Failure layers

- The chip only called Tauri `host_network_link_snapshot`.
- EmpiierOS has no `__TAURI_INTERNALS__`. The product WebView was not given the shell snapshot.
- The OS tray already reads `system.snapshot`: associated Wi-Fi first, else ethernet with `operstate=up` or carrier.

## Root cause

The product chip treated “no Tauri” as “no link” instead of reading the seat snapshot the shell already uses.

## What we did

- EmpiierOS plants `window.EmperyDesktopNetworkLink.getLinkSnapshot()` and answers `network.link_snapshot` with kind + active only.
- The SPA uses that hook on FoFline-through-OS. Browser `navigator.onLine` is still not a link. Tauri is unchanged.

## Recommendations

- Do not paint the chip from browser reachability.
- Do not put IP, DNS, gateway, or SSID in the product payload.

## Verification

```text
cd shared/web/frontend && pnpm exec vitest run src/pages/Desktop/utils/__tests__/hostNetworkLinkSnapshot.contract.test.ts
→ 5 passed
cd /data/repos/EmpiierOS/runtime && cargo test --lib link_chip
→ 3 passed
```

## Residual risk

Not on the seat. The hook is in the OS image, so a SPA pack alone stays red until EmpiierOS is rebuilt and the new pack is taken. Glass not checked.
