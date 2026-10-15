# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error — W-transport pegs one CPU core while channel idle (SOCKS keepalives).
# ---

# W-transport idle one-core busy-spin (`can_send` → poll 0)

| Field | Value |
|-------|--------|
| **product_id** | `desktop-client` |
| **status** | `fixed` |
| **date** | `2026-09-08` |
| **also_affects** | `trusted-substrate` |
| **canon** | `documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md` §W-transport event-driven poll |
| **commit** | `93331940b` |
| **readiness** | `documentation/reference/solution-readiness/README.md` (registry retired) |

## Symptom

With channel connected and product open (idle), `eliteew-desktop` / thread `eliteew-w-trans` holds ~100% of one core; package ~80°C on laptop. LAN and tunnel L7 work.

## Failure layers

1. Engine loop treated `sock.can_send()` as «busy»
2. Established TCP with free send window almost always reports `can_send`
3. Product HTTP keepalives leave sockets in `active` → `poll` timeout **0** forever
4. Bridge FDs were not mio-registered, so the wrong busy flag was the only «wake» for SOCKS→WG

## Root cause

Immediate-work predicate in `tcp_over_wg` engine included bare `can_send`, forcing a busy-spin for the lifetime of any idle keepalive through W-transport.

## What we did

- `needs_immediate_engine_wake`: only `can_recv` or (`to_smol` nonempty && `can_send`)
- Register each active localhost bridge with mio (`READABLE`, +`WRITABLE` when `to_bridge` pending)
- Regression lock unit test + in-crate lossless suite green
- Canon row updated (event-driven poll)

## Verification

```text
cargo test -p w-transport-core --lib idle_established
→ idle_established_can_send_does_not_force_immediate_wake ok
→ idle_established_engine_does_not_busy_spin ok (<200 engine iterations/sec with open idle TCP)

metal Trusted Substrate (192.168.8.10, 2026-09-08, `pnpm build:linux` / tauri RPM binary):
load avg 0.06; eliteew-desktop ~3%; eliteew-w-trans ~0.2% of one core (5s sample);
x86_pkg_temp ~46°C; SOCKS up; curl --socks5-hostname … /api/health → 200
(was ~100% one core / ~80°C package before the fix)
```

## Recommendations

- Do not reintroduce bare `can_send` into zero-timeout wait.
- Ship via **`pnpm build:linux` / `tauri build`** (embeds SPA). Bare `cargo build -p desktop-client` can omit frontend assets and break the launcher UI (`could not connect to localhost`).
- Refresh Trusted Substrate payload/slots with that RPM binary for pilots.
