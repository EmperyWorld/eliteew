/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Persist left-rail «Созерцание» tumbler into ``learned_preferences.companion_presence_v1``.
 *
 * Invariants:
 * - Contemplation ON ⇒ mode ``contemplation``; OFF ⇒ ``chat`` (sticky until explicit leave).
 * - Fail closed on PATCH error (revert optimistic UI).
 *
 * Related:
 * - src/services/ewa/ewaCompanionProfileApi.ts
 * - documentation/product/ewa/EWA-COMPANION-CONTINUITY-PRESENCE-CAUSE-ROADMAP.md
 */

import { useCallback, useEffect, useState } from 'react';
import type { TFunction } from 'i18next';

import {
	EWA_COMPANION_PRESENCE_PREF_KEY,
	type EwaCompanionProfileOut,
	mergeEwaCompanionPresenceModePref,
	patchEwaCompanionProfile,
	readEwaCompanionPresenceMode,
} from '@/services/ewa/ewaCompanionProfileApi';

export type UseCompanionContemplationToggleOptions = {
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

export function useCompanionContemplationToggle({
	profile,
	pending,
	reloadProfile,
	onCompanionRevision,
	notifyError,
	t,
}: UseCompanionContemplationToggleOptions) {
	const serverOn =
		readEwaCompanionPresenceMode(profile.learned_preferences) ===
		'contemplation';
	const [contemplationOn, setContemplationOn] = useState(serverOn);
	const [contemplationPending, setContemplationPending] = useState(false);

	useEffect(() => {
		setContemplationOn(serverOn);
	}, [serverOn]);

	const handleContemplationChange = useCallback(
		async (checked: boolean) => {
			if (contemplationPending || pending) return;
			const previous = contemplationOn;
			setContemplationOn(checked);
			setContemplationPending(true);
			try {
				const mode = checked ? 'contemplation' : 'chat';
				const merged = mergeEwaCompanionPresenceModePref(
					profile.learned_preferences,
					mode
				);
				const out = await patchEwaCompanionProfile({
					learned_preferences: {
						[EWA_COMPANION_PRESENCE_PREF_KEY]:
							merged[EWA_COMPANION_PRESENCE_PREF_KEY],
					},
					expect_revision: profile.companion_revision,
				});
				onCompanionRevision?.(out.companion_revision);
				await reloadProfile();
			} catch {
				setContemplationOn(previous);
				notifyError(t('ewaCompanion.contemplationSaveFailed'));
			} finally {
				setContemplationPending(false);
			}
		},
		[
			contemplationOn,
			contemplationPending,
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
		contemplationOn,
		contemplationPending,
		handleContemplationChange,
	};
}
