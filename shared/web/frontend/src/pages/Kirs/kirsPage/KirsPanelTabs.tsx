/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Console vs admin tab switcher for KIRS instance panel.
 *
 * Invariants:
 * - data-kirs-curation-guide="panel-tabs" anchor preserved for guided tour.
 * - Admin tab disabled until adminShellReady.
 *
 * Related:
 * - KirsDetailPanel.tsx
 */

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { GlobeAltIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import type { KirsPageController } from './useKirsPage';

type Props = {
	k: KirsPageController;
};

export function KirsPanelTabs({ k }: Props) {
	return (
		<div
			data-kirs-curation-guide="panel-tabs"
			className="flex shrink-0 flex-wrap gap-2"
		>
			<DesktopAppButton
				type="button"
				size="sm"
				variant="ghost"
				active={k.panelTab === 'console'}
				onClick={() => k.setPanelTab('console')}
			>
				<GlobeAltIcon className="size-4" aria-hidden />
				Консоль
			</DesktopAppButton>
			<DesktopAppButton
				type="button"
				size="sm"
				variant="ghost"
				active={k.panelTab === 'admin'}
				disabled={!k.adminShellReady}
				onClick={() => k.setPanelTab('admin')}
				title="Открывает внутреннюю админку проекта в Desktop. Публичным посетителям эта панель недоступна."
			>
				<ShieldCheckIcon className="size-4" aria-hidden />
				Админка (Desktop)
			</DesktopAppButton>
		</div>
	);
}
