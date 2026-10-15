# empiieros-state-unlock-agent

MIT console agent for **state LUKS2** (`empiieros-state`) on installed EmpiierOS seats.

- Watches `/run/systemd/ask-password/` (systemd Password Agents protocol).
- Answers only `cryptsetup:` requests that target the state mapper.
- Prompts on **tty1** with masked input; replies via `systemd-reply-password` or `+` datagram.

## Build

```bash
bash ../scripts/build-state-unlock-agent-from-source.sh
```

Installs into `config/buildroot/external/board/eliteew-ts/rootfs_overlay/` by default.

## Test

```bash
cargo test
```

Replace `fixtures/ask-cryptsetup-sample.ini` with a real `ask.*` capture from no-TPM metal/QEMU boot when available.
