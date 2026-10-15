# EWA observer content hints: extension policy

This is a normative policy for extending observer hints with Unified Content, documents or domain-driver context. It does not claim that every current hint path has been audited against every rule below. The existing observer behavior is described in [the proactive observer reference](EWA-COMPANION-PROACTIVE-OBSERVER.md).

## Required boundaries

1. Keep the hint layer read-only. Include only identifiers/content already authorized for the current principal in runtime context; exclude raw filesystem paths and unrelated internal ids.
2. Redact by default. Normalize domain data using [domain hint contracts](../../../shared/api/ewa_platform/contracts/domain_hints_wire.py) and the shared wire limits. Do not inject large extracted-text passages as unbounded hints.
3. Reuse object/catalog and tenant/organization authorization. A hint must not create a second route around a deny decision; denied objects must not be mentioned through this extension.
4. Preserve source traceability in engineering logs (episodic retrieval, rollup or domain hint) while keeping internal API keys/identifiers out of user-facing text.

## Extension and evidence

[build_anticipation_hint](../../../shared/api/ewa_platform/companion/persona/anticipation.py) is the existing anticipation entry. Adding domain text requires an explicit allowlisted field selection before that text reaches the hint. The presence of a domain driver alone does not establish an authorized observer-content integration.

Every new text path needs a behavioral regression covering empty/redacted data and confirming that the user response remains usable. Also verify the intended permission boundary and size caps. These are extension requirements, not a report that such tests already exist for every possible driver.

Related: [driver boundaries](../../../shared/api/ewa_platform/docs/DRIVERS-ROADMAP.md), [policy/model flow](../../../shared/api/ewa_platform/docs/POLICY-LLM-MATRIX.md), [desktop HTTP contract](../../../shared/api/ewa_platform/docs/DESKTOP-ORCHESTRATION.md).
