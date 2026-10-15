/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Human-readable i18n for ensemble plan API validation errors in admin UI.
 *
 * Related:
 * - ensemblePlanFormErrorI18n.ts
 */

import type { TFunction } from 'i18next';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatValidationItem(
	item: unknown,
	t: TFunction<'desktopUi'>
): string | null {
	if (typeof item === 'string') {
		return item;
	}
	if (!isRecord(item)) {
		return null;
	}
	const loc = Array.isArray(item.loc)
		? item.loc.map((part) => String(part)).join('.')
		: '';
	const msg = typeof item.msg === 'string' ? item.msg : '';
	const type = typeof item.type === 'string' ? item.type : '';
	if (loc && msg) {
		return t('adminEnsemblePlan.apiValidation.fieldError', { loc, msg });
	}
	if (msg) {
		return msg;
	}
	if (type) {
		return t('adminEnsemblePlan.apiValidation.typeError', { type });
	}
	return null;
}

export function translateEnsemblePlanApiDetail(
	detail: unknown,
	t: TFunction<'desktopUi'>,
	fallback: string
): { message: string; rawJson: string | null } {
	if (typeof detail === 'string') {
		return { message: detail, rawJson: null };
	}
	if (Array.isArray(detail)) {
		const lines = detail
			.map((item) => formatValidationItem(item, t))
			.filter((line): line is string => Boolean(line));
		if (lines.length > 0) {
			return {
				message: lines.join('\n'),
				rawJson: JSON.stringify(detail, null, 2),
			};
		}
		return {
			message: fallback,
			rawJson: JSON.stringify(detail, null, 2),
		};
	}
	if (isRecord(detail) && typeof detail.message === 'string') {
		return {
			message: detail.message,
			rawJson: JSON.stringify(detail, null, 2),
		};
	}
	return { message: fallback, rawJson: JSON.stringify(detail, null, 2) };
}

export function extractApiErrorDetail(error: unknown): unknown {
	const ax = error as { response?: { data?: { detail?: unknown } } };
	return ax.response?.data?.detail;
}
