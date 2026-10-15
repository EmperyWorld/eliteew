/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Professional Worlds notification wrapper for runtime job completion states.
 *
 * Invariants:
 * - Uses the shared EliteEW notification/toast system; no parallel toast store is introduced.
 * - Keep-alive/progress events do not create user-visible completion notifications.
 *
 * Related:
 * - notifications/useNotifications.ts
 * - JobProgressStream.tsx
 * - professionalWorldsApiError.ts
 */

import type { TFunction } from 'i18next';
import { useCallback } from 'react';

import { useNotifications } from '@/notifications';

import { formatProfessionalWorldsApiError } from './professionalWorldsApiError';
import type { JobProgressEvent } from './JobProgressStream';

export type ProfessionalToastJobCopy = {
	completedTitle: string;
	completedMessage: string;
	warningTitle: string;
	warningMessage: string;
	failedTitle: string;
	failedMessage: string;
};

export function useProfessionalToasts() {
	const { toast } = useNotifications();

	const notifyJobEvent = useCallback(
		(event: JobProgressEvent, copy: ProfessionalToastJobCopy) => {
			if (event.type === 'done' || event.type === 'result') {
				toast.success(
					copy.completedTitle,
					event.message ?? copy.completedMessage
				);
				return;
			}
			if (event.type === 'warning') {
				toast.warning(copy.warningTitle, event.message ?? copy.warningMessage);
				return;
			}
			if (event.type === 'error') {
				toast.error(copy.failedTitle, event.message ?? copy.failedMessage);
			}
		},
		[toast]
	);

	const notifySuccess = useCallback(
		(title: string, message?: string) => toast.success(title, message),
		[toast]
	);
	const notifyError = useCallback(
		(title: string, message?: string) => toast.error(title, message),
		[toast]
	);

	const notifyApiError = useCallback(
		(err: unknown, translate: TFunction, fallback?: string) => {
			notifyError(
				translate('realtorPro.errors.actionFailedTitle'),
				formatProfessionalWorldsApiError(err, (key) => translate(key), fallback)
			);
		},
		[notifyError]
	);

	return {
		notifyJobEvent,
		notifySuccess,
		notifyError,
		notifyApiError,
	};
}
