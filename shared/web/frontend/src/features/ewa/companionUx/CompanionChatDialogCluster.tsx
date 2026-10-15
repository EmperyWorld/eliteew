/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Modal cluster for quick-preset label/delete and memory forget dialogs (U8.3 slice 13).
 *
 * Invariants:
 * - Parent owns dialog state and API side effects; cluster only wires presentational dialogs.
 *
 * Related:
 * - src/features/ewa/CompanionQuickPresetLabelDialog.tsx
 * - src/features/ewa/companionUx/useCompanionMemoryForget.ts
 */

import type { RefObject } from 'react';

import type { CompanionQuickPresetChip } from '@/features/ewa/ewaCompanionQuickPresetsUi';
import type { CompanionQuickPresetLabelDialogState } from '@/features/ewa/companionQuickPresetDialogTypes';
import { CompanionMemoryForgetDialog } from '@/features/ewa/CompanionMemoryForgetDialog';
import { CompanionQuickPresetDeleteDialog } from '@/features/ewa/CompanionQuickPresetDeleteDialog';
import { CompanionQuickPresetLabelDialog } from '@/features/ewa/CompanionQuickPresetLabelDialog';
import type { CompanionMemoryStripRow } from '@/features/ewa/companionLearnedUi';

export type CompanionChatDialogClusterProps = {
	quickPresetLabelDialog: CompanionQuickPresetLabelDialogState | null;
	quickPresetLabelInputRef: RefObject<HTMLInputElement | null>;
	onQuickPresetLabelValueChange: (value: string) => void;
	onCloseQuickPresetLabelDialog: () => void;
	onQuickPresetLabelConfirm: () => void;
	quickPresetDeleteTarget: CompanionQuickPresetChip | null;
	onCancelQuickPresetDelete: () => void;
	onConfirmQuickPresetDelete: () => void;
	memoryForgetTarget: CompanionMemoryStripRow | null;
	onCancelMemoryForget: () => void;
	onConfirmMemoryForget: () => void;
};

export function CompanionChatDialogCluster({
	quickPresetLabelDialog,
	quickPresetLabelInputRef,
	onQuickPresetLabelValueChange,
	onCloseQuickPresetLabelDialog,
	onQuickPresetLabelConfirm,
	quickPresetDeleteTarget,
	onCancelQuickPresetDelete,
	onConfirmQuickPresetDelete,
	memoryForgetTarget,
	onCancelMemoryForget,
	onConfirmMemoryForget,
}: CompanionChatDialogClusterProps) {
	return (
		<>
			{quickPresetLabelDialog ? (
				<CompanionQuickPresetLabelDialog
					state={quickPresetLabelDialog}
					inputRef={quickPresetLabelInputRef}
					onValueChange={onQuickPresetLabelValueChange}
					onCancel={onCloseQuickPresetLabelDialog}
					onConfirm={onQuickPresetLabelConfirm}
				/>
			) : null}
			{quickPresetDeleteTarget ? (
				<CompanionQuickPresetDeleteDialog
					label={quickPresetDeleteTarget.label}
					onCancel={onCancelQuickPresetDelete}
					onConfirm={onConfirmQuickPresetDelete}
				/>
			) : null}
			{memoryForgetTarget ? (
				<CompanionMemoryForgetDialog
					label={memoryForgetTarget.label}
					onCancel={onCancelMemoryForget}
					onConfirm={onConfirmMemoryForget}
				/>
			) : null}
		</>
	);
}
