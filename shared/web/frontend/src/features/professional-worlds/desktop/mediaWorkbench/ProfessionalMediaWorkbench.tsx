/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Professional Worlds media cockpit compose: wires hook state into attached
 * photos, batch progress, albums, brand kit, and modals.
 *
 * Invariants:
 * - Single-listing (`targetId` + `contextType`) UX; drafts never auto-publish.
 * - Consultant context shows honest unavailable empty state (no realtor APIs).
 * - Renders as `ProfessionalWorldsWorkspacePanel` `embedded`.
 *
 * Related:
 * - ../ProfessionalMediaWorkbench.tsx (stable import facade)
 * - media/realtorMediaAdapter.ts
 * - documentation/product/PROFESSIONAL-WORLDS.md
 */

import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppInput,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';
import type { ReactElement } from 'react';
import { ProfessionalWorldsWorkspacePanel } from '../layout';
import { photoPresetDisplayName } from '../photoPresetDisplay';
import { MediaWorkbenchAlbumsPanel } from './MediaWorkbenchAlbumsPanel';
import { MediaWorkbenchAttachedPhotos } from './MediaWorkbenchAttachedPhotos';
import { MediaWorkbenchBatchProgress } from './MediaWorkbenchBatchProgress';
import { MediaWorkbenchBrandKitPanel } from './MediaWorkbenchBrandKitPanel';
import { MediaWorkbenchModals } from './MediaWorkbenchModals';
import type { ProfessionalMediaWorkbenchProps } from './types';
import { useProfessionalMediaWorkbench } from './useProfessionalMediaWorkbench';

export function ProfessionalMediaWorkbench(
	props: ProfessionalMediaWorkbenchProps
): ReactElement {
	const model = useProfessionalMediaWorkbench(props);
	const {
		t,
		contextType,
		presetOptions,
		batchPreset,
		setBatchPreset,
		batchInstruction,
		setBatchInstruction,
		batchBusy,
		selectedIds,
		runBatchFlow,
	} = model;

	if (contextType === 'consultant') {
		return (
			<ProfessionalWorldsWorkspacePanel
				embedded
				title={t('mediaWorkbench.sectionTitle')}
			>
				<DesktopAppEmptyState
					className="rounded-(--desktop-radius-xs) border border-dashed border-(--desktop-border-soft) bg-(--desktop-surface-raised)/35 py-6"
					description={t('mediaWorkbench.contextUnavailableDescription')}
					title={t('mediaWorkbench.contextUnavailableTitle')}
				/>
			</ProfessionalWorldsWorkspacePanel>
		);
	}

	return (
		<ProfessionalWorldsWorkspacePanel
			embedded
			title={t('mediaWorkbench.sectionTitle')}
		>
			<div className="rounded-(--desktop-radius-xs) border border-(--desktop-border-soft) bg-(--desktop-surface-raised)/45 p-3 text-xs text-(--desktop-text-secondary)">
				<p className="font-medium text-(--desktop-text-primary)">
					{t('mediaWorkbench.flowTitle')}
				</p>
				<ol className="mt-2 list-decimal space-y-1 pl-4">
					<li>{t('mediaWorkbench.flowStep1')}</li>
					<li>{t('mediaWorkbench.flowStep2')}</li>
					<li>{t('mediaWorkbench.flowStep3')}</li>
				</ol>
			</div>
			<div className="grid gap-2 md:grid-cols-[1fr_16rem_auto] md:items-end">
				<DesktopNativeSelect
					value={batchPreset}
					onChange={(e) => setBatchPreset(e.target.value)}
					disabled={batchBusy}
				>
					{presetOptions.map((preset) => (
						<option key={preset.preset_key} value={preset.preset_key}>
							{photoPresetDisplayName(preset, t)}
						</option>
					))}
				</DesktopNativeSelect>
				<DesktopAppInput
					value={batchInstruction}
					disabled={batchBusy}
					onChange={(e) => setBatchInstruction(e.target.value)}
					placeholder={t('mediaWorkbench.instruction')}
				/>
				<div className="flex flex-wrap gap-2 md:justify-end">
					<DesktopAppButton
						disabled={batchBusy || !selectedIds.length || !batchPreset.trim()}
						onClick={() => void runBatchFlow()}
					>
						{batchBusy
							? t('mediaWorkbench.runningNow')
							: t('mediaWorkbench.runNow')}
					</DesktopAppButton>
				</div>
			</div>
			<MediaWorkbenchAttachedPhotos model={model} />
			<MediaWorkbenchBatchProgress model={model} />
			<div className="grid gap-2 md:grid-cols-2 md:gap-4">
				<MediaWorkbenchAlbumsPanel model={model} />
				<MediaWorkbenchBrandKitPanel model={model} />
			</div>
			<MediaWorkbenchModals model={model} />
		</ProfessionalWorldsWorkspacePanel>
	);
}
