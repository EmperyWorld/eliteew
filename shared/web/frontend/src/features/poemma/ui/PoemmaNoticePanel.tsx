/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Elevated notice panel — premium page surface wrapping DesktopProductStatusBanner (+ optional actions).
 *
 * Invariants:
 * - Banner copy comes from caller; no hardcoded product messages here.
 *
 * Related:
 * - src/features/poemma/ui/PoemmaPagePanel.tsx
 * - src/features/poemma/PoemmaApp.tsx bootstrap/unauth flows
 */

import type { ReactNode } from 'react';
import {
	DesktopProductStatusBanner,
	type DesktopProductStatusTone,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import { PoemmaPagePanel } from './PoemmaPagePanel';

export type PoemmaNoticePanelProps = {
	tone: DesktopProductStatusTone;
	title: string;
	description: string;
	children?: ReactNode;
	className?: string;
};

export function PoemmaNoticePanel({
	tone,
	title,
	description,
	children,
	className,
}: PoemmaNoticePanelProps) {
	return (
		<PoemmaPagePanel className={cn('grid gap-4', className)}>
			<DesktopProductStatusBanner
				tone={tone}
				title={title}
				description={description}
			/>
			{children}
		</PoemmaPagePanel>
	);
}
