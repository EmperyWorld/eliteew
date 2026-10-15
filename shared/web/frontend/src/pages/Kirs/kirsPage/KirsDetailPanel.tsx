/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Right-hand detail panel: empty/loading/create/instance with console or admin tab.
 *
 * Invariants:
 * - Tab routing and empty states match pre-atomization KirsPage.
 *
 * Related:
 * - KirsPage.tsx
 * - KirsCreateInstancePanel.tsx
 * - KirsAdminTabContent.tsx
 */

import {
	DesktopAppEmptyState,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { KirsAdminTabContent } from './KirsAdminTabContent';
import { KirsConsoleAccessDeleteSection } from './KirsConsoleAccessDeleteSection';
import { KirsConsoleDomainsSection } from './KirsConsoleDomainsSection';
import { KirsConsoleRuntimeSection } from './KirsConsoleRuntimeSection';
import { KirsCreateInstancePanel } from './KirsCreateInstancePanel';
import { KirsPanelTabs } from './KirsPanelTabs';
import type { KirsPageController } from './useKirsPage';

type Props = {
	k: KirsPageController;
};

export function KirsDetailPanel({ k }: Props) {
	return (
		<DesktopAppSurface
			variant="soft"
			className="flex min-h-0 flex-col overflow-hidden p-3"
		>
			{!k.selectedId ? (
				<DesktopAppEmptyState
					title="Выберите проект"
					description="Слева список проектов, где вы можете вести разработку сайта."
				/>
			) : k.instanceQuery.isLoading ? (
				<div className="flex flex-1 items-center justify-center py-16">
					<ArrowPathIcon className="size-8 animate-spin text-(--desktop-text-muted)" />
				</div>
			) : (
				<div className="flex min-h-0 flex-1 flex-col gap-3">
					{!k.inst ? (
						<KirsCreateInstancePanel k={k} />
					) : (
						<>
							<KirsPanelTabs k={k} />
							{k.panelTab === 'admin' ? (
								<KirsAdminTabContent k={k} />
							) : (
								<div className="min-h-0 flex-1 overflow-y-auto">
									<div className="flex flex-col gap-4">
										<KirsConsoleRuntimeSection k={k} />
										<KirsConsoleDomainsSection k={k} />
										<KirsConsoleAccessDeleteSection k={k} />
									</div>
								</div>
							)}
						</>
					)}
				</div>
			)}
		</DesktopAppSurface>
	);
}
