# P9a — Service access and sealed materials

In older API names, “license” here means a **service entitlement**: access to
hosted features, managed functions, or a trusted channel. That is **not** the
MIT code license and does **not** block self-hosted use of the gift.

| Rule | Meaning |
|------|---------|
| Control | Entitlement can be revoked / time-bounded / capability-narrowed where supported |
| At rest | Storage keeps a **hash** / sealed materials — not everlasting plaintext keys as the norm |
| Issuance | An access secret may appear **once** at issuance; then the capsule |
| UX | Import a **sealed** capsule; not “paste a key into Notepad” as the main path |
| Client | Place private material stays in the OS-protected store, not in JS/logs |

We do **not** promise: users must edit conf by hand · the server stores chat
private keys · a capsule is a password to every service in the world.
