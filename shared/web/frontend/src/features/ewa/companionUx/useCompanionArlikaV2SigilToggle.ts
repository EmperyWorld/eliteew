/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Arlika v2 sigil toggle + transform video trigger (U8.3 slice 12 extract from `EwaCompanionChatPanel`).
 *
 * Invariants:
 * - No-op when toggle is blocked, already switching, or chat turn is pending.
 *
 * Related:
 * - src/features/ewa/companionArlikaV2Mode.ts
 * - src/features/ewa/useCompanionTransformVideo.ts
 */

import { useCallback, useState } from 'react';
import type { TFunction } from 'i18next';

import {
	arlikaV2SigilToggleTarget,
	canToggleArlikaV2ModeViaSigil,
} from '@/features/ewa/companionArlikaV2Mode';
import type { EwaCompanionProfileOut } from '@/services/ewa/ewaCompanionProfileApi';
import { toggleEwaCompanionArlikaV2Mode } from '@/services/ewa/ewaCompanionProfileApi';
import { APIError } from '@/services/api/client';

export type UseCompanionArlikaV2SigilToggleOptions = {
	profile: Pick<EwaCompanionProfileOut, 'seed_persona_id' | 'baseline'>;
	pending: boolean;
	reloadProfile: () => Promise<void>;
	onCompanionRevision?: (revision: number) => void;
	showCompanionTransformVideo: (kind?: string | null) => void;
	notifyError: (message: string) => void;
	t: TFunction<'marketing'>;
};

export function useCompanionArlikaV2SigilToggle({
	profile,
	pending,
	reloadProfile,
	onCompanionRevision,
	showCompanionTransformVideo,
	notifyError,
	t,
}: UseCompanionArlikaV2SigilToggleOptions) {
	const [arlikaV2ModeSwitching, setArlikaV2ModeSwitching] = useState(false);

	const canToggleArlikaV2Sigil = canToggleArlikaV2ModeViaSigil(profile);
	const arlikaV2SigilTarget = arlikaV2SigilToggleTarget(profile);
	const arlikaV2SigilLabel =
		arlikaV2SigilTarget === 'arlika_v2'
			? t('ewaCompanion.arlikaV2SigilToggleToFriend')
			: t('ewaCompanion.arlikaV2SigilToggleToCompanion');

	const handleArlikaV2SigilToggle = useCallback(async () => {
		if (!canToggleArlikaV2Sigil || arlikaV2ModeSwitching || pending) return;
		setArlikaV2ModeSwitching(true);
		try {
			const out = await toggleEwaCompanionArlikaV2Mode();
			if (out.transform_event_kind) {
				showCompanionTransformVideo(out.transform_event_kind);
			}
			onCompanionRevision?.(out.companion_revision);
			await reloadProfile();
		} catch (e) {
			const detail =
				e instanceof APIError ? String(e.message || e.errorCode || '') : '';
			if (detail.includes('arlika_v1_active_calm_first')) {
				notifyError(t('ewaCompanion.arlikaV2SigilToggleBlockedV1'));
			} else {
				notifyError(t('ewaCompanion.arlikaV2SigilToggleFailed'));
			}
		} finally {
			setArlikaV2ModeSwitching(false);
		}
	}, [
		arlikaV2ModeSwitching,
		canToggleArlikaV2Sigil,
		notifyError,
		onCompanionRevision,
		pending,
		reloadProfile,
		showCompanionTransformVideo,
		t,
	]);

	return {
		canToggleArlikaV2Sigil,
		arlikaV2SigilLabel,
		arlikaV2ModeSwitching,
		handleArlikaV2SigilToggle,
	};
}
