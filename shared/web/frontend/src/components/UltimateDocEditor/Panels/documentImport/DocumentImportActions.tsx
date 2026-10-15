/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Footer primary CTA + busy hint for DocumentImportPanel.
 *
 * Invariants:
 * - Import button disabled when queue empty, store loading, or progress active.
 *
 * Related:
 * - DocumentImportPanel.tsx, useDocumentImportBatch.ts
 */

import type { TFunction } from 'i18next';
import { ArrowPathIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import type { ImportProgress } from '@/components/UltimateDocEditor/types/editor.types';

type DocumentImportActionsProps = {
	t: TFunction<'docEditorPanels'>;
	filesCount: number;
	isLoading: boolean;
	progress: ImportProgress | null;
	onImport: () => void;
};

export function DocumentImportActions({
	t,
	filesCount,
	isLoading,
	progress,
	onImport,
}: DocumentImportActionsProps) {
	return (
		<div className="shrink-0 border-t border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-5">
			<div className="flex gap-3">
				<DesktopAppButton
					onClick={onImport}
					disabled={filesCount === 0 || isLoading || !!progress}
					variant="accent"
					className="flex-1 py-2.5 font-semibold"
				>
					{progress ? (
						<>
							<ArrowPathIcon
								width={16}
								height={16}
								className="animate-spin motion-reduce:animate-none motion-reduce:opacity-80"
							/>
							<span>{t('panels.import.importing')}</span>
						</>
					) : (
						<>
							<ArrowUpTrayIcon width={16} height={16} />
							<span>
								{t('panels.import.importButton', {
									count: filesCount,
								})}
							</span>
						</>
					)}
				</DesktopAppButton>
			</div>

			<div className={cn(DESKTOP_TYPOGRAPHY.meta, 'mt-3 text-center')}>
				{progress || isLoading
					? t('panels.import.busyHint')
					: t('panels.import.footerIdleHint')}
			</div>
		</div>
	);
}
