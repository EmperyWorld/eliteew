/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lightweight full-screen recovery when desktop storage hydrate failed and no config
 * is available — mounted **without** GAFChat / LazyMotion / workspace content VM.
 *
 * Invariants:
 * - Does not clear local layout data; retry only via connection check + refresh.
 * - Uses ambient-static EliteRecoveryScreen (no infinite CSS paint loops).
 *
 * Related:
 * - `DesktopWorkspace.tsx`
 * - `components/ui/EliteRecoveryScreen.tsx`
 * - `documentation/product/desktop/DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md`
 */

import type { JSX } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { EliteRecoveryScreen } from '@/components/ui/EliteRecoveryScreen';
import { performRecoveryConnectionCheck } from '@/services/maintenance/reloadCircuitBreaker';

import type { UseDesktopStorageReturn } from '../hooks/useDesktopStorage';

export function DesktopWorkspaceLoadFailureScreen({
	storage,
}: {
	storage: UseDesktopStorageReturn;
}): JSX.Element {
	const { t } = useTranslation('desktopUi');
	const loadFailureMessage = useMemo(() => {
		const failure = storage.loadFailure;
		if (!failure) return t('workspace.loadError.unknown');
		return t(`workspace.loadError.${failure.kind}`, {
			status: failure.httpStatus != null ? String(failure.httpStatus) : '—',
		});
	}, [storage.loadFailure, t]);

	return (
		<EliteRecoveryScreen
			title={t('workspace.loadRecoveryTitle')}
			description={loadFailureMessage}
			statusLabel={t('workspace.loadRecoveryStatus')}
			panelVariant="recovery"
			ambientStatic
			actionLabel={t('workspace.checkConnection')}
			actionPendingLabel={t('workspace.checkConnectionPending')}
			onAction={async () => {
				const ready = await performRecoveryConnectionCheck();
				if (ready) {
					storage.clearLoadFailure();
					await storage.refresh();
				}
			}}
			footnote={t('workspace.loadRecoveryFootnote')}
		/>
	);
}
