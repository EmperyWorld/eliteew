/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Единый стиль заглушек для разделов единой админки (будущие продукты).
 *
 * Invariants:
 * - Uses `AdminSectionFrame` for consistent padding with shell header.
 *
 * Related:
 * - `pages/Admin/shell/AdminSectionFrame.tsx`
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { DESKTOP_SURFACE, DESKTOP_TYPOGRAPHY } from '../Desktop/constants';
import { AdminSectionFrame } from './shell/AdminSectionFrame';

export interface AdminPlaceholderSectionProps {
	title: string;
	description: string;
	bullets?: string[];
}

export function AdminPlaceholderSection({
	title,
	description,
	bullets,
}: AdminPlaceholderSectionProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	return (
		<AdminSectionFrame>
			<div className="flex flex-col gap-4">
				<div>
					<h2 className={cn(DESKTOP_TYPOGRAPHY.subtitle, 'mb-2 text-white/95')}>
						{title}
					</h2>
					<p className="text-sm leading-relaxed text-white/65">{description}</p>
				</div>
				{bullets && bullets.length > 0 ? (
					<ul
						className={cn(
							'list-disc space-y-1.5 border border-white/10 bg-white/3 p-4 text-sm text-white/55',
							DESKTOP_SURFACE.radius
						)}
					>
						{bullets.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				) : null}
				<p className="text-xs text-white/40">
					{t('adminPlaceholder.inDevelopment')}
				</p>
			</div>
		</AdminSectionFrame>
	);
}
