/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin modal shell for UGS Admin v2 provider bulk edit — composes state hook and form body.
 *
 * Invariants:
 * - Does not apply changes directly; only builds operations for validate/apply confirmation flow.
 * - Named export `ProvidersBulkEditModal` preserved for ProvidersTabV2 and guardrail tests.
 *
 * Related:
 * - src/features/ugs/admin-v2/tabs/ProvidersTabV2.tsx
 * - src/features/ugs/admin-v2/components/ProvidersBulkEditForm.tsx
 * - src/features/ugs/admin-v2/hooks/useProvidersBulkEditState.ts
 */

import * as React from 'react';

import { Modal } from '@/features/ugs/shared/ugsAdminUi';
import type {
	UgsAdminV2BulkOperation,
	UgsAdminV2SnapshotDTO,
} from '@/services/api/ugsAdminV2';

import { ProvidersBulkEditForm } from './ProvidersBulkEditForm';
import { useProvidersBulkEditState } from '../hooks/useProvidersBulkEditState';

export function ProvidersBulkEditModal({
	open,
	snapshot,
	targetProviderNames,
	autoScanModels = false,
	onAutoScanModelsConsumed,
	onClose,
	onConfirm,
}: {
	open: boolean;
	snapshot: UgsAdminV2SnapshotDTO;
	targetProviderNames: string[];
	autoScanModels?: boolean;
	onAutoScanModelsConsumed?: () => void;
	onClose: () => void;
	onConfirm: (ops: UgsAdminV2BulkOperation[]) => void;
}): React.ReactElement {
	const formState = useProvidersBulkEditState({
		open,
		snapshot,
		targetProviderNames,
		autoScanModels,
		onAutoScanModelsConsumed,
		onConfirm,
	});

	return (
		<Modal
			open={open}
			title={formState.t('bulkEditProviders.title')}
			onClose={onClose}
			size="xl"
		>
			<ProvidersBulkEditForm {...formState} onClose={onClose} />
		</Modal>
	);
}
