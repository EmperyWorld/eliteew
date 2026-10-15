# Trusted Substrate — payload update without OS rebake

L2 product shell updates must not require an L1 rootfs rebuild. If an OS update
is pending, OS update wins and payload apply fails closed.

## Model

```text
payload-slots/
  state.env
  A/EliteEW.AppImage (+ .sig)
  B/EliteEW.AppImage (+ .sig)
  current -> A|B
```

Device default: `/opt/eliteew-trusted-substrate/payload-slots`. Factory and
tests may override it with `ELITEEW_TS_PAYLOAD_SLOTS`.

## Commands

```bash
bash scripts/payload-slot-init.sh v0
bash scripts/payload-apply.sh --payload /path/EliteEW.AppImage --version 1.2.3
bash scripts/payload-slot-status.sh
bash scripts/payload-rollback.sh
```

Payload apply requires the detached signature and W5 public key. Private keys
never enter slots or the image.

## Failure / Edge-Case Matrix

| Axis | Behavior |
|------|----------|
| Offline | Apply from a verified local file |
| Dual-flag | `OS_UPDATE_PENDING=1` blocks payload apply |
| Permission | Signature required; rollback is available once after replacement |
| Regression | `bash scripts/selftest-w6.sh` |

## Related

- [PAYLOAD-TAURI.md](PAYLOAD-TAURI.md)
- `policy/payload_slots.py`
- `scripts/payload-{apply,rollback,slot-init,slot-status}.sh`
