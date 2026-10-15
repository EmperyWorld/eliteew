/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Build screen-reader live text for EWRP job status column.
 *
 * Related:
 * - `useEwrpGeneratorCompose.ts`, `ewrpStatusLabel`
 */

import type { EwrpStatusResponse } from '@/services/ewrpApi';
import { ewrpStatusLabel } from '../EwrpGeneratorChunks';

export type EwrpStatusLiveTextI18n = {
	noActiveJob: () => string;
	progressSuffix: (p: { n: number }) => string;
	errorSuffix: (p: { msg: string }) => string;
	lead: (p: { label: string; progressPart: string; errPart: string }) => string;
};

export function buildEwrpStatusLiveText(
	status: EwrpStatusResponse | null,
	statusIndicatorLabel: string | undefined,
	t: EwrpStatusLiveTextI18n
): string {
	if (!status) {
		return t.noActiveJob();
	}
	const label = statusIndicatorLabel ?? ewrpStatusLabel(status.status);
	const progressPart =
		typeof status.progress === 'number'
			? t.progressSuffix({ n: status.progress })
			: '';
	const errPart = status.error_message
		? t.errorSuffix({ msg: status.error_message })
		: '';
	return t.lead({ label, progressPart, errPart });
}
