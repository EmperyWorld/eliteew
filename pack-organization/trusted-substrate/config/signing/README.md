# Signing config (W5)

- **Public** key may live here as `image-signing.pub.pem` (operator-supplied).
- **Private** keys go under `work/signing-keys/` (gitignored) — see `docs/KEYS-CEREMONY.md`.
- Never commit OpenSSL/SSH private-key PEM material in this directory.

Example algorithm pin:

```bash
cp algorithm.env.example algorithm.env   # optional local overrides
```

Verify default pubkey path: `config/signing/image-signing.pub.pem`  
Override: `ELITEEW_TS_SIGNING_PUB` / `ELITEEW_TS_SIGNING_KEY`.
