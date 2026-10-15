/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Runtime-панель менеджера сайтов в Site Studio: композиция launch, domains, edge visitor и operator diagnostics.
 * Сохраняет публичный контракт props/exports для `UserSiteStudioSetupTab` и regression tests.
 *
 * Invariants:
 * - Основные действия runtime выполняются только через `onRunAction` (делегировано в `SiteStudioLaunchPanel`).
 * - Кнопка админки активна только при `canOpenAdminShell`.
 * - Runtime guardrails вычисляются в `siteStudioRuntimeGuards` (через launch panel).
 * - `data-ss-guide="runtime"` остаётся на обёртке в `UserSiteStudioSetupTab`.
 *
 * Related:
 * - `features/site-studio/desktop/UserSiteStudioSetupTab.tsx`
 * - `SiteStudioLaunchPanel.tsx`
 * - `SiteStudioDomainBindingsPanel.tsx`
 * - `SiteStudioEdgeVisitorPanel.tsx`
 * - `SiteStudioOperatorDiagnosticsCard.tsx`
 */
import * as React from 'react';
import { DesktopAppPanel } from '@/pages/Desktop/components/DesktopAppChrome';

import type {
	SiteStudioDraftState,
	SiteStudioHealth,
	SiteStudioInstance,
} from '../api';
import { SiteStudioDomainBindingsPanel } from './SiteStudioDomainBindingsPanel';
import { SiteStudioEdgeVisitorPanel } from './SiteStudioEdgeVisitorPanel';
import { SiteStudioLaunchPanel } from './SiteStudioLaunchPanel';
import { SiteStudioOperatorDiagnosticsCard } from './SiteStudioOperatorDiagnosticsCard';

export interface SiteStudioRuntimePanelProps {
	instance: SiteStudioInstance;
	health: SiteStudioHealth | null;
	drafts: SiteStudioDraftState | null;
	/** True when embedded admin / proxy can safely attach (runtime up, API OK, not mid-transition). */
	canOpenAdminShell: boolean;
	busyKeys: Set<string>;
	onRunAction: (
		action:
			| 'provision'
			| 'start'
			| 'stop'
			| 'redeploy'
			| 'publish'
			| 'unpublish'
	) => void;
	onOpenPublic: () => void;
	onOpenAdmin: () => void;
	onCopy: (value: string, label: string) => void;
}

export const SiteStudioRuntimePanel: React.FC<SiteStudioRuntimePanelProps> = ({
	instance,
	health,
	drafts,
	canOpenAdminShell,
	busyKeys,
	onRunAction,
	onOpenPublic,
	onOpenAdmin,
	onCopy,
}) => {
	return (
		<DesktopAppPanel className="space-y-4 p-4">
			<SiteStudioLaunchPanel
				instance={instance}
				health={health}
				drafts={drafts}
				canOpenAdminShell={canOpenAdminShell}
				busyKeys={busyKeys}
				onRunAction={onRunAction}
				onOpenPublic={onOpenPublic}
				onOpenAdmin={onOpenAdmin}
				onCopy={onCopy}
			/>
			<SiteStudioOperatorDiagnosticsCard instance={instance} />
			<SiteStudioDomainBindingsPanel onCopy={onCopy} />
			<SiteStudioEdgeVisitorPanel
				instance={instance}
				health={health}
				onCopy={onCopy}
			/>
		</DesktopAppPanel>
	);
};

export default SiteStudioRuntimePanel;
