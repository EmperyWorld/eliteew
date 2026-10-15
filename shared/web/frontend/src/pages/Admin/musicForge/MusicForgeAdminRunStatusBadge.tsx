/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lifecycle status badge for MusicForge admin run list and inspector.
 *
 * Related:
 * - musicForgeAdminRunHelpers.ts
 */

import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { musicForgeAdminRunStatusTone } from './musicForgeAdminRunHelpers';

export type MusicForgeAdminRunStatusBadgeProps = {
	status: string;
	className?: string;
};

export function MusicForgeAdminRunStatusBadge({
	status,
	className,
}: MusicForgeAdminRunStatusBadgeProps): ReactElement {
	const { t } = useTranslation('desktopUi');
	const tone = musicForgeAdminRunStatusTone(status);
	const labelKey = `adminMusicForge.runStatus.${status}`;
	const translated = t(labelKey);
	const label = translated === labelKey ? status : translated;

	return (
		<span
			className={cn(
				'inline-flex rounded-full border px-2 py-0.5 text-xs font-medium',
				tone.border,
				tone.bg,
				tone.fg,
				className
			)}
		>
			{label}
		</span>
	);
}
