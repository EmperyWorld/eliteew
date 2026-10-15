/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Professional Worlds runtime bridge around the shared Unified Content picker (multi or single asset selection).
 *
 * Invariants:
 * - Selected assets stay represented by Unified Content ids; this component does not copy or mutate file records.
 * - Picker filtering is delegated to Unified Content so runtime modules share one content source of truth.
 * - Optional `embedded` uses `ProfessionalWorldsWorkspacePanel` body-only mode when nested inside another panel.
 * - Primary choose control exposes `aria-describedby` bound to the helper copy for assistive tech.
 *
 * Related:
 * - components/UnifiedContent/picker/UnifiedContentPickerModal.tsx
 * - ProfessionalWorldsApp.tsx
 */

import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { UnifiedContentPickerModal } from '@/components/UnifiedContent/picker/UnifiedContentPickerModal';
import type { Content } from '@/components/UnifiedContent/types';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppSectionLabel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import type { ContentListQuery } from '@/services/contentApi';
import type { ContentType as ContentTypeT } from '@/types/fileExchange';

import { ProfessionalWorldsWorkspacePanel } from './layout';
import { SupportDetailsPanel } from './components/SupportDetailsPanel';
import {
	userFacingContentTypeLabel,
	userFacingProcessingStatusLabel,
} from './userFacingContentLabels';

export interface UnifiedContentPickerSelection {
	items: Content[];
	ids: string[];
}

function contentLabel(item: Content): string {
	return item.title || item.name || item.id;
}

function SelectedAssetsList({ items }: { items: Content[] }) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);

	return (
		<div className="grid gap-2">
			{items.map((item) => {
				const processingLabel = userFacingProcessingStatusLabel(
					t,
					item.processing_status
				);
				return (
					<div
						key={item.id}
						className="flex min-w-0 items-center justify-between gap-3 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2"
					>
						<div className="min-w-0">
							<strong className="block truncate text-sm text-(--desktop-text-primary)">
								{contentLabel(item)}
							</strong>
							<p className="truncate text-xs text-(--desktop-text-secondary)">
								{userFacingContentTypeLabel(t, item.content_type)}
							</p>
							<SupportDetailsPanel>
								<span className="font-mono text-[10px]">
									{t('shared.fileIdLabel', { id: item.id })}
								</span>
							</SupportDetailsPanel>
						</div>
						{processingLabel ? (
							<span className="shrink-0 rounded-full bg-black/25 px-2 py-1 text-[11px] text-(--desktop-text-secondary)">
								{processingLabel}
							</span>
						) : null}
					</div>
				);
			})}
		</div>
	);
}

export function UnifiedContentPickerBridge({
	selectedItems,
	onChange,
	title = 'Media library',
	description = 'Pick files you already uploaded to attach them here.',
	pickerTitle = 'Choose files',
	confirmLabel = 'Use selected files',
	buttonLabel = 'Choose from library',
	emptyTitle = 'No files selected',
	emptyDescription = 'Open the library and pick files to attach them to this step.',
	mode = 'multi',
	maxFiles = 10,
	allowedContentTypes,
	baseListParams,
	disabled = false,
	embedded = false,
}: {
	selectedItems: Content[];
	onChange: (selection: UnifiedContentPickerSelection) => void;
	title?: string;
	description?: string;
	pickerTitle?: string;
	confirmLabel?: string;
	buttonLabel?: string;
	emptyTitle?: string;
	emptyDescription?: string;
	mode?: 'multi' | 'single';
	maxFiles?: number;
	allowedContentTypes?: readonly ContentTypeT[];
	baseListParams?: ContentListQuery;
	disabled?: boolean;
	/** When true, omit outer panel chrome (nested inside another workspace panel). */
	embedded?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const chooseDescriptionId = useId();

	function handleConfirm(items: Content[]) {
		onChange({
			items,
			ids: items.map((item) => item.id),
		});
	}

	const chooseButton = (
		<DesktopAppButton
			disabled={disabled}
			onClick={() => setOpen(true)}
			type="button"
			aria-describedby={chooseDescriptionId}
		>
			{buttonLabel}
		</DesktopAppButton>
	);

	const selectionBlock =
		selectedItems.length === 0 ? (
			<DesktopAppEmptyState title={emptyTitle} description={emptyDescription} />
		) : (
			<SelectedAssetsList items={selectedItems} />
		);

	return (
		<ProfessionalWorldsWorkspacePanel
			embedded={embedded}
			title={embedded ? undefined : title}
			className={embedded ? undefined : 'grid gap-4 p-4'}
		>
			{embedded ? (
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<DesktopAppSectionLabel>{title}</DesktopAppSectionLabel>
						<p
							id={chooseDescriptionId}
							className="mt-1 text-xs text-(--desktop-text-secondary)"
						>
							{description}
						</p>
					</div>
					{chooseButton}
				</div>
			) : (
				<>
					<p
						id={chooseDescriptionId}
						className="text-xs text-(--desktop-text-secondary)"
					>
						{description}
					</p>
					<div className="flex flex-wrap justify-end">{chooseButton}</div>
				</>
			)}
			{selectionBlock}
			<UnifiedContentPickerModal
				open={open}
				onClose={() => setOpen(false)}
				onConfirm={handleConfirm}
				title={pickerTitle}
				confirmLabel={confirmLabel}
				mode={mode}
				maxFiles={maxFiles}
				allowedContentTypes={allowedContentTypes}
				baseListParams={baseListParams}
				compact
				layout="split"
			/>
		</ProfessionalWorldsWorkspacePanel>
	);
}
