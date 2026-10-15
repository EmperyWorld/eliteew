/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Header chrome for DocumentImportPanel (title, Word badge, close).
 *
 * Invariants:
 * - aria-labelledby id `document-import-panel-title` must stay stable.
 *
 * Related:
 * - DocumentImportPanel.tsx
 */

import type { TFunction } from 'i18next';
import { ArrowUpTrayIcon, XMarkIcon } from '@heroicons/react/24/outline';

import {
	DesktopAppButton,
	DesktopAppStatusBadge,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

type DocumentImportHeaderProps = {
	t: TFunction<'docEditorPanels'>;
	onClose: () => void;
};

export function DocumentImportHeader({
	t,
	onClose,
}: DocumentImportHeaderProps) {
	return (
		<div className="shrink-0 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-4 py-3">
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-3 min-w-0">
					<div className="shrink-0 rounded-xl border border-green-400/30 bg-linear-to-br from-green-500/30 to-blue-500/30 p-2">
						<ArrowUpTrayIcon
							className="text-green-300"
							width={18}
							height={18}
						/>
					</div>
					<div className="min-w-0">
						<h3
							id="document-import-panel-title"
							className="flex items-center gap-2 truncate font-semibold text-(--desktop-text-primary)"
						>
							{t('panels.import.title')}
							<DesktopAppStatusBadge className="shrink-0 border-blue-400/30 bg-blue-500/20 text-blue-300">
								{t('panels.import.wordBadge')}
							</DesktopAppStatusBadge>
						</h3>
						<p className={cn(DESKTOP_TYPOGRAPHY.meta)}>
							{t('panels.import.subtitleMeta')}
						</p>
					</div>
				</div>
				<DesktopAppButton
					type="button"
					onClick={onClose}
					variant="ghost"
					size="icon"
					title={t('panels.import.closeTitle')}
					aria-label={t('panels.import.closeAria')}
				>
					<XMarkIcon width={18} height={18} />
				</DesktopAppButton>
			</div>
		</div>
	);
}
