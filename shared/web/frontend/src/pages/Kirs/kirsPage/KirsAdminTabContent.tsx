/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lazy-loaded Site Studio admin embed tab for KIRS project instance.
 *
 * Invariants:
 * - Imports KirsSiteStudioAdminPanel from parent ../ (not duplicated).
 * - Renders only when adminShellReady and selectedId are set.
 *
 * Related:
 * - ../KirsSiteStudioAdminPanel.tsx
 * - KirsDetailPanel.tsx
 */

import { DesktopAppEmptyState } from '@/pages/Desktop/components/DesktopAppChrome';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import * as React from 'react';
import type { KirsPageController } from './useKirsPage';

const KirsSiteStudioAdminPanelLazy = React.lazy(
	() => import('../KirsSiteStudioAdminPanel')
);

type Props = {
	k: KirsPageController;
};

export function KirsAdminTabContent({ k }: Props) {
	if (k.adminShellReady && k.selectedId && k.inst) {
		return (
			<React.Suspense
				fallback={
					<div className="flex flex-1 items-center justify-center py-16">
						<ArrowPathIcon className="size-8 animate-spin text-(--desktop-text-muted)" />
					</div>
				}
			>
				<KirsSiteStudioAdminPanelLazy
					projectId={k.selectedId}
					publicSiteUrl={k.inst.public_url ?? null}
				/>
			</React.Suspense>
		);
	}

	return (
		<DesktopAppEmptyState
			title="Админка недоступна"
			description="Дождитесь статуса running и ответа API (provision / start). Проверьте блок здоровья в консоли."
		/>
	);
}
