/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single boot-phase store for entry orchestration (branding → auth → workspace sync → ready).
 *
 * Invariants:
 * - Phases only move forward during a page session unless `resetBootstrappingState` is called.
 * - Subscribers use `useSyncExternalStore` or direct subscribe — no React context jitter.
 *
 * Related:
 * - `components/KeycloakInit.tsx`, `components/IdentityVerificationGate.tsx`
 * - `services/boot/bootPerformance.ts`
 */

export const BootstrappingPhase = {
	BRANDING: 'BRANDING',
	AUTHENTICATING: 'AUTHENTICATING',
	SYNCING_WORKSPACE: 'SYNCING_WORKSPACE',
	READY: 'READY',
} as const;

export type BootstrappingPhase =
	(typeof BootstrappingPhase)[keyof typeof BootstrappingPhase];

const PHASE_ORDER: BootstrappingPhase[] = [
	BootstrappingPhase.BRANDING,
	BootstrappingPhase.AUTHENTICATING,
	BootstrappingPhase.SYNCING_WORKSPACE,
	BootstrappingPhase.READY,
];

type Listener = () => void;

let currentPhase: BootstrappingPhase = BootstrappingPhase.BRANDING;
const listeners = new Set<Listener>();

function phaseRank(phase: BootstrappingPhase): number {
	return PHASE_ORDER.indexOf(phase);
}

function notify(): void {
	for (const listener of listeners) {
		listener();
	}
}

export function getBootstrappingPhase(): BootstrappingPhase {
	return currentPhase;
}

export function subscribeBootstrappingPhase(listener: Listener): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** Advance only forward — never regress without explicit reset. */
export function setBootstrappingPhase(next: BootstrappingPhase): void {
	if (phaseRank(next) < phaseRank(currentPhase)) {
		return;
	}
	if (currentPhase === next) {
		return;
	}
	currentPhase = next;
	notify();
}

export function resetBootstrappingState(): void {
	currentPhase = BootstrappingPhase.BRANDING;
	notify();
}
