import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { ErrorBoundary } from '@/components/ui/primitives/ErrorBoundary';

import { DesktopAppErrorState } from '../../Desktop/components/DesktopAppChrome';
import type { MarketingView } from '../constants';

export interface MarketingCabinetActiveViewProps {
	activeView: MarketingView;
	onNavigateToOverview: () => void;
	children: ReactNode;
}

export function MarketingCabinetActiveView({
	activeView,
	onNavigateToOverview,
	children,
}: MarketingCabinetActiveViewProps) {
	const { t } = useTranslation('marketing');

	return (
		<div className="mc-active-view-root mx-auto pb-2">
			<ErrorBoundary
				key={activeView}
				fallback={
					<DesktopAppErrorState
						message={t('errorBoundaryMessage')}
						onAction={onNavigateToOverview}
						actionLabel={t('goToOverview')}
					/>
				}
			>
				{children}
			</ErrorBoundary>
		</div>
	);
}
