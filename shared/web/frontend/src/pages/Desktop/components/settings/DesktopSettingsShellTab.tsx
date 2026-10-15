/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shell behavior tab (virtual desktops, windows, apps, sync) for Settings Center.
 * Jump nav: workspaces / windows / advanced (apps·menu·sync live under more-options).
 *
 * Related:
 * - `settings/expansion/DesktopSettingsExpansionShellCluster.tsx`
 * - `documentation/product/desktop/DESKTOP-SETTINGS-EVERYDAY-IA.md`
 */

import { cn } from '@/utils/cn';
import { useCallback, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from 'framer-motion';
import { DESKTOP_SETTINGS_SHELL_ANCHORS } from '../../constants/desktopSettingsShellAnchors';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '../DesktopAppChrome';
import { DesktopSettingsExpansionShellCluster } from './expansion/DesktopSettingsExpansionShellCluster';
import type { DesktopSettingsExpansionShellClusterProps } from './expansion/desktopSettingsExpansionShellCluster.types';

export type DesktopSettingsShellTabProps =
	DesktopSettingsExpansionShellClusterProps;

export const DesktopSettingsShellTab: FC<DesktopSettingsShellTabProps> = (
	props
) => {
	const { t } = useTranslation('desktopUi');
	const reduceMotion = useReducedMotion();
	const scrollToShellAnchor = useCallback(
		(domId: string) => {
			const el = document.getElementById(domId);
			if (!el) return;
			el.scrollIntoView({
				behavior: reduceMotion ? 'auto' : 'smooth',
				block: 'start',
			});
		},
		[reduceMotion]
	);

	const shellJumpEntries = useMemo(
		() =>
			[
				{
					id: DESKTOP_SETTINGS_SHELL_ANCHORS.workspaces,
					label: t('settingsPanel.shellJumpWorkspaces'),
				},
				{
					id: DESKTOP_SETTINGS_SHELL_ANCHORS.windows,
					label: t('settingsPanel.shellJumpWindows'),
				},
				{
					id: DESKTOP_SETTINGS_SHELL_ANCHORS.advanced,
					label: t('settingsPanel.shellJumpAdvanced'),
				},
			] as const,
		[t]
	);

	return (
		<section
			aria-labelledby="shell-heading"
			className="space-y-5"
			data-testid="desktop-settings-shell-tab"
		>
			<h3 id="shell-heading" className="sr-only">
				{t('settingsPanel.sectionShellTitle')}
			</h3>

			<nav
				className="sticky top-0 z-10 -mx-5 mb-2 flex flex-wrap gap-1 border-b border-(--desktop-border-subtle)/80 bg-[color-mix(in_srgb,var(--desktop-surface-panel)_94%,transparent)] px-5 py-2 backdrop-blur-md supports-backdrop-filter:bg-[color-mix(in_srgb,var(--desktop-surface-panel)_88%,transparent)]"
				aria-label={t('settingsPanel.shellJumpNavAria')}
			>
				{shellJumpEntries.map((entry) => (
					<button
						key={entry.id}
						type="button"
						onClick={() => scrollToShellAnchor(entry.id)}
						className={cn(
							'rounded-lg px-3 py-1.5 text-xs font-medium outline-none transition-colors',
							DESKTOP_CHROME_FOCUS_VISIBLE,
							'text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)'
						)}
					>
						{entry.label}
					</button>
				))}
			</nav>

			<DesktopSettingsExpansionShellCluster {...props} />
		</section>
	);
};
