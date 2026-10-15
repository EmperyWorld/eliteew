/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sticky top or bottom action bar for GAF Chat Content Manager library picker — file count,
 * selection hint or name, cancel, and confirm attach controls.
 *
 * Invariants:
 * - Top bar shows selected file name when present, otherwise hint; bottom bar always shows hint.
 * - Top and bottom preserve distinct chrome classes from the original panel implementation.
 *
 * Related:
 * - GafContentLibraryPickerPanel.tsx
 */
import type { Content } from '@/components/UnifiedContent/types';
import { unifiedContentDisplayLabel } from '@/components/UnifiedContent/utils/contentDisplayLabel';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { DesktopChromeTooltip } from '@/pages/Desktop/components/DesktopChromeTooltip';
import { DESKTOP_TYPOGRAPHY, DESKTOP_Z_INDEX } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

export type GafContentLibraryPickerActionBarPlacement = 'top' | 'bottom';

export type GafContentLibraryPickerActionBarProps = Readonly<{
	placement: GafContentLibraryPickerActionBarPlacement;
	filesCount: number;
	selectedItem: Content | null;
	onCancel: () => void;
	onConfirm: () => void;
	confirmDisabled: boolean;
}>;

export function GafContentLibraryPickerActionBar({
	placement,
	filesCount,
	selectedItem,
	onCancel,
	onConfirm,
	confirmDisabled,
}: GafContentLibraryPickerActionBarProps): ReactElement {
	const { t } = useTranslation('gafChat');
	const hint = t('libraryPickerHint');
	const filesCountLabel = t('libraryPickerFilesCount', { count: filesCount });

	if (placement === 'top') {
		return (
			<div
				className={cn(
					'sticky top-0 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-app)/95 px-4 py-2.5 shadow-(--desktop-shadow-soft) backdrop-blur-md',
					!selectedItem && 'hidden sm:flex'
				)}
				style={{ zIndex: DESKTOP_Z_INDEX.GAF_INNER_OVERLAY }}
			>
				<div className="min-w-0">
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.shellMeta10,
							'uppercase tracking-wide text-(--desktop-text-dim)'
						)}
					>
						{filesCountLabel}
					</p>
					<p className={cn(DESKTOP_TYPOGRAPHY.widgetTrackTitle, 'truncate')}>
						{selectedItem ? unifiedContentDisplayLabel(selectedItem) : hint}
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<DesktopChromeTooltip
						content={t('libraryPickerCancel')}
						placement="top"
						offsetExtra={4}
					>
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							onClick={onCancel}
						>
							{t('libraryPickerCancel')}
						</DesktopAppButton>
					</DesktopChromeTooltip>
					<DesktopChromeTooltip
						content={t('libraryPickerConfirm')}
						placement="top"
						offsetExtra={4}
					>
						<DesktopAppButton
							type="button"
							variant="accent"
							size="sm"
							className="gap-2"
							disabled={confirmDisabled}
							onClick={onConfirm}
						>
							<ClipboardDocumentCheckIcon className="h-4 w-4" aria-hidden />
							{t('libraryPickerConfirm')}
						</DesktopAppButton>
					</DesktopChromeTooltip>
				</div>
			</div>
		);
	}

	return (
		<div
			className="sticky bottom-0 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/95 px-4 py-3 shadow-[0_-12px_30px_rgba(0,0,0,0.18)] backdrop-blur-md"
			style={{ zIndex: DESKTOP_Z_INDEX.GAF_INNER_OVERLAY }}
		>
			<div className="min-w-0">
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.shellMeta10,
						'text-(--desktop-text-dim)'
					)}
				>
					{filesCountLabel}
				</p>
				<p className={cn('mt-0.5', DESKTOP_TYPOGRAPHY.meta)}>{hint}</p>
			</div>
			<div className="flex shrink-0 gap-2">
				<DesktopChromeTooltip
					content={t('libraryPickerCancel')}
					placement="top"
					offsetExtra={4}
				>
					<DesktopAppButton type="button" variant="neutral" onClick={onCancel}>
						{t('libraryPickerCancel')}
					</DesktopAppButton>
				</DesktopChromeTooltip>
				<DesktopChromeTooltip
					content={t('libraryPickerConfirm')}
					placement="top"
					offsetExtra={4}
				>
					<DesktopAppButton
						type="button"
						variant="accent"
						className="gap-2"
						disabled={confirmDisabled}
						onClick={onConfirm}
					>
						<ClipboardDocumentCheckIcon className="h-4 w-4" aria-hidden />
						{t('libraryPickerConfirm')}
					</DesktopAppButton>
				</DesktopChromeTooltip>
			</div>
		</div>
	);
}
