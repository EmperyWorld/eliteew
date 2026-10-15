/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop/mobile shell entry for Content Manager with root error boundary.
 *
 * Invariants:
 * - Tab-level boundaries remain inside ContentManagerPro; this wraps the full surface.
 *
 * Related:
 * - ContentManagerPro.tsx, ContentManagerTabErrorBoundary.tsx
 */
import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import ContentManagerPro from './ContentManagerPro';
import type { ContentManagerProProps } from './contentManagerProTypes';
import { ContentManagerTabErrorBoundary } from './components/ContentManagerTabErrorBoundary';

export type { ContentManagerProProps };

export default function ContentManagerProShell(
	props: ContentManagerProProps
): ReactElement {
	const { t } = useTranslation('contentManager');
	const [rootKey, setRootKey] = useState(0);

	return (
		<ContentManagerTabErrorBoundary
			recoveryTitle={t('tabPanel.loadErrorTitle')}
			recoveryLabel={t('tabPanel.retry')}
			onRecovery={() => setRootKey((key) => key + 1)}
		>
			<ContentManagerPro key={rootKey} {...props} />
		</ContentManagerTabErrorBoundary>
	);
}
