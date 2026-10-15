/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map Professional Worlds API errors (including Zod contract drift) to operator-facing strings for panel banners.
 *
 * Invariants:
 * - `ProfessionalWorldsApiParseError` never leaks raw Zod paths; use i18n contract message.
 *
 * Related:
 * - professionalWorldsApiZod.ts
 * - runtimePanels/RealtorProPanels.tsx
 */

import axios from 'axios';

import { APIError } from '@/services/api/client';

import { ProfessionalWorldsApiParseError } from './professionalWorldsApiZod';

export type ClientHasDealsConflictDetail = {
	code: 'client_has_deals';
	deal_count: number;
	message?: string;
};

function extractResponseDetail(err: unknown): unknown {
	if (
		err instanceof APIError &&
		err.details &&
		typeof err.details === 'object'
	) {
		const data = err.details as { detail?: unknown };
		return data.detail;
	}
	if (axios.isAxiosError(err) && err.response?.data) {
		const data = err.response.data as { detail?: unknown };
		return data.detail;
	}
	return null;
}

export function parseClientHasDealsConflict(
	err: unknown
): ClientHasDealsConflictDetail | null {
	const detail = extractResponseDetail(err);
	if (!detail || typeof detail !== 'object') return null;
	const record = detail as Record<string, unknown>;
	if (record.code !== 'client_has_deals') return null;
	const dealCount =
		typeof record.deal_count === 'number'
			? record.deal_count
			: Number(record.deal_count);
	if (!Number.isFinite(dealCount)) return null;
	return {
		code: 'client_has_deals',
		deal_count: dealCount,
		message: typeof record.message === 'string' ? record.message : undefined,
	};
}

export function formatProfessionalWorldsApiError(
	err: unknown,
	translate: (key: string) => string,
	fallback?: string
): string {
	if (err instanceof ProfessionalWorldsApiParseError) {
		return translate('realtorPro.errors.apiContract');
	}
	return fallback ?? translate('realtorPro.errors.unableToLoad');
}

export function formatProfessionalWorldsApiSupportDetail(
	err: unknown
): string | null {
	if (err instanceof ProfessionalWorldsApiParseError && err.message.trim()) {
		return err.message;
	}
	if (err instanceof Error && err.message.trim()) {
		return err.message;
	}
	return null;
}
