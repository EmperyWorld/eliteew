/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Example workspace plate for the welcome tour: a compact empty-field sample
 * with a ghost right-click menu so the spotlight has a useful rect.
 *
 * Invariants:
 * - Decorative; pointer-events none; unmounts when the workspace step ends.
 * - Does not replace the real background hit-target.
 *
 * Related:
 * - DesktopWorkspaceCanvas.tsx, documentation/product/GUIDED-TOUR-EXCURSION.md
 */

import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY, DESKTOP_Z_INDEX } from '../../constants';
import { useDesktopWelcomeTourStep } from '../../hooks/useDesktopWelcomeTourSession';
import { welcomeTourNeedsWorkspaceExample } from '../desktopWelcomeTourSession';

export function WelcomeTourWorkspaceExample() {
	const { t } = useTranslation('desktopUi');
	const stepId = useDesktopWelcomeTourStep();
	if (!welcomeTourNeedsWorkspaceExample(stepId)) return null;

	return (
		<div
			data-desktop-welcome-guide="workspace"
			data-welcome-tour-example="workspace"
			className={cn(
				'pointer-events-none absolute left-[12%] top-[22%] w-[min(20rem,46vw)]',
				'rounded-2xl border border-(--desktop-border-subtle)',
				'bg-(--desktop-surface-panel)/88 shadow-(--desktop-shadow-panel) backdrop-blur-xl'
			)}
			style={{ zIndex: DESKTOP_Z_INDEX.PANEL }}
			aria-hidden
		>
			<div className="border-b border-(--desktop-border-subtle) px-3 py-2">
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.labelOverline,
						'text-(--desktop-text-muted)'
					)}
				>
					{t('welcomeOnboarding.guide.examples.workspaceEyebrow')}
				</p>
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.body,
						'mt-0.5 text-(--desktop-text-primary)'
					)}
				>
					{t('welcomeOnboarding.guide.examples.workspaceTitle')}
				</p>
			</div>
			<ul className="flex flex-col gap-0.5 px-2 py-2">
				{(
					[
						'workspaceMenuNew',
						'workspaceMenuWidgets',
						'workspaceMenuLook',
					] as const
				).map((key) => (
					<li
						key={key}
						className={cn(
							'rounded-lg px-2.5 py-1.5 text-(--desktop-text-primary)',
							DESKTOP_TYPOGRAPHY.body,
							key === 'workspaceMenuWidgets'
								? 'bg-[color-mix(in_srgb,var(--desktop-accent)_18%,transparent)]'
								: 'bg-(--desktop-surface-soft)/70'
						)}
					>
						{t(`welcomeOnboarding.guide.examples.${key}`)}
					</li>
				))}
			</ul>
		</div>
	);
}
