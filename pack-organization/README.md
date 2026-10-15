# Organization entrance pack

This pack provides controlled organization access to the shared product. The [Connection Agent](connection-agent/README.md) is a Tauri application with license/capsule and WireGuard workflows. Browser, Keycloak, shared SPA/API and Meet remain separate components; Meet's product path uses the system browser.

Other carriers have independent readiness and release boundaries:

- [Trusted Substrate](trusted-substrate/README.md) is a Buildroot-based carrier with installer/state-unlock components. Preserve its explicit NOT_READY status; implementation or historical pilot evidence is not production acceptance.
- [Command-center image](command-center-image/README.md) contains installation-image inputs. Its disk provisioning instructions require a separately authorized machine operation.
- A local `kiosk-fedora-iso/` workspace may be ignored; see [Fedora kiosk guidance](../documentation/platform/docker-re_doc/KIOSK-FEDORA-SERVER-ISO.md). It is not the Tauri source tree.

[Pack layout](../documentation/platform/ELITEEW-PACK-LAYOUT.md), [desktop product docs](../documentation/product/desktop/README.md) and [release navigation](release/README.md) define artifact ownership. Source presence and completed relocation plans do not certify deployment or release readiness. See [the source module map](../documentation/reference/SOURCE-MODULE-MAP.md) for the implementation boundaries.
