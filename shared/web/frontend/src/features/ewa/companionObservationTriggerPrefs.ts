/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Client mirror for companion observation trigger prefs (idle / focus-app) with localStorage cache
 * and server sync via companion-user-workflows API.
 *
 * Related:
 * - CompanionWorkflowObservationSettings.tsx
 * - useEwaCompanionAnticipationTick.ts
 */

import type { CompanionObservationRequest } from '@/services/ewa/ewaCompanionChatApi';
import {
	fetchCompanionUserWorkflowObservationTriggers,
	patchCompanionUserWorkflowObservationTriggers,
} from '@/services/ewa/companionUserWorkflowsApi';

export type CompanionObservationTriggerPrefs = {
	idleEnabled: boolean;
	focusAppEnabled: boolean;
};

const KEY_PREFIX = 'eliteew.companion.observationTriggers.v1:';

export const DEFAULT_COMPANION_OBSERVATION_TRIGGER_PREFS: CompanionObservationTriggerPrefs =
	{
		idleEnabled: true,
		focusAppEnabled: true,
	};

export function readLocalObservationTriggerPrefs(
	principalId: string
): CompanionObservationTriggerPrefs {
	if (typeof window === 'undefined' || !principalId.trim()) {
		return DEFAULT_COMPANION_OBSERVATION_TRIGGER_PREFS;
	}
	try {
		const raw = window.localStorage.getItem(`${KEY_PREFIX}${principalId}`);
		if (!raw) return DEFAULT_COMPANION_OBSERVATION_TRIGGER_PREFS;
		const parsed = JSON.parse(raw) as Partial<CompanionObservationTriggerPrefs>;
		return {
			idleEnabled: parsed.idleEnabled !== false,
			focusAppEnabled: parsed.focusAppEnabled !== false,
		};
	} catch {
		return DEFAULT_COMPANION_OBSERVATION_TRIGGER_PREFS;
	}
}

export function writeLocalObservationTriggerPrefs(
	principalId: string,
	prefs: CompanionObservationTriggerPrefs
): void {
	if (typeof window === 'undefined' || !principalId.trim()) return;
	try {
		window.localStorage.setItem(
			`${KEY_PREFIX}${principalId}`,
			JSON.stringify(prefs)
		);
	} catch {
		/* best-effort */
	}
}

export function observationTriggerAllowed(
	trigger: CompanionObservationRequest['trigger'],
	prefs: CompanionObservationTriggerPrefs
): boolean {
	if (trigger === 'idle') return prefs.idleEnabled;
	return prefs.focusAppEnabled;
}

export async function loadObservationTriggerPrefs(
	principalId: string
): Promise<CompanionObservationTriggerPrefs> {
	const fallback = readLocalObservationTriggerPrefs(principalId);
	try {
		const server = await fetchCompanionUserWorkflowObservationTriggers();
		const prefs: CompanionObservationTriggerPrefs = {
			idleEnabled: server.idle_enabled,
			focusAppEnabled: server.focus_app_enabled,
		};
		writeLocalObservationTriggerPrefs(principalId, prefs);
		return prefs;
	} catch {
		return fallback;
	}
}

export async function saveObservationTriggerPrefs(
	principalId: string,
	patch: Partial<CompanionObservationTriggerPrefs>
): Promise<CompanionObservationTriggerPrefs> {
	const current = readLocalObservationTriggerPrefs(principalId);
	const next: CompanionObservationTriggerPrefs = {
		idleEnabled: patch.idleEnabled ?? current.idleEnabled,
		focusAppEnabled: patch.focusAppEnabled ?? current.focusAppEnabled,
	};
	writeLocalObservationTriggerPrefs(principalId, next);
	try {
		const server = await patchCompanionUserWorkflowObservationTriggers({
			idle_enabled: next.idleEnabled,
			focus_app_enabled: next.focusAppEnabled,
		});
		const synced: CompanionObservationTriggerPrefs = {
			idleEnabled: server.idle_enabled,
			focusAppEnabled: server.focus_app_enabled,
		};
		writeLocalObservationTriggerPrefs(principalId, synced);
		return synced;
	} catch {
		return next;
	}
}
