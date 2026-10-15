# P5c — Single sign-on and session control

## Thesis

Entry into the work layer goes through **organization identity** (OIDC /
organization SSO). A product session is not “just opened a website”; sign-out
and access policy are set by the organization’s contour and edition.

Browser, mobile satellite, and desktop-client / FoFline each have **their own**
session and device-trust rules — detail in P7–P10. Principle here only: **one
organization account → work layer**, without handing out passwords to a dozen
SaaS tools as the normal path.

**Not in public text:** internal client ids, IdP URLs, JWT claim names.

Comparisons — [P1](01-what-is-eliteew.md); limits — [P12](12-honest-limits.md).
