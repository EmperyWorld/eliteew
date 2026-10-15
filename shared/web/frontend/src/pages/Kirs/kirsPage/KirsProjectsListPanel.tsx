/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Left sidebar project list for KIRS curation page.
 *
 * Invariants:
 * - data-kirs-curation-guide="project-list" anchor preserved for guided tour.
 *
 * Related:
 * - KirsPage.tsx
 * - useKirsPage.ts
 */

import {
	DesktopAppEmptyState,
	DesktopAppSectionLabel,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import type { KirsPageController } from './useKirsPage';

type Props = {
	k: KirsPageController;
};

export function KirsProjectsListPanel({ k }: Props) {
	return (
		<DesktopAppSurface
			data-kirs-curation-guide="project-list"
			variant="soft"
			className="flex min-h-0 flex-col overflow-hidden p-2"
		>
			<DesktopAppSectionLabel className="px-1">Проекты</DesktopAppSectionLabel>
			<div className="mt-2 min-h-0 flex-1 overflow-y-auto">
				{k.projectsQuery.isLoading ? (
					<div className="flex justify-center py-8">
						<ArrowPathIcon className="size-6 animate-spin text-(--desktop-text-muted)" />
					</div>
				) : k.projects.length === 0 ? (
					<DesktopAppEmptyState
						title="Нет проектов"
						description="Нужны права ведущего по проекту в маркетинговом кабинете."
					/>
				) : (
					<ul className="space-y-1">
						{k.projects.map((p) => (
							<li key={p.project_id}>
								<button
									type="button"
									onClick={() => k.setSelectedId(p.project_id)}
									className={cn(
										'w-full rounded-lg px-2 py-2 text-left text-sm transition-colors',
										k.selectedId === p.project_id
											? 'bg-slate-700/80 text-slate-100'
											: 'hover:bg-slate-700/50 text-slate-300'
									)}
								>
									<div className="truncate font-medium">{p.project_name}</div>
									<div className="truncate text-xs text-(--desktop-text-muted)">
										{p.company_name}
									</div>
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
		</DesktopAppSurface>
	);
}
