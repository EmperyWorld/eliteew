/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Project shortcuts widget slot: app collections and content shortcut links.
 *
 * Invariants:
 * - Filters content shortcuts to project/desktop folder types only.
 *
 * Related:
 * - DesktopWidgetsPanel.tsx
 */

import { cn } from '@/utils/cn';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import { DesktopAppButton } from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import type { DesktopWidgetsPanelProps } from './types';

export function ProjectShortcutsSlotBody({
	compact,
	appCollections,
	contentShortcuts,
	onOpenContentShortcut,
	onOpenAppCollection,
}: Pick<
	DesktopWidgetsPanelProps,
	| 'appCollections'
	| 'contentShortcuts'
	| 'onOpenContentShortcut'
	| 'onOpenAppCollection'
> & { compact: boolean }) {
	const { t } = useTranslation('desktopUi');
	const filteredShortcuts = useMemo(
		() =>
			contentShortcuts.filter(
				(s) =>
					s.type === 'project-folder' ||
					s.type === 'saved-filter' ||
					s.type === 'desktop-folder'
			),
		[contentShortcuts]
	);
	const maxC = compact ? 2 : 4;
	const maxS = compact ? 3 : 6;
	const collections = appCollections.slice(0, maxC);
	const shortcuts = filteredShortcuts.slice(0, maxS);

	if (collections.length === 0 && shortcuts.length === 0) {
		return (
			<p className={DESKTOP_TYPOGRAPHY.caption}>
				{t('settingsPanel.widgetsPanel.projectShortcutsEmpty')}
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			{collections.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{collections.map((c) => (
						<DesktopChromeTooltip
							key={c.id}
							content={c.name}
							placement="top"
							offsetExtra={4}
						>
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								className={cn(
									DESKTOP_TYPOGRAPHY.captionInherit,
									'h-auto min-h-0 max-w-full px-2 py-1 font-medium'
								)}
								onClick={() => onOpenAppCollection(c.id)}
							>
								<span className="truncate">{c.name}</span>
							</DesktopAppButton>
						</DesktopChromeTooltip>
					))}
				</div>
			)}
			{shortcuts.length > 0 && (
				<ul className="space-y-1">
					{shortcuts.map((s) => (
						<li key={s.id}>
							<DesktopChromeTooltip
								content={s.label}
								placement="top"
								offsetExtra={4}
							>
								<button
									type="button"
									onClick={() => onOpenContentShortcut(s.id)}
									className={cn(
										DESKTOP_TYPOGRAPHY.caption,
										'w-full rounded-md px-2 py-1 text-left text-(--desktop-text-secondary) transition-colors',
										'hover:bg-(--desktop-surface-soft) focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]'
									)}
								>
									<span className="line-clamp-2">{s.label}</span>
								</button>
							</DesktopChromeTooltip>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
