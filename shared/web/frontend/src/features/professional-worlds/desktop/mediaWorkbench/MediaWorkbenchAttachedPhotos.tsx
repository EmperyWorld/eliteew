/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Attached listing photo picker for the media workbench — select, preview, remove.
 *
 * Invariants:
 * - Empty attached list shows honest empty state (no fake rows).
 * - Remove is disabled while a batch run is busy.
 *
 * Related:
 * - useProfessionalMediaWorkbench.ts
 * - SupportDetailsPanel.tsx
 */

import { ContentThumbnail } from '@/components/UnifiedContent/components/ContentThumbnail/ContentThumbnail';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
} from '@/pages/Desktop/components/DesktopAppChrome';
import type { ReactElement } from 'react';
import { SupportDetailsPanel } from '../components/SupportDetailsPanel';
import type { RealtorPropertyMedia } from '../types';
import type { ProfessionalMediaWorkbenchModel } from './useProfessionalMediaWorkbench';

type AttachedPhotosProps = {
	readonly model: Pick<
		ProfessionalMediaWorkbenchModel,
		| 't'
		| 'mediaRows'
		| 'selectedMedia'
		| 'selectedIds'
		| 'batchBusy'
		| 'toggleSelect'
		| 'handleDeleteAttachedMedia'
		| 'openPreview'
	>;
};

export function MediaWorkbenchAttachedPhotos({
	model,
}: AttachedPhotosProps): ReactElement {
	const {
		t,
		mediaRows,
		selectedMedia,
		selectedIds,
		batchBusy,
		toggleSelect,
		handleDeleteAttachedMedia,
		openPreview,
	} = model;

	return (
		<>
			<p className="text-xs text-(--desktop-text-secondary)" role="status">
				{selectedIds.length > 0
					? t('mediaWorkbench.selectedCount', { count: selectedIds.length })
					: t('mediaWorkbench.pickHint')}
			</p>
			{mediaRows.length === 0 ? (
				<DesktopAppEmptyState
					className="rounded-(--desktop-radius-xs) border border-dashed border-(--desktop-border-soft) bg-(--desktop-surface-raised)/35 py-6"
					description={t('mediaWorkbench.noAttachedPhotosHint')}
					title={t('mediaWorkbench.noAttachedPhotos')}
				/>
			) : (
				<ul className="grid gap-2">
					{mediaRows.map((row: RealtorPropertyMedia) => (
						<li
							key={row.id}
							className="flex items-center gap-3 rounded-(--desktop-radius-xs) bg-(--desktop-surface-raised) px-2 py-1"
						>
							<input
								type="checkbox"
								checked={Boolean(selectedMedia[row.unified_content_id])}
								onChange={() => toggleSelect(row.unified_content_id)}
								aria-label={t('mediaWorkbench.toggleMedia')}
							/>
							<div className="size-14 shrink-0 overflow-hidden rounded-(--desktop-radius-xxs) border border-(--desktop-border-soft)">
								<button
									type="button"
									className="size-full"
									onClick={() => {
										openPreview(
											row.unified_content_id,
											row.caption || t('mediaWorkbench.sourcePreview')
										);
									}}
								>
									<ContentThumbnail
										className="size-full object-cover"
										contentId={row.unified_content_id}
										loadingClassName="size-full"
										alt={row.caption || t('mediaWorkbench.sourcePreview')}
									/>
								</button>
							</div>
							<div className="grid flex-1 text-xs">
								<span className="text-(--desktop-text-primary)">
									{row.caption || t('mediaWorkbench.attachedPhoto')}
								</span>
								<SupportDetailsPanel className="text-(--desktop-text-muted)">
									<span className="font-mono text-[10px]">
										{t('mediaWorkbench.sourceIdLabel', {
											id: row.unified_content_id,
										})}
									</span>
								</SupportDetailsPanel>
							</div>
							<DesktopAppButton
								className="px-2! py-1! text-[11px]"
								type="button"
								variant="ghost"
								disabled={batchBusy}
								onClick={() => void handleDeleteAttachedMedia(row.id)}
							>
								{t('mediaWorkbench.removePhoto')}
							</DesktopAppButton>
						</li>
					))}
				</ul>
			)}
		</>
	);
}
