/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Ghost desktop shortcut used when the icons layer is empty so the welcome
 * tour can spotlight a real-sized example instead of the full work area.
 *
 * Invariants:
 * - Mounts only on the icons step when the caller reports zero icons.
 *
 * Related:
 * - DesktopWorkspaceCanvas.tsx, DesktopIconLayer.tsx
 */

import { cn } from '@/utils/cn';
import { FolderIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY, DESKTOP_Z_INDEX } from '../../constants';
import { useDesktopWelcomeTourStep } from '../../hooks/useDesktopWelcomeTourSession';
import { welcomeTourNeedsIconsExample } from '../desktopWelcomeTourSession';

export function WelcomeTourIconsExample() {
	const { t } = useTranslation('desktopUi');
	const stepId = useDesktopWelcomeTourStep();
	if (!welcomeTourNeedsIconsExample(stepId)) return null;

	return (
		<div
			data-desktop-welcome-guide="icons"
			data-welcome-tour-example="icons"
			className="pointer-events-none absolute left-[18%] top-[38%] flex w-24 flex-col items-center gap-1"
			style={{ zIndex: DESKTOP_Z_INDEX.PANEL }}
			aria-hidden
		>
			<div
				className={cn(
					'flex size-14 items-center justify-center rounded-2xl border border-(--desktop-border-subtle)',
					'bg-(--desktop-surface-panel)/90 shadow-(--desktop-shadow-panel) backdrop-blur-xl'
				)}
			>
				<FolderIcon className="size-7 text-(--desktop-text-primary)" />
			</div>
			<p
				className={cn(
					DESKTOP_TYPOGRAPHY.caption,
					'max-w-full truncate text-center text-(--desktop-text-primary)'
				)}
			>
				{t('welcomeOnboarding.guide.examples.iconLabel')}
			</p>
		</div>
	);
}
