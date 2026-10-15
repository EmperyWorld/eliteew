# EWA proactive automation: product and execution policy

This document defines requirements for future or expanded proactive desktop actions, such as opening apps, arranging windows or preparing a layout. It is a policy; it does not assert that a complete opt-in autonomous execution system is deployed. Current hint behavior is described in [the observer reference](EWA-COMPANION-PROACTIVE-OBSERVER.md).

## Requirements before automatic execution

1. Require explicit user opt-in through settings/onboarding, separate from operator feature flags. Absence of refusal is not consent; avoid negative-option interaction patterns.
2. Evaluate a bounded action plan before executing it, reusing applicable simulation patterns. Cover application fan-out, rate limits and shell/theme/wallpaper/config patch limits. An existing simulation helper does not prove every proactive action passes through it.
3. Keep an audit trail at least as informative as allowlisted chat actions (`companion_actions_log_v1`). Quiet preparation needs a distinguishable orchestration event type rather than disappearing from the journal.

## Tool capability boundary

Do not extend proactive capabilities to arbitrary terminal/shell/script execution before a security review and tenant-specific domain-command allowlist. Document each new capability in living companion references and the implemented allowlist. The historical desktop-actions ADR was previously soft-retired; use [the current action catalog](../../../shared/api/ewa_platform/docs/EWA-APP-DRIVER-CATALOG.md) and source rather than recreating an archive as current canon.

## User-facing language

Public product/settings/security text must not state consciousness, an AGI comparison or subjective experience as established biography or science. Creative brand/seed literature may use clearly editorial metaphors under [the brand policy](EWA-BRAND-AND-PHILOSOPHY.md). Describe affective/trust/episodic routing as ranking, tone and behavior rules with observable inputs and limits.

Related: [persona vision](EWA-COMPANION-PERSONA-VISION.md), [proactive protocol](EWA-COMPANION-PROACTIVE-PROTOCOL.md), [desktop orchestration](../../../shared/api/ewa_platform/docs/DESKTOP-ORCHESTRATION.md), [content-hint policy](EWA-OBSERVER-CONTENT-HINTS-SAFETY.md). This policy review retains its requirements; runtime enforcement must be checked at the specific execution path.
