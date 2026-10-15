/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Persist left-rail «auto-accept tasks» tumbler into companion ``learned_preferences.agentic_autonomy_v1``.
 *
 * Invariants:
 * - Default OFF; fail closed on PATCH error (UI stays / reverts via reload).
 * - Optimistic local state until reload; mid-session mid-ticket toggle applies via backend profile re-read.
 *
 * Related:
 * - src/services/ewa/ewaCompanionProfileApi.ts
 * - src/features/ewa/companionUx/CompanionLeftRailComposerToolsSection.tsx
 */

import { useCallback, useEffect, useState } from 'react';
import type { TFunction } from 'i18next';

import {
	EWA_COMPANION_AGENTIC_AUTONOMY_PREF_KEY,
	type EwaCompanionProfileOut,
	mergeEwaCompanionAutoAcceptTasksPref,
	patchEwaCompanionProfile,
	readEwaCompanionAutoAcceptTasksPref,
} from '@/services/ewa/ewaCompanionProfileApi';

export type UseCompanionAutoAcceptTasksToggleOptions = {
	profile: Pick<
		EwaCompanionProfileOut,
		'learned_preferences' | 'companion_revision'
	>;
	pending: boolean;
	reloadProfile: () => Promise<void>;
	onCompanionRevision?: (revision: number) => void;
	notifyError: (message: string) => void;
	t: TFunction<'marketing'>;
};

export function useCompanionAutoAcceptTasksToggle({
	profile,
	pending,
	reloadProfile,
	onCompanionRevision,
	notifyError,
	t,
}: UseCompanionAutoAcceptTasksToggleOptions) {
	const serverEnabled = readEwaCompanionAutoAcceptTasksPref(
		profile.learned_preferences
	);
	const [autoAcceptTasks, setAutoAcceptTasks] = useState(serverEnabled);
	const [autoAcceptPending, setAutoAcceptPending] = useState(false);

	useEffect(() => {
		setAutoAcceptTasks(serverEnabled);
	}, [serverEnabled]);

	const handleAutoAcceptTasksChange = useCallback(
		async (checked: boolean) => {
			if (autoAcceptPending || pending) return;
			const previous = autoAcceptTasks;
			setAutoAcceptTasks(checked);
			setAutoAcceptPending(true);
			try {
				// Shallow merge on the server: send only the autonomy blob (not the full learned map).
				const merged = mergeEwaCompanionAutoAcceptTasksPref(
					profile.learned_preferences,
					checked
				);
				const out = await patchEwaCompanionProfile({
					learned_preferences: {
						[EWA_COMPANION_AGENTIC_AUTONOMY_PREF_KEY]:
							merged[EWA_COMPANION_AGENTIC_AUTONOMY_PREF_KEY],
					},
					expect_revision: profile.companion_revision,
				});
				onCompanionRevision?.(out.companion_revision);
				await reloadProfile();
			} catch {
				setAutoAcceptTasks(previous);
				notifyError(t('ewaCompanion.autoAcceptTasksSaveFailed'));
			} finally {
				setAutoAcceptPending(false);
			}
		},
		[
			autoAcceptPending,
			autoAcceptTasks,
			notifyError,
			onCompanionRevision,
			pending,
			profile.companion_revision,
			profile.learned_preferences,
			reloadProfile,
			t,
		]
	);

	return {
		autoAcceptTasks,
		autoAcceptPending,
		handleAutoAcceptTasksChange,
	};
}
