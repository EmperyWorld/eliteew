/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * RDP-safe Suspense fallback for lazy Start Menu mode bodies (no Framer).
 * P18: escalates aria/copy after stall threshold (honest delay).
 *
 * Invariants:
 * - ``role="status"``; ``aria-busy`` while not stalled.
 * - After stall: ``workspace.loadingStalled`` label + ``data-stalled=true``.
 * - Geometry matches live `#start-menu-panel` (`START_MENU_PANEL_GEOMETRY`) —
 *   ``absolute`` in `[data-desktop-ui-scale]`, never viewport-``fixed`` (scale transform).
 *
 * Related:
 * - ../StartMenu.tsx
 * - ./startMenuPanelGeometry.ts
 * - ../DesktopAppChrome.tsx (`DesktopAppSkeleton`)
 * - ../../utils/desktopAppLoadStall.ts
 * - documentation/product/desktop/DESKTOP_DESIGN_SYSTEM.md
 */

import type { CSSProperties, JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { DESKTOP_Z_INDEX } from '../../constants';
import { useDesktopAppLoadStall } from '../../utils/desktopAppLoadStall';
import { getDesktopShellPanelClassName } from '../../utils/desktopVisualSystem';
import { DesktopAppSkeleton } from '../DesktopAppChrome';
import { START_MENU_PANEL_GEOMETRY } from './startMenuPanelGeometry';

export function StartMenuSuspenseFallback(): JSX.Element {
	const { t } = useTranslation('desktopUi');
	const stalled = useDesktopAppLoadStall(true);
	const loadingLabel = t('startMenu.loadingAria', {
		defaultValue: t('workspace.openingDesktop'),
	});
	const label = stalled ? t('workspace.loadingStalled') : loadingLabel;

	return (
		<div
			className={cn(
				getDesktopShellPanelClassName('glass'),
				'pointer-events-none absolute isolate z-(--desktop-start-menu-z) flex min-h-0 flex-col overflow-hidden p-4',
				START_MENU_PANEL_GEOMETRY
			)}
			style={
				{
					'--desktop-start-menu-z': DESKTOP_Z_INDEX.PANEL,
				} as CSSProperties
			}
			role="status"
			aria-busy={!stalled}
			aria-label={label}
			data-testid="desktop-start-menu-suspense-fallback"
			data-stalled={stalled ? 'true' : 'false'}
		>
			{stalled ? (
				<p className="mb-3 text-sm text-(--desktop-text-secondary)">{label}</p>
			) : null}
			<DesktopAppSkeleton className="mb-3 h-10 w-full shrink-0" />
			<div className="mb-3 flex gap-2">
				<DesktopAppSkeleton className="h-8 w-28" />
				<DesktopAppSkeleton className="h-8 w-24" />
				<DesktopAppSkeleton className="h-8 w-16" />
			</div>
			<div className="grid flex-1 grid-cols-3 content-start gap-2 sm:grid-cols-4">
				{(
					[
						's1',
						's2',
						's3',
						's4',
						's5',
						's6',
						's7',
						's8',
						's9',
						's10',
						's11',
						's12',
					] as const
				).map((slot) => (
					<DesktopAppSkeleton key={slot} className="h-24 w-full" />
				))}
			</div>
		</div>
	);
}
