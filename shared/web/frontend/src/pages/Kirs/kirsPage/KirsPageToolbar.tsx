/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * KIRS curation page header toolbar with refresh action.
 *
 * Invariants:
 * - data-kirs-curation-guide="header" anchor preserved for guided tour.
 *
 * Related:
 * - KirsPage.tsx
 * - ../kirsCurationGuideConstants.ts
 */

import {
	DesktopAppButton,
	DesktopAppToolbar,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import { ArrowPathIcon, ServerIcon } from '@heroicons/react/24/outline';
import type { KirsPageController } from './useKirsPage';

type Props = {
	k: KirsPageController;
};

export function KirsPageToolbar({ k }: Props) {
	return (
		<DesktopAppToolbar
			data-kirs-curation-guide="header"
			className="shrink-0 items-center justify-between gap-2"
		>
			<div className="flex min-w-0 items-center gap-2">
				<ServerIcon className="size-5 shrink-0 text-violet-300" aria-hidden />
				<div className="min-w-0">
					<div className="truncate text-sm font-semibold text-(--desktop-text-primary)">
						КИРС — курирование сайта
					</div>
					<div className="truncate text-xs text-(--desktop-text-muted)">
						Проекты маркетинга, где у вас есть права ведущего
					</div>
				</div>
			</div>
			<div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => void k.projectsQuery.refetch()}
					disabled={k.projectsQuery.isFetching}
				>
					<ArrowPathIcon
						className={cn(
							'size-4',
							k.projectsQuery.isFetching && 'animate-spin'
						)}
						aria-hidden
					/>
					Обновить
				</DesktopAppButton>
			</div>
		</DesktopAppToolbar>
	);
}
