/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Observation trigger settings panel (idle / focus-app) with server sync + local cache.
 *
 * Invariants:
 * - Hung server fetch transitions to timeout error with retry (R-03 stall guard).
 *
 * Related:
 * - companionObservationTriggerPrefs.ts
 * - ewaCompanionLoadStall.ts
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	loadObservationTriggerPrefs,
	saveObservationTriggerPrefs,
	type CompanionObservationTriggerPrefs,
} from '@/features/ewa/companionObservationTriggerPrefs';
import {
	isEwaCompanionLoadTimeoutError,
	withEwaCompanionLoadStall,
} from '@/features/ewa/ewaCompanionLoadStall';
import {
	DesktopAppButton,
	DesktopProductStatePanel,
	DESKTOP_CHROME_FOCUS_VISIBLE,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export type CompanionWorkflowObservationSettingsProps = {
	principalId: string;
	className?: string;
};

export function CompanionWorkflowObservationSettings({
	principalId,
	className,
}: CompanionWorkflowObservationSettingsProps) {
	const { t } = useTranslation('marketing');
	const [prefs, setPrefs] = useState<CompanionObservationTriggerPrefs>(() => ({
		idleEnabled: true,
		focusAppEnabled: true,
	}));
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);

	const loadPrefs = useCallback(
		async (isCancelled: () => boolean = () => false): Promise<void> => {
			setLoading(true);
			setLoadError(null);
			try {
				const next = await withEwaCompanionLoadStall(
					loadObservationTriggerPrefs(principalId)
				);
				if (isCancelled()) return;
				setPrefs(next);
				setLoadError(null);
			} catch (error: unknown) {
				if (isCancelled()) return;
				if (isEwaCompanionLoadTimeoutError(error)) {
					setLoadError('Request Timeout');
					return;
				}
				setLoadError(t('ewaCompanion.observationTriggers.loadError'));
			} finally {
				if (!isCancelled()) setLoading(false);
			}
		},
		[principalId, t]
	);

	useEffect(() => {
		let cancelled = false;
		void loadPrefs(() => cancelled);
		return () => {
			cancelled = true;
		};
	}, [loadPrefs]);

	const update = (patch: Partial<CompanionObservationTriggerPrefs>) => {
		const optimistic = { ...prefs, ...patch };
		setPrefs(optimistic);
		void saveObservationTriggerPrefs(principalId, patch).then((next) => {
			setPrefs(next);
		});
	};

	if (loadError) {
		return (
			<DesktopProductStatePanel
				state="error"
				className={cn('min-h-0 py-3', className)}
				title={
					loadError === 'Request Timeout'
						? t('ewaCompanion.observationTriggers.loadTimeoutTitle')
						: t('ewaCompanion.observationTriggers.loadErrorTitle')
				}
				description={
					loadError === 'Request Timeout'
						? t('ewaCompanion.observationTriggers.loadTimeout')
						: loadError
				}
				actions={
					<DesktopAppButton
						type="button"
						variant="accent"
						onClick={() => void loadPrefs()}
					>
						{t('ewaCompanion.observationTriggers.loadRetry')}
					</DesktopAppButton>
				}
				data-testid="ewa-companion-observation-triggers"
			/>
		);
	}

	return (
		<div
			className={cn('flex flex-col gap-2', className)}
			data-testid="ewa-companion-observation-triggers"
		>
			<p className="text-[11px] font-medium text-(--desktop-text-primary)">
				{t('ewaCompanion.observationTriggers.title')}
			</p>
			<p className="text-[10px] text-(--companion-text-soft)">
				{t('ewaCompanion.observationTriggers.hint')}
			</p>
			<label className="flex items-center gap-2 text-[11px] text-(--desktop-text-primary)">
				<input
					type="checkbox"
					className={cn('size-3.5', DESKTOP_CHROME_FOCUS_VISIBLE)}
					checked={prefs.idleEnabled}
					disabled={loading}
					onChange={(e) => update({ idleEnabled: e.target.checked })}
				/>
				<span>{t('ewaCompanion.observationTriggers.idle')}</span>
			</label>
			<label className="flex items-center gap-2 text-[11px] text-(--desktop-text-primary)">
				<input
					type="checkbox"
					className={cn('size-3.5', DESKTOP_CHROME_FOCUS_VISIBLE)}
					checked={prefs.focusAppEnabled}
					disabled={loading}
					onChange={(e) => update({ focusAppEnabled: e.target.checked })}
				/>
				<span>{t('ewaCompanion.observationTriggers.focusApp')}</span>
			</label>
		</div>
	);
}
