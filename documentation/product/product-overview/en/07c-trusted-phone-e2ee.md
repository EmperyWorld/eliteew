# P7c — Trusted phone and on-device E2EE keys

## Thesis

With **trusted phone binding**, separate key families can appear on the device:

| Family | Purpose | Private key |
|--------|---------|-------------|
| Device identity | Prove “same phone” | On the phone |
| Secure Connection channel | Enter the protected perimeter | On the phone |
| **GAF E2EE** | End-to-end chat encryption | On the phone |

The server keeps **public** material and message ciphertext; it does **not**
recover a lost GAF private key. Lose the key without a transfer path = old E2EE
messages are unreadable from the server.

**Turning E2EE on in a chat :** not by default; needs mutual consent and
ready trusted devices with keys. While E2EE is active, ordinary plaintext is
not accepted into that chat.

**Not promised:** “all chats always E2EE” · “the server holds the decryption secret” ·
“E2EE = the same key as WireGuard.”

Comparisons — [P1](01-what-is-eliteew.md); limits — [P12](12-honest-limits.md).
