/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Run vs Builder main tab strip for AmkaView.
 *
 * Related:
 * - AmkaView.tsx, amkaViewShellStyles.ts
 */

import { useTranslation } from 'react-i18next';

import type { AmkaMainTab } from '@/features/amka/amkaView/amkaViewTypes';

type AmkaViewMainTabsProps = {
	mainTab: AmkaMainTab;
	runModeClusterClass: string;
	runModeTabClass: (active: boolean) => string;
	onMainTabChange: (tab: AmkaMainTab) => void;
};

export function AmkaViewMainTabs({
	mainTab,
	runModeClusterClass,
	runModeTabClass,
	onMainTabChange,
}: AmkaViewMainTabsProps) {
	const { t } = useTranslation('marketing');

	return (
		<div
			className={runModeClusterClass}
			role="tablist"
			aria-label={t('amkaView.mainTabsAria')}
		>
			<button
				type="button"
				role="tab"
				aria-selected={mainTab === 'run'}
				className={runModeTabClass(mainTab === 'run')}
				onClick={() => onMainTabChange('run')}
			>
				{t('amkaView.tabRun')}
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={mainTab === 'builder'}
				className={runModeTabClass(mainTab === 'builder')}
				onClick={() => onMainTabChange('builder')}
			>
				{t('amkaView.tabBuilder')}
			</button>
		</div>
	);
}
