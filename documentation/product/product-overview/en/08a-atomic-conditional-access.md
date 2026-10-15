# P8a — Atomic Conditional Access

**Diagram:** [D07](../assets/diagrams/D07-atomic-access.md)

## Invariant (overview language)

For **native** Connected and FoFline clients, product entry is gated on:

```text
identity confirmed
  ∧ entitlement active
  ∧ channel allowed
  ∧ device / key proof present
  ∧ account binding consistent
→ access allowed
```

Refusal uses a general user-facing wording (no detailed external oracle);
detail stays in protected audit.

## Honest boundaries

| In atomic scope (current program) | Outside v1 / separate |
|----------------------------------|-----------------------|
| Native Connected and FoFline clients | Ordinary organization browser SPA |
| Enforce on the cloud contour for those clients | Mobile SSO as the only factor |
| Offline-only seat — local entitlement without OIDC | “Absolute impossibility of bypass” |

**Not promised:** atomic replaces a firewall · atomic already on every HTTP request
of every client worldwide · browser entry “removed forever for everyone.”

*(Internal OIDC client ids stay out of public text.)*

Comparisons — [P1](01-what-is-eliteew.md); limits — [P12](12-honest-limits.md).
