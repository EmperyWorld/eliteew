# Air enrollment edge tooling

Runtime safety contract for the one-code pre-license path. Product protocol and
state machine: [`DESKTOP-CLIENT-AIR-ENROLL.md`](../../../../documentation/product/desktop/DESKTOP-CLIENT-AIR-ENROLL.md).

## One-time order

1. Run `prepare-air-enroll-security-group.sh` without flags and review its
   read-only plan.
2. Grant the edge VM service account `vpc.securityGroups.admin` and
   `compute.viewer` at the containing folder. No static IAM key is stored.
3. Run the same SG command with `--apply --yes`.
4. Deploy the updated normal app vhost so TCP `443` explicitly denies the Air
   WebSocket path.
5. Set the dedicated SG/instance IDs and control public-key path in the
   command-center Config Plane, then run `install-air-enroll-edge.sh`.

The installer fails unless the dedicated SG is attached only to NIC 0, normal
`443` is closed for this path, backhaul mode is explicit, TLS files exist, and
the live controller preflight passes.

## Runtime command contract

The `eliteew-air-enroll` SSH account accepts only:

```text
preflight
open <canonical-session-uuid> <62200..63200> <expiry-epoch>
close <canonical-session-uuid>
reconcile
```

`open` returns the exact Yandex rule ID after LRO completion and read-back.
`close` removes nft routing before deleting that stored rule. Reconciliation
deletes SG rules whenever their matching timed nft lease is absent; it never
reopens a route after reboot without a fresh API `open`.

## Local regression proof

```bash
python3 eliteew_air_enroll_edge.py selftest
python3 -m unittest tests/test_edge_controller.py -v
bash -n ./*.sh
shellcheck ./*.sh
```
