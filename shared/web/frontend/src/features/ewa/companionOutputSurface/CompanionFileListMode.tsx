/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Interactive EwaFile list inside companion output surface; clicking a row opens that file in embedded document mode.
 *
 * Invariants:
 * - Listing rows do not open Content Manager automatically.
 * - Row click only switches output-surface mode; document loading/persistence stays in `CompanionDocumentEditorMode`.
 * - Empty results are announced politely; file rows expose an explicit "open here" accessible action label.
 *
 * Related:
 * - companionFileListSurfaceUi.ts
 * - CompanionDocumentEditorMode.tsx
 */

import { DocumentTextIcon } from '@heroicons/react/24/outline';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { CompanionSurfacePanel } from '@/features/ewa/companionOutputSurface/CompanionSurfacePanel';
import {
	COMPANION_SURFACE_LABEL_CLASS,
	COMPANION_SURFACE_SECTION_CLASS,
} from '@/features/ewa/companionOutputSurface/companionSurfaceUi';
import { coerceCompanionFileListSurfacePayload } from '@/features/ewa/companionOutputSurface/companionFileListSurfaceUi';
import type { CompanionOutputSurfaceState } from '@/features/ewa/companionOutputSurface/types';
import {
	DesktopAppButton,
	DESKTOP_CHROME_FOCUS_VISIBLE,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

type Props = {
	payload?: Record<string, unknown>;
	onBackToChat: () => void;
	onOpenFile: (next: CompanionOutputSurfaceState) => void;
};

export function CompanionFileListMode({
	payload,
	onBackToChat,
	onOpenFile,
}: Props) {
	const { t } = useTranslation('marketing');
	const list = useMemo(
		() => coerceCompanionFileListSurfacePayload(payload),
		[payload]
	);
	const subtitle = list.query
		? t('ewaCompanion.fileListSurfaceSubtitleSearch', {
				count: list.rowCount,
				query: list.query,
			})
		: t('ewaCompanion.fileListSurfaceSubtitleBrowse', {
				count: list.rowCount,
			});

	return (
		<CompanionSurfacePanel
			title={t('ewaCompanion.fileListSurfaceTitle')}
			subtitle={subtitle}
			onBack={onBackToChat}
			backLabel={t('ewaCompanion.outputSurfaceBackToChat')}
			testId="ewa-companion-file-list-surface"
		>
			<section className={COMPANION_SURFACE_SECTION_CLASS}>
				<div className="mb-2 flex items-center justify-between gap-2">
					<p className={COMPANION_SURFACE_LABEL_CLASS}>
						{t('ewaCompanion.fileListSurfaceClickHint')}
					</p>
				</div>
				{list.items.length === 0 ? (
					<p
						className="py-6 text-center text-[13px] text-(--companion-text-soft)"
						role="status"
						aria-live="polite"
					>
						{t('ewaCompanion.fileListSurfaceEmpty')}
					</p>
				) : (
					<ul
						className="flex max-h-[30rem] flex-col gap-1.5 overflow-y-auto pr-1"
						aria-label={t('ewaCompanion.fileListSurfaceListAria')}
					>
						{list.items.map((item) => (
							<li key={item.unifiedContentId}>
								<button
									type="button"
									className={cn(
										'flex w-full items-start gap-2 rounded-md border border-(--companion-divider)/80',
										'bg-(--desktop-surface-soft)/15 px-2.5 py-2 text-left transition hover:bg-(--desktop-surface-soft)/35',
										DESKTOP_CHROME_FOCUS_VISIBLE
									)}
									onClick={() =>
										onOpenFile({
											mode: 'document_editor',
											payload: {
												source: 'file_list',
												unifiedContentId: item.unifiedContentId,
												title: item.title,
											},
										})
									}
									aria-label={t('ewaCompanion.fileListSurfaceOpenFileAria', {
										title: item.title,
									})}
								>
									<DocumentTextIcon
										className="mt-0.5 size-4 shrink-0 text-(--companion-aura)"
										aria-hidden
									/>
									<span className="min-w-0 flex-1">
										<span className="block truncate text-[13px] font-medium text-(--desktop-text-primary)">
											{item.title}
										</span>
										<span className="mt-0.5 block text-[11px] text-(--companion-text-soft)">
											{[item.contentType, item.mimeType, item.updatedAt]
												.filter(Boolean)
												.join(' · ') || item.unifiedContentId}
										</span>
										{item.snippet ? (
											<span className="mt-1 block line-clamp-2 text-[11px] text-(--desktop-text-secondary)">
												{item.snippet}
											</span>
										) : null}
									</span>
								</button>
							</li>
						))}
					</ul>
				)}
				<div className="mt-3 flex justify-end">
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						onClick={onBackToChat}
					>
						{t('ewaCompanion.fileListSurfaceDone')}
					</DesktopAppButton>
				</div>
			</section>
		</CompanionSurfacePanel>
	);
}
