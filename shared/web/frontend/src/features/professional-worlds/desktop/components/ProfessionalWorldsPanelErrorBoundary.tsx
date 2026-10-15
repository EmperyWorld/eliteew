/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Localized error boundary for Professional Worlds runtime module panels.
 *
 * Invariants:
 * - Failures in one module panel must not crash the entire desktop shell.
 * - Retry delegates to workspace snapshot reload when available.
 *
 * Related:
 * - ModulePanelRegistry.tsx
 * - ProfessionalWorldsWorkspaceContext.tsx
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { withTranslation, type WithTranslation } from 'react-i18next';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import { ProfessionalWorldsStatusBanner } from '../layout';

type Props = WithTranslation & {
	children: ReactNode;
	moduleLabel?: string;
	onRetry?: () => void;
};

type State = {
	error: Error | null;
};

class ProfessionalWorldsPanelErrorBoundaryInner extends Component<
	Props,
	State
> {
	state: State = { error: null };

	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo): void {
		console.error('[ProfessionalWorldsPanelErrorBoundary]', error, info);
	}

	private handleRetry = (): void => {
		this.setState({ error: null });
		this.props.onRetry?.();
	};

	render(): ReactNode {
		const { children, moduleLabel, t } = this.props;
		if (!this.state.error) {
			return children;
		}
		return (
			<div className="grid gap-3 p-4">
				<ProfessionalWorldsStatusBanner kind="error" role="alert">
					{moduleLabel
						? t('modulePanel.errorWithModule', { module: moduleLabel })
						: t('modulePanel.errorGeneric')}
				</ProfessionalWorldsStatusBanner>
				{this.props.onRetry ? (
					<DesktopAppButton type="button" onClick={this.handleRetry}>
						{t('modulePanel.retry')}
					</DesktopAppButton>
				) : null}
			</div>
		);
	}
}

export const ProfessionalWorldsPanelErrorBoundary = withTranslation(
	PROFESSIONAL_WORLDS_NS
)(ProfessionalWorldsPanelErrorBoundaryInner);
