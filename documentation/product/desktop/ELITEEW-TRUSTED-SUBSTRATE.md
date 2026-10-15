# EliteEW Trusted Substrate (living target SoT)

**Status:** Living **target** canon under **secure reset (`NOT_READY`)**.
**Anti-crutch:** `NOT_CRUTCH` — product behavior comes from the Buildroot
overlay/recipes and rebuilt artifacts, never a live-media patch.
Historical W0–W7 labels describe recipes, not accepted image or metal behavior.
The active from-source profile is Wayland/labwc +
`payload_profile=empiieros-shell` + `payload_trust=eliteew-runtime`.
A clean image build and graphical QEMU acceptance pass; physical-metal
acceptance remains.
**Process plan (waves W0–W8):** `documentation/plans/product/desktop/ELITEEW-TRUSTED-SUBSTRATE-PLAN.md` *[operator-local process plan; gitignored — not living canon]* — revisable; **this SoT wins** on contracts.  
**Installer audit backlog:** `documentation/plans/product/desktop/ELITEEW-TRUSTED-SUBSTRATE-INSTALLER-AUDIT-BACKLOG.md` *[operator-local process plan; gitignored — not living canon]* — Dual SoT / apply / overlay / grub.  
**Edition:** **client** / org-door kinship (device-local sealed runtime).  
**Pack entrance:** `pack-organization` — tree `pack-organization/trusted-substrate/` (own directory; does **not** replace Connection Agent or Fedora kiosk ISO).  
**Code today:** `pack-organization/trusted-substrate/` (W0–W7a); see plan for W7b+.

If this SoT diverges from the process plan, **this SoT wins** on product/trust contracts.

---

## 1. One-sentence goal

Build and ship a **signed, minimal, from-source EliteEW Trusted Substrate**:
a kiosk-class OS image for **bare metal**, compiled with a toolchain we also
build from source, whose only user-facing product is the first-party
**EmpiierOS React Shell** backed by an authenticated local **EliteEW Runtime**.
The living Tauri host remains separate kinship and is not the target axis of
this profile.

---

## 2. Problem this product solves

| Symptom (operator / customer) | Expected |
|-------------------------------|----------|
| Host OS is an untrusted zoo (vendor blobs, unknown packages, broad attack surface) | Device boots a **known** EliteEW-built rootfs |
| “Is anything malicious baked into the binary chain?” | Every bit in the trust perimeter is either **our source**, **pinned OSS we chose**, or **explicitly labeled bootstrap exception** |
| EliteEW shell already exists (Tauri living; Electron available as installer) | Substrate does **not** reinvent the product; it **hosts** it |
| Portal kiosk today = Fedora + Chromium + nginx | That SKU remains; Trusted Substrate is a **parallel** sealed carrier |

**Failure layer (strategic):** supply-chain / OS trust floor — not SPA UX, not stack0 API shape.

---

## 3. Non-goals (HARD)

| Non-goal | Why |
|----------|-----|
| Break or rewrite living **Connection Agent** / FoFline / Capsule v3 | Product shell is already the SoT elsewhere; substrate is carrier |
| Merge with **`kiosk-fedora-iso`** / Chromium+nginx portal kiosk | Different SKU; shared ideas only (no secrets in ISO, WG handoff) |
| Touch **pack-cloud/mobile** or cloud stack0 bake as part of this SKU | Wrong door |
| Replace cloud topology / invent second Empery prod-core | Cloud stays [PRODUCTION-TOPOLOGY-STATE.md](../../platform/PRODUCTION-TOPOLOGY-STATE.md) §Current |
| Claim “Electron installer = fully audited Chromium from our toolchain” | Bootstrap honesty — see §8 |
| Ship secrets, WG private keys, or prod `.env` inside the ISO | Handoff after first boot only |
| Resurrect soft-retired product trees (DEWA/EWGen/…) as the substrate | Harvest only if needed; not restore trees |
| User-facing sysadmin ritual as product UX | Install may be ops; day-2 recovery stays product-honest ([user product obligations](../../platform/AGENT-CAUSE-FIRST-AND-PREMIUM-UI.md)) |

---

## 4. Relationship to existing EliteEW surfaces

| Surface | Role vs Trusted Substrate |
|---------|---------------------------|
| **Connection Agent (Tauri)** — `pack-organization/connection-agent/` | Living **product shell** (license, WG/W-transport, Capsule, F-04). **Target** long-term payload inside substrate. Not abandoned. |
| **FoFline** — [DESKTOP-FOFLINE-EDITION.md](DESKTOP-FOFLINE-EDITION.md) | Licensed local SPA + mandatory WG; remains product contract. Substrate may host FoFline shell when payload = Tauri. |
| **Fedora portal kiosk ISO** — [KIOSK-FEDORA-SERVER-ISO.md](../../platform/docker-re_doc/KIOSK-FEDORA-SERVER-ISO.md) | **Parallel** appliance: Chromium + local nginx + SPA. **Do not merge codepaths.** Shared ops lessons only. |
| **Electron EliteEW installer** (operator-owned artifact; not required to live in monorepo) | **Bootstrap payload** for early metal proofs (§8). Temporary; not a claim that Electron replaces Tauri in editions canon. |
| **Cloud SPA / stack0** | Unchanged; reachability via WG / allowlisted egress as designed per payload |

Canon already states Tauri ≠ kiosk ([DESKTOP-TAURI-CONNECTED-CLIENT.md](DESKTOP-TAURI-CONNECTED-CLIENT.md) §2). Extend that rule: **Tauri ≠ Fedora kiosk ≠ Trusted Substrate** — three carriers/skus, one product family.

---

## 5. End-state architecture (normative)

```text
┌─────────────────────────────────────────────────────────────┐
│ Bare metal (x86_64 target class; other arches = later)      │
├─────────────────────────────────────────────────────────────┤
│ Boot: signed bootloader / kernel (Secure Boot when HW OK)   │
├─────────────────────────────────────────────────────────────┤
│ Trusted Substrate rootfs (read-only / verity preferred)     │
│   • Built from source with EliteEW-built toolchain          │
│   • Minimal userspace; no general desktop “app store”       │
│   • Kiosk policy: autostart product payload only            │
├─────────────────────────────────────────────────────────────┤
│ Product payload / update slot (mutable, signed target)      │
│   • EmpiierOS React Shell + first-party Rust Runtime        │
│   • Capsule / OTA updates remain future scoped work         │
├─────────────────────────────────────────────────────────────┤
│ Network: deny-by-default egress; WG (or equivalent) to prod │
│ Secrets: never in ISO; peer/license handoff post-install    │
└─────────────────────────────────────────────────────────────┘
```

### 5.1 Layer split (do not collapse)

| Layer | Cadence | What changes | Who signs |
|-------|---------|--------------|-----------|
| **L0 — Toolchain** | Rare (months) | gcc/clang/binutils/rustc (as chosen) built from pinned sources | EliteEW release keys |
| **L1 — Substrate OS** | Rare | kernel, rootfs, kiosk policy, drivers needed for payload | EliteEW OS image keys |
| **L2 — Product shell** | Medium | EmpiierOS React Shell + native WebKitGTK bridge + EliteEW Runtime | EmpiierOS release pipeline (signing residual) |
| **L3 — Product content** | Frequent | SPA packs / capsules (FoFline asset groups, etc.) | Existing capsule/OTA SoT |

**Normative rule:** UI/content updates **must not** require full OS rebuild. OS rebuild is for kernel/CVE/policy/toolchain — not for SPA pixels.

### 5.2 Trust statements (honest)

| Claim we **do** make at end-state | Claim we **do not** make |
|-----------------------------------|---------------------------|
| We know the **recipe**: pinned sources → our compiler → artifacts → signatures | “Open source cannot contain malice” — we pin, review, minimize; we do not claim omniscience |
| No **proprietary closed blobs** in the declared trust perimeter without an explicit exception register | Bootstrap Electron Chromium is already audited bit-for-bit by us (until L2 is rebuilt from source) |
| Reproducible builds are a **target** (bit-identical where toolchain allows) | Every intermediate CI cache is forever trusted without attestation |

---

## 6. Build & license policy (HARD)

### 6.1 From-source + own toolchain

1. **Toolchain:** EliteEW builds the compiler/toolchain **from source** (pinned versions, recorded hashes). Application and OS packages in the trust perimeter are built **with that toolchain** (not a random host `dnf gcc`).
2. **No prebuilt vendor toolchains** inside the trust perimeter as the *source of truth* (bootstrap of the *first* toolchain on a known host is an ops bootstrap problem — documented in [TOOLCHAIN-FROM-SOURCE.md](../../../pack-organization/trusted-substrate/docs/TOOLCHAIN-FROM-SOURCE.md); end-state still rebuilds toolchain from source for release artifacts).
3. **Package set:** allowlist only. Anything not on the allowlist is absent from the image.

### 6.2 Licensing

| Rule | Detail |
|------|--------|
| Allowed | OSI-approved / clearly open licenses compatible with appliance distribution (track SPDX per package) |
| Forbidden in perimeter | Proprietary runtimes, undocumented binary drops, “download this .so” without source |
| First-party | EliteEW-written components under EliteEW license policy |
| Third-party OSS | Vendor source + license text + NOTICE aggregation shipped with image docs |
| Gate | CI / factory fail-closed on unknown SPDX — **W3:** `pack-organization/trusted-substrate/scripts/spdx-allowlist-gate.sh` + `licenses/ALLOWLIST` |

### 6.3 What we write ourselves vs take from OSS

- Prefer **minimal OSS** (kernel, libc, init, WG userspace, display stack required by payload) over reimplementing POSIX.
- Prefer **first-party** for EliteEW-specific kiosk policy, update agent glue, and install UX that must match product honesty.
- Do **not** reimplement Chromium/WebKit “for fun”; if the payload needs a web engine, either (a) accept a **labeled bootstrap binary**, or (b) schedule a **from-source web engine** milestone as its own factory (see §8 / §12).

---

## 7. Runtime & network (end-state)

| Topic | Normative behavior |
|-------|-------------------|
| **Kiosk** | tty1 autologin enters the bounded labwc session and launches only `empiieros-shell-gui`. The Runtime is a separate hardened system service reached through an authenticated Unix socket. Root and kiosk passwords are locked. Installed SSH is key-only and remains disabled unless an operator public key was explicitly provisioned. tty2–6 are masked by default; local tty2 maintenance requires a separate signed maintenance profile and is never present in the public image. |
| **Egress** | Default deny. Before entitlement/W-transport, allow required DNS and DHCP plus TCP `62200–63200` only to a timeout nft set of public addresses resolved for exact `app.eliteew.ru`; reject private/link-local/non-global DNS answers. Public NTP is closed. After activation, follow the normal WireGuard/W-transport policy. Air details: [DESKTOP-CLIENT-AIR-ENROLL.md](DESKTOP-CLIENT-AIR-ENROLL.md) |
| **Wall clock** | `systemd-timesyncd` is disabled and masked; its public `NTP` and `FallbackNTP` lists are empty. The installer records the operator-confirmed wall clock, first boot consumes that one-shot value, and the Runtime subsequently uses authenticated IdP `Date` evidence. `systemd-networkd` + `systemd-resolved` remain enabled. Default TZ is `Europe/Moscow` (`BR2_TARGET_LOCALTIME` + `/etc/localtime`). |
| **WG materials** | Installed post-boot via handoff (USB/ops/capsule) — **never** baked into public ISO |
| **License / seat** | Follow living desktop-client / FoFline contracts when payload is Tauri; Electron bootstrap may use a reduced pilot path — must not invent a second prod API |
| **Offline** | Substrate boots and shows honest “channel unavailable” if tunnel/API down; no fake success |
| **Dual-flag** | If both “bootstrap Electron” and “Tauri payload” features exist in one image config, **exactly one** is active; conflict = build-time error, not silent preference |

The pre-license exception is installed only through Buildroot `rootfs_overlay`: resolver service/timer plus nftables policy. Live-USB edits, `payload-templates` reinjection, a broad public-IP allowlist, or user firewall instructions are not install source of truth.

Related ops kinship (not merge): [PORTAL-PRIVATE-TUNNEL-EDGE.md](../../platform/docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md).

---

## 8. Payload strategy (active EmpiierOS lock)

### 8.1 Active profile lock (2026-09-16)

- The active image profile is exactly `empiieros-shell`.
- Its product process is `empiieros-shell-gui`; its privileged process is the
  separately supervised `empiieros-runtime`.
- The legacy Desktop Client binary is forbidden in this profile. Tauri remains
  a living host elsewhere and is not removed or rewritten by this factory.
- Buildroot is the only rootfs/image source of truth. The EmpiierOS packager
  emits an immutable overlay and never repacks a finished rootfs.

### 8.2 Honesty labels

| Era | Payload | Trust label (must appear in release notes / image metadata) |
|-----|---------|--------------------------------------------------------------|
| **Active secure reset** | EmpiierOS Shell + EliteEW Runtime | `payload_trust=eliteew-runtime` — first-party payload; image and metal acceptance still pending |
| **Bootstrap** | Electron (may include upstream Chromium binaries) | `payload_trust=bootstrap-electron` — OS may be from-source; **payload engine is not yet EliteEW-rebuilt** |
| **Target shell** | Tauri Connection Agent / FoFline | `payload_trust=tauri-living` — shell matches living org-door SoT; WebKitGTK still subject to distro/from-source policy of that era |
| **Full engine (optional north star)** | Shell + web engine built from source with EliteEW toolchain | `payload_trust=engine-from-source` — separate milestone; **not** required for first metal |

### 8.3 Capsule / update

- Prefer **reuse** of living Capsule / FoFline OTA / shell updater concepts for L2/L3.
- Do **not** invent a second incompatible update bus without an explicit operator decision.
- OS (L1) updates are a **different channel** (signed image/A-B slot) from SPA capsules.

---

## 9. Security & cryptography (end-state targets)

| Control | Target |
|---------|--------|
| Image / ISO signature | Detached signature; verify before install when process allows |
| Kernel / boot | Signed kernel; Secure Boot enrollment where hardware supports it |
| Rootfs integrity | dm-verity (or equivalent) for read-only system volume |
| Disk confidentiality | LUKS (or equivalent) for mutable data / payload slots where threat model requires |
| Update authenticity | Same key hierarchy documented; rollback to last-known-good slot |
| Secrets | tmpfs / sealed storage; never world-readable in image |

Exact algorithms, key ceremony, and HSM use = factory runbook. **W5 shipped:** [KEYS-CEREMONY.md](../../../pack-organization/trusted-substrate/docs/KEYS-CEREMONY.md) + [IMAGE-INTEGRITY.md](../../../pack-organization/trusted-substrate/docs/IMAGE-INTEGRITY.md) + `image-sign`/`image-verify` (tamper fail-closed). Secure Boot enrollment and production dm-verity/LUKS on metal remain operator residuals. SoT still locks **that** signing + integrity + no-secrets-in-ISO are mandatory for “Trusted” branding.

---

## 10. Directory layout (monorepo)

```text
pack-organization/trusted-substrate/
  README.md
  policy/                 # W0–W5 locks (incl. image_signing)
  scripts/                # selftest-*, handoff, toolchain-*, buildroot-*, image-sign/verify
  toolchain/PINS          # W3 pinned gcc/binutils/deps
  config/buildroot/       # W4 pin, fragments, BR2_EXTERNAL, package-allowlist, host patches (+ package-dropins/)
  config/signing/         # W5 pubkey examples (private keys gitignored)
  installer/              # First-party MIT GUI disk installer (egui; from-source build)
  live-media/stamp/       # live-installer flag (stamp onto live USB only)
  payload-templates/      # mirrored runtime/install helpers
  licenses/ALLOWLIST
  docs/{METAL-INSTALL,NETWORK-HANDOFF,TOOLCHAIN-FROM-SOURCE,ROOTFS-FROM-SOURCE,KEYS-CEREMONY,IMAGE-INTEGRITY,PAYLOAD-UPDATE}.md
  payload/ out/ work/     # gitignored (work/signing-keys/, work/payload-slots/)
  tests/
```

**Disk install UX (normative):** Live media boots **first-party MIT** `eliteew-ts-installer` (network + disk wipe UI, ink/lime systemic brand, Comfy splash still as **GUI backdrop only**, session power-on `aplay` chime + smoothed extract progress with apply heartbeats). No Calamares/Anaconda GUI; no third-party prebuilt installer binaries. Product UI is **egui** (HTML `design-preview.html` is design reference only). Full Plymouth theme is **not** shipped until BR enablement. tty2–6 gettys are masked; tty1 → session-router only. A local tty2 console may be enabled only by a separate signed maintenance profile, never by the public image. Factory-flashed runtime images omit `live-installer` and boot product kiosk. **Tauri tray:** Buildroot SoT post-build bakes `libayatana-appindicator3` (+ chain) via `bake-tauri-tray-libs-into-target.sh`; the former Fedora carrier is historical evidence only. Details: [ROOTFS-FROM-SOURCE.md](../../../pack-organization/trusted-substrate/docs/ROOTFS-FROM-SOURCE.md); gaps [ELITEEW-TRUSTED-SUBSTRATE-KICKSTART-BR-GAPS.md](ELITEEW-TRUSTED-SUBSTRATE-KICKSTART-BR-GAPS.md); readiness `documentation/reference/solution-readiness/README.md` (registry retired).

**Forbidden without operator scope expansion:** editing `connection-agent/`, `kiosk-fedora-iso/`, or `pack-cloud/mobile/` “to help” substrate.

Documentation SoT (this file) lives under `documentation/product/desktop/` so desktop/org agents discover it next to FoFline/Tauri canons.

---

## 11. Maturity stages (end-state ladder — not implementation waves)

These are **definitions of done for the product**. Implementation order is waves **W0–W8** in `documentation/plans/product/desktop/ELITEEW-TRUSTED-SUBSTRATE-PLAN.md` *[operator-local process plan; gitignored — not living canon]*.

| Stage | Name | Observable “done” |
|-------|------|-------------------|
| **S0** | Canon locked | This SoT + nav wiring; no false “shipped” claims |
| **S1** | First metal | Signed-or-at-least-controlled Buildroot live medium boots on bare metal; kiosk policy; living Tauri payload starts; **no secrets in image** |
| **S2** | Controlled OS | Minimal rootfs from **EliteEW from-source factory**; own toolchain used for OS packages; WG handoff; honest offline |
| **S3** | Living shell payload | Tauri Connection Agent / FoFline is the active payload; Capsule/OTA aligned with living SoT |
| **S4** | Full trust perimeter | Web engine / residual bootstrap blobs either rebuilt from source under our toolchain **or** permanently rejected and replaced |

**Forecast hint (planning only, not a promise):** S1 in weeks if Electron payload is reused; S2 in ~1–3 months; S3 after S2 stable; S4 is multi-quarter north star.

---

## 12. Failure / Edge-Case Matrix (product-level)

| Axis | Normative behavior |
|------|--------------------|
| **Offline-mode** | Device boots; payload starts; tunnel/API failures show honest degraded UX; no silent “connected” |
| **Dual-flag / conflict** | One active payload per image profile; Electron vs Tauri conflict = **build fail**; OS update channel ≠ capsule channel (document precedence: OS slot then payload) |
| **Permission / access** | End user cannot escalate to full desktop; ops break-glass is explicit and audited; license/WG material not in public ISO |
| **Regression command** | `bash pack-organization/trusted-substrate/scripts/selftest-installer.sh` plus `selftest-policy.sh`, `selftest-w6.sh`, and the Buildroot image/QEMU gates in `documentation/plans/product/desktop/ELITEEW-TRUSTED-SUBSTRATE-PLAN.md` *[operator-local process plan; gitignored — not living canon]* |

---

## 13. Open decisions

Parked defaults and lock status live in the process plan §4 / §9: `documentation/plans/product/desktop/ELITEEW-TRUSTED-SUBSTRATE-PLAN.md` *[operator-local process plan; gitignored — not living canon]*. SoT still requires: Buildroot-or-equivalent under §6; x86_64 first; no secrets in ISO; one payload profile; Electron bootstrap honesty until W7/W8.

---

## 14. Related living canon

| Doc | Relationship |
|-----|----------------|
| [ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md](../../platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md) | Editions; client/org kinship; Electron bootstrap exception |
| `documentation/plans/product/desktop/ELITEEW-TRUSTED-SUBSTRATE-PLAN.md` *[operator-local process plan; gitignored — not living canon]* | Process plan — waves W0–W8 (SoT wins on contracts) |
| [ELITEEW-PACK-LAYOUT.md](../../platform/ELITEEW-PACK-LAYOUT.md) | Disk entrance `pack-organization/trusted-substrate/` |
| [DESKTOP-TAURI-CONNECTED-CLIENT.md](DESKTOP-TAURI-CONNECTED-CLIENT.md) | Living Tauri shell; ≠ substrate |
| [DESKTOP-FOFLINE-EDITION.md](DESKTOP-FOFLINE-EDITION.md) | Local SPA + WG product contract |
| [DESKTOP-CLIENT-SECURITY-BOUNDARIES.md](DESKTOP-CLIENT-SECURITY-BOUNDARIES.md) | Capsule / F-04 / IPC — target for Tauri payload era |
| [KIOSK-FEDORA-SERVER-ISO.md](../../platform/docker-re_doc/KIOSK-FEDORA-SERVER-ISO.md) | Parallel Fedora kiosk — do not merge |
| [PORTAL-PRIVATE-TUNNEL-EDGE.md](../../platform/docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md) | WG portal kinship |

---

## 15. Agent / operator session rules

| Focus | Open | Do not touch without ask |
|-------|------|---------------------------|
| Trusted Substrate | `documentation/product/desktop/ELITEEW-TRUSTED-SUBSTRATE.md` + `pack-organization/trusted-substrate/` | `connection-agent/` product logic, `kiosk-fedora-iso/`, `pack-cloud/mobile/` |
| Mixed with Tauri payload work | Explicit **scope expansion** | Silent cross-edits |

**Risk class for implementation:** **high** (boot, signing, supply chain). Prefer Plan Mode / readiness projection before factory code.

---

**Owner path:** `documentation/product/desktop/ELITEEW-TRUSTED-SUBSTRATE.md`  
**Next (operator):** metal + `NETWORK-HANDOFF.md` → authorize **W3**.
