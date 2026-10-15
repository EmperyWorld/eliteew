/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public frontend feature boundary for EWA platform (desktop companion, desk orchestration UI, shell hints).
 *
 * Invariants:
 * - Marketing Cabinet AMKA UI lives under `src/features/amka/` — not re-exported here.
 * - Desktop shell imports should prefer this boundary over deep paths into companion submodules.
 *
 * Related:
 * - src/features/ewa/EwaDesktopApp.tsx
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 * - src/features/ewa/ewaShellHints.ts
 * - src/hooks/api/useAmka.ts (`useEwaDesktopOrchestrationTurn`)
 */
export {
	EWA_SHELL_HINTS_SUBTREE_KEY,
	type EwaShellHintsSubtreeV1,
	patchEwaShellHintsSubtree,
	type DesktopShellStatePatchWithEwaHints,
} from './ewaShellHints';
export { mergeEwaShellHintsForPersistedWindows } from './ewaShellHintsDerive';
export { EwaDesktopView } from './EwaDesktopView';
export { EwaDesktopApp } from './EwaDesktopApp';
export { EwaCompanionChatPanel } from './EwaCompanionChatPanel';
export {
	DEFAULT_EWA_PERSONA_ID,
	normalizeEwaPersonaId,
	type EwaPersonaId,
} from './ewaPersonaCatalog';
export { useEwaDesktopOrchestrationTurn } from '@/hooks/api/useAmka';
