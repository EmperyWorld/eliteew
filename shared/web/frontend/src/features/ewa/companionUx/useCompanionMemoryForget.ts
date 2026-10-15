/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Confirm + API flow for forgetting one companion memory row (U6.3 / U8.3 slice 8).
 *
 * Invariants:
 * - Only rows with ``contentHash`` reach the DELETE call; dialog state lives in the hook.
 *
 * Related:
 * - src/features/ewa/CompanionMemoryForgetDialog.tsx
 * - src/services/ewa/ewaCompanionProfileApi.ts
 */

import { useCallback, useState } from 'react';
import type { TFunction } from 'i18next';

import type { CompanionMemoryStripRow } from '@/features/ewa/companionLearnedUi';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';
import { forgetEwaCompanionMemory } from '@/services/ewa/ewaCompanionProfileApi';

export type UseCompanionMemoryForgetOptions = {
	reloadProfile: () => Promise<void>;
	notifySuccess: (message: string) => void;
	notifyError: (message: string) => void;
	t: TFunction;
};

export function useCompanionMemoryForget({
	reloadProfile,
	notifySuccess,
	notifyError,
	t,
}: UseCompanionMemoryForgetOptions) {
	const [memoryForgetTarget, setMemoryForgetTarget] =
		useState<CompanionMemoryStripRow | null>(null);
	const [forgettingMemoryHash, setForgettingMemoryHash] = useState<
		string | null
	>(null);

	const handleMemoryForgetRequest = useCallback(
		(row: CompanionMemoryStripRow) => {
			setMemoryForgetTarget(row);
		},
		[]
	);

	const cancelMemoryForget = useCallback(() => {
		setMemoryForgetTarget(null);
	}, []);

	const handleMemoryForgetConfirm = useCallback(async () => {
		const row = memoryForgetTarget;
		if (!row?.contentHash) {
			setMemoryForgetTarget(null);
			return;
		}
		const hash = row.contentHash;
		setForgettingMemoryHash(hash);
		try {
			await forgetEwaCompanionMemory(hash);
			await reloadProfile();
			notifySuccess(t('ewaCompanion.memoryForgetSuccess'));
			setMemoryForgetTarget(null);
		} catch (forgetErr) {
			notifyError(t('ewaCompanion.memoryForgetFailed'));
			ewaCompanionDegradeDebug(
				'companion_memory_forget',
				'memory forget API failed',
				forgetErr
			);
		} finally {
			setForgettingMemoryHash(null);
		}
	}, [memoryForgetTarget, notifyError, notifySuccess, reloadProfile, t]);

	return {
		memoryForgetTarget,
		forgettingMemoryHash,
		handleMemoryForgetRequest,
		handleMemoryForgetConfirm,
		cancelMemoryForget,
	};
}
