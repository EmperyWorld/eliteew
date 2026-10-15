/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Collapsed disclosure for support-only metadata in Professional Worlds runtime UI.
 *
 * Invariants:
 * - Primary actions stay outside; children are never shown until the user expands the panel.
 *
 * Related:
 * - i18n `shared.supportDetails`
 * - ArtifactHub.tsx, ProfessionalMediaWorkbench.tsx
 */

import type { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import { cn } from '@/utils/cn';

export function SupportDetailsPanel({
	children,
	className,
	summaryClassName,
	contentClassName,
	summary,
}: {
	readonly children: ReactNode;
	readonly className?: string;
	readonly summaryClassName?: string;
	readonly contentClassName?: string;
	readonly summary?: string;
}): ReactElement {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);

	return (
		<details
			className={cn('text-[11px] text-(--desktop-text-muted)', className)}
		>
			<summary className={cn('cursor-pointer', summaryClassName)}>
				{summary ?? t('shared.supportDetails')}
			</summary>
			<div className={cn('mt-1', contentClassName)}>{children}</div>
		</details>
	);
}
