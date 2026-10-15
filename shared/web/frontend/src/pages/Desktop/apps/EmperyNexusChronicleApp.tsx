/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop launcher that navigates into the fullscreen Empery Nexus Chronicle shell route.
 *
 * Invariants:
 * - Does not embed WebGL in the window; immersion happens on `#/empery-nexus`.
 *
 * Related:
 * - features/empery-nexus-chronicle/EmperyNexusChroniclePage.tsx
 * - documentation/product/EMPERY-NEXUS-CHRONICLE.md
 */

import { useAppState } from '@/hooks/useAppState';
import { EMPERY_NEXUS_CHRONICLE_NS } from '@/i18n/namespaces';
import { cn } from '@/utils/cn';
import { syncLocationHashToPage } from '@/utils/pageRouting';
import {
	DesktopAppContentWrapper,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useEffect, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

export function EmperyNexusChronicleApp(): ReactElement {
	const { actions } = useAppState();
	const { t } = useTranslation(EMPERY_NEXUS_CHRONICLE_NS);

	useEffect(() => {
		actions.setCurrentPage('empery-nexus');
		syncLocationHashToPage('empery-nexus');
	}, [actions]);

	return (
		<DesktopAppContentWrapper
			appComponent="EmperyNexusChronicleApp"
			mode="passthrough"
			className="flex h-full min-h-0 flex-col overflow-hidden bg-(--desktop-surface-panel)"
		>
			<DesktopAppSurface
				variant="soft"
				padding="md"
				className="flex flex-1 flex-col items-start justify-center gap-3 border-0 bg-transparent shadow-none"
			>
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.subtitle,
						'font-(family-name:--font-display,Cinzel,serif) tracking-[0.16em] text-[rgb(var(--desktop-accent-rgb))]'
					)}
				>
					{t('launcher.brand')}
				</p>
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'max-w-md text-(--desktop-text-secondary)'
					)}
				>
					{t('launcher.opening')}
				</p>
			</DesktopAppSurface>
		</DesktopAppContentWrapper>
	);
}

export default EmperyNexusChronicleApp;
