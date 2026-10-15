/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWRP job status polling — mutex, timer (jobId-only deps), restore-key clear on terminal.
 *
 * Invariants:
 * - Poll timer useEffect deps `[jobId, pollStatus, stopPolling]` only.
 * - `pollInFlightRef` mutex prevents overlapping polls.
 *
 * Related:
 * - `useEwrpGeneratorCompose.tsx`, `ewrpStatusPolling.ts`, `EWRP_RESTORE_KEY`
 */

import { useCallback, useEffect, useRef } from 'react';
import { notify } from '@/notifications';
import { ewrpApi, type EwrpStatusResponse } from '@/services/ewrpApi';
import {
	EWRP_RESTORE_KEY,
	FIRST_POLL_DELAY_MS,
	POLL_INTERVAL_MS,
	parseEwrpStatusResponse,
} from '../EwrpGeneratorChunks';
import { ewrpShouldStopStatusPolling } from '../ewrpClientJobPolicy';
import { ewrpPollStatusOutcome } from '../ewrpStatusPolling';

export type UseEwrpGeneratorPollingParams = {
	jobId: string | null;
	status: EwrpStatusResponse | null;
	setStatus: React.Dispatch<React.SetStateAction<EwrpStatusResponse | null>>;
	statusRef: React.MutableRefObject<EwrpStatusResponse | null>;
	setStatusPollError: React.Dispatch<React.SetStateAction<string | null>>;
	refreshHistory: () => Promise<void>;
	t: (key: string, opts?: Record<string, unknown>) => string;
};

export function useEwrpGeneratorPolling({
	jobId,
	status,
	setStatus,
	statusRef,
	setStatusPollError,
	refreshHistory,
	t,
}: UseEwrpGeneratorPollingParams) {
	const pollIntervalRef = useRef<number | null>(null);
	const pollFirstTimeoutRef = useRef<number | null>(null);
	const pollInFlightRef = useRef(false);

	const stopPolling = useCallback(() => {
		if (pollFirstTimeoutRef.current) {
			clearTimeout(pollFirstTimeoutRef.current);
			pollFirstTimeoutRef.current = null;
		}
		if (pollIntervalRef.current) {
			clearInterval(pollIntervalRef.current);
			pollIntervalRef.current = null;
		}
	}, []);

	useEffect(() => {
		return () => stopPolling();
	}, [stopPolling]);

	const pollStatus = useCallback(
		async (id: string) => {
			if (pollInFlightRef.current) return;
			pollInFlightRef.current = true;
			try {
				const res = await ewrpApi.getStatus(id);
				const data = parseEwrpStatusResponse(res);
				if (!data) {
					if (!statusRef.current) {
						setStatusPollError(t('form.statusLoadFailed'));
					}
					return;
				}
				setStatus(data);
				setStatusPollError(null);
				const outcome = ewrpPollStatusOutcome(data.status);
				if (outcome === 'completed') {
					stopPolling();
					window.localStorage.removeItem(EWRP_RESTORE_KEY);
					notify.success(t('notify.presentationReady'));
					void refreshHistory();
				} else if (outcome === 'failed') {
					stopPolling();
					window.localStorage.removeItem(EWRP_RESTORE_KEY);
					notify.error(
						data.error_message?.trim() || t('notify.generationFailedRefund')
					);
					void refreshHistory();
				}
			} catch (e) {
				console.error('EWRP status poll error', e);
				if (!statusRef.current) {
					setStatusPollError(t('form.statusLoadFailed'));
				}
			} finally {
				pollInFlightRef.current = false;
			}
		},
		[stopPolling, refreshHistory, t, setStatus, setStatusPollError, statusRef]
	);

	const resumeActivePolling = useCallback(() => {
		if (!jobId) return;
		stopPolling();
		pollFirstTimeoutRef.current = window.setTimeout(() => {
			void pollStatus(jobId);
		}, FIRST_POLL_DELAY_MS);
		pollIntervalRef.current = window.setInterval(() => {
			void pollStatus(jobId);
		}, POLL_INTERVAL_MS);
	}, [jobId, pollStatus, stopPolling]);

	// Only jobId in deps: status (progress/phase) changes must not reset timers — avoids request storms.
	useEffect(() => {
		if (!jobId) {
			return;
		}
		pollFirstTimeoutRef.current = window.setTimeout(() => {
			void pollStatus(jobId);
		}, FIRST_POLL_DELAY_MS);
		pollIntervalRef.current = window.setInterval(() => {
			void pollStatus(jobId);
		}, POLL_INTERVAL_MS);
		return () => {
			stopPolling();
		};
	}, [jobId, pollStatus, stopPolling]);

	// Opening a completed job from history: first effect may start timers — stop them here.
	useEffect(() => {
		if (ewrpShouldStopStatusPolling(status?.status)) {
			stopPolling();
		}
	}, [status?.status, stopPolling]);

	return {
		pollStatus,
		stopPolling,
		resumeActivePolling,
		pollInFlightRef,
	};
}
