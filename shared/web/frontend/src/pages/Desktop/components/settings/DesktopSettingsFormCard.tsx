/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared form card shell for Desktop Settings Center sections (title + content).
 *
 * Invariants:
 * - Persistence badges gated by Shell chromeProfile traits (settings → forbidden).
 * - No card blurbs — see DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md.
 *
 * Related:
 * - `DesktopSettingsPanel.tsx`, tab modules under `settings/`
 * - documentation/product/desktop/DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md
 * - shell/shellChrome.ts (U4)
 */

import * as React from 'react';
import { cn } from '@/utils/cn';
import type { DesktopWindowStyle } from '@/types/profile';
import {
	resolveShellChromeProfile,
	resolveShellChromeTraits,
} from '@/pages/Desktop/shell';
import { DESKTOP_APP_STYLE_CONTRACT } from '../DesktopAppChrome';
import { getDesktopShellSettingsFormCardClassName } from '../../utils/desktopVisualSystem';

/** Settings Center appComponent — chromeProfile `settings` in App Registry. */
const SETTINGS_SHELL_APP = 'DesktopShellSettings';

export function SettingsFormCard({
	title,
	children,
	windowStyle,
	id,
	titleAdornment,
	persistenceBadge,
	density = 'comfortable',
}: {
	title: string;
	children: React.ReactNode;
	windowStyle: DesktopWindowStyle;
	id?: string;
	/** Non-persistence adornment (e.g. experimental chip) — not gated by chrome profile. */
	titleAdornment?: React.ReactNode;
	/**
	 * Persistence / storage-scope badge chrome. Rendered only when the registry
	 * chromeProfile traits allow it (settings profile forbids).
	 */
	persistenceBadge?: React.ReactNode;
	/** Compact padding for denser Personalize hierarchy. */
	density?: 'comfortable' | 'compact';
}) {
	const chromeProfile = resolveShellChromeProfile(SETTINGS_SHELL_APP);
	const chromeTraits = resolveShellChromeTraits(SETTINGS_SHELL_APP);
	const showPersistenceBadge =
		chromeTraits.allowPersistenceBadges && persistenceBadge != null;

	return (
		<div
			id={id}
			data-shell-chrome-profile={chromeProfile}
			data-settings-card-density={density}
			className={cn(
				getDesktopShellSettingsFormCardClassName(windowStyle),
				'shadow-(--desktop-shadow-soft)',
				density === 'compact' ? 'space-y-3 p-4' : 'space-y-5 p-5'
			)}
		>
			<div>
				<div className="flex flex-wrap items-center gap-2">
					<h4
						className={cn(
							'desktop-shell-display-text font-semibold',
							DESKTOP_APP_STYLE_CONTRACT.sectionLabel
						)}
					>
						{title}
					</h4>
					{titleAdornment}
					{showPersistenceBadge ? persistenceBadge : null}
				</div>
			</div>
			<div className="space-y-5">{children}</div>
		</div>
	);
}
