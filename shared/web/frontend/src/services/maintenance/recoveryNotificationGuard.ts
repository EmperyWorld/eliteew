/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Coalesce recovery UX during maintenance and upstream outages — suppress toast storms and duplicate unplanned maintenance publication.
 *
 * Invariants:
 * - When maintenance overlay owns the page, parallel API failures must not spam Sonner or notification center.
 * - Unplanned maintenance is published at most once until the window clears.
 *
 * Related:
 * - `maintenanceState.ts`
 * - `services/api/error-handler.ts`
 * - `utils/staleBundleReload.ts`
 */

import axios from 'axios';
import { APIError } from '../api/client';
import {
	createUnplannedMaintenanceStatus,
	getCurrentMaintenanceStatus,
	maintenanceStatusFromHttpError,
	publishMaintenanceStatus,
} from './maintenanceState';

const TOAST_DEDUPE_MS = 4_000;
const UNPLANNED_HTTP_ERROR_WINDOW_MS = 12_000;
const UNPLANNED_HTTP_ERROR_MIN_COUNT = 2;

let lastToastKey: string | null = null;
let lastToastAt = 0;
let unplannedHttpErrorTimestamps: number[] = [];

export function shouldSuppressApiErrorToast(error: unknown): boolean {
	const maintenance = getCurrentMaintenanceStatus();
	if (maintenance.active && maintenance.window?.suppress_error_toasts) {
		return true;
	}

	if (axios.isCancel(error)) {
		return true;
	}

	if (error instanceof Error) {
		if (error.name === 'AbortError') {
			return true;
		}
		if (error.message === 'follower_tab_passive_mode') {
			return true;
		}
		if (error.message === 'User not authenticated - redirecting to login') {
			return true;
		}
	}

	if (error instanceof APIError) {
		if (
			error.statusCode != null &&
			[502, 503, 504].includes(error.statusCode)
		) {
			return true;
		}
		if (error.isNetworkError && maintenance.active) {
			return true;
		}
	}

	if (axios.isAxiosError(error)) {
		const status = error.response?.status;
		if (status != null && [502, 503, 504].includes(status)) {
			return true;
		}
		if (
			status === 503 &&
			maintenanceStatusFromHttpError(error.response?.data).active
		) {
			return true;
		}
		if (!error.response && error.request && maintenance.active) {
			return true;
		}
	}

	return false;
}

export function shouldDedupeErrorToast(
	title: string,
	message: string
): boolean {
	const key = `${title}\0${message}`;
	const now = Date.now();
	if (lastToastKey === key && now - lastToastAt < TOAST_DEDUPE_MS) {
		return true;
	}
	lastToastKey = key;
	lastToastAt = now;
	return false;
}

function recordUnplannedHttpError(): number {
	const now = Date.now();
	unplannedHttpErrorTimestamps = unplannedHttpErrorTimestamps.filter(
		(at) => now - at < UNPLANNED_HTTP_ERROR_WINDOW_MS
	);
	unplannedHttpErrorTimestamps.push(now);
	return unplannedHttpErrorTimestamps.length;
}

/** Test-only reset for debounce ledger. */
export function resetUnplannedHttpErrorWindowForTests(): void {
	unplannedHttpErrorTimestamps = [];
}

export function publishUnplannedMaintenanceFromHttpError(
	status: number,
	retryAfterSeconds = 60
): void {
	if (getCurrentMaintenanceStatus().active) {
		return;
	}
	if (recordUnplannedHttpError() < UNPLANNED_HTTP_ERROR_MIN_COUNT) {
		return;
	}
	publishMaintenanceStatus(
		createUnplannedMaintenanceStatus(`http-${status}`, retryAfterSeconds)
	);
}
