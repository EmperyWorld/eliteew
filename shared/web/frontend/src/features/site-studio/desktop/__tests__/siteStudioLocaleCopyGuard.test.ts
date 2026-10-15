/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locale-level regression guard for Site Studio and Site Manager primary UI copy.
 *
 * Invariants:
 * - User-facing repair and config labels must not regress to raw operator terms.
 * - API keys and machine statuses remain unchanged; this test covers display strings only.
 *
 * Related:
 * - ../../../../i18n/locales/ru/siteStudio.json
 * - ../../../../i18n/locales/en/siteStudio.json
 */
import { describe, expect, it } from 'vitest';
import enSiteStudio from '@/i18n/locales/en/siteStudio.json';
import ruSiteStudio from '@/i18n/locales/ru/siteStudio.json';

const ENGINE_JARGON_RE = /\b(runtime_dist|hard_failures)\b/u;

const PRIMARY_TRUST_COPY_PREFIXES = [
	/^runtime\./u,
	/^journey\.blockers\./u,
	/^siteManager\.metrics\./u,
	/^siteManager\.siteCards\./u,
] as const;

function flattenLocaleStrings(
	obj: Record<string, unknown>,
	prefix = ''
): Array<[string, string]> {
	const entries: Array<[string, string]> = [];
	for (const [key, value] of Object.entries(obj)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (typeof value === 'string') {
			entries.push([path, value]);
			continue;
		}
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			entries.push(
				...flattenLocaleStrings(value as Record<string, unknown>, path)
			);
		}
	}
	return entries;
}

function isPrimaryTrustCopyKey(key: string): boolean {
	if (key.endsWith('.details')) return false;
	if (key.includes('supportExport')) return false;
	return PRIMARY_TRUST_COPY_PREFIXES.some((prefix) => prefix.test(key));
}

function collectEngineJargonViolations(
	locale: Record<string, unknown>
): Array<[string, string]> {
	return flattenLocaleStrings(locale).filter(
		([key, value]) => isPrimaryTrustCopyKey(key) && ENGINE_JARGON_RE.test(value)
	);
}

describe('Site Studio locale copy guard', () => {
	it('keeps Site Manager repair and config labels user-facing in Russian', () => {
		const visibleLabels = [
			ruSiteStudio.siteManager.drilldown.reconcileSignal,
			ruSiteStudio.siteManager.drilldown.noReconcile,
			ruSiteStudio.siteManager.reconcileActions.markFailed,
			ruSiteStudio.siteManager.reconcileActions.confirmMarkFailed,
			ruSiteStudio.siteManager.jobActions.retry,
			ruSiteStudio.workspace.config.subtitle,
			ruSiteStudio.workspace.config.scopeCol,
			ruSiteStudio.workspace.config.rolloutCol,
			ruSiteStudio.workspace.config.featureFlagsTitle,
			ruSiteStudio.workspace.config.siteBadge,
			ruSiteStudio.media.imagePreviewLoading,
			ruSiteStudio.media.imagePreviewUnavailable,
		].join(' | ');

		expect(visibleLabels).toContain('Сигнал состояния');
		expect(visibleLabels).toContain('Зафиксировать ошибку');
		expect(visibleLabels).toContain('Область');
		expect(visibleLabels).toContain('Загружаем изображение');
		expect(visibleLabels).not.toMatch(
			/Пометить failed|Подтвердить failed|Reconcile|Scope|Rollout|Feature flags|\bsite\b/u
		);
	});

	it('keeps Site Manager repair and config labels user-facing in English', () => {
		const visibleLabels = [
			enSiteStudio.siteManager.drilldown.noReconcile,
			enSiteStudio.siteManager.reconcileActions.markFailed,
			enSiteStudio.siteManager.reconcileActions.confirmMarkFailed,
			enSiteStudio.siteManager.jobActions.retry,
			enSiteStudio.workspace.config.subtitle,
			enSiteStudio.workspace.config.scopeCol,
			enSiteStudio.workspace.config.rolloutCol,
			enSiteStudio.workspace.config.featureFlagsTitle,
			enSiteStudio.media.imagePreviewLoading,
			enSiteStudio.media.imagePreviewUnavailable,
		].join(' | ');

		expect(visibleLabels).toContain('state-drift');
		expect(visibleLabels).toContain('Record failure');
		expect(visibleLabels).toContain('Enabled share');
		expect(visibleLabels).toContain('Loading image');
		expect(visibleLabels).not.toMatch(
			/No reconcile signals|Mark failed|Confirm failed|Retry job|Scope|Rollout %|feature flags|Feature flags/u
		);
	});

	it('keeps auto-fill document picker labels localized', () => {
		expect(ruSiteStudio.autofill.contentStudioNotSelected).toBe(
			'— не выбран —'
		);
		expect(enSiteStudio.autofill.contentStudioNotSelected).toBe(
			'— not selected —'
		);
		expect(ruSiteStudio.autofill.contentStudioDocument).not.toBe(
			enSiteStudio.autofill.contentStudioDocument
		);
	});

	it('bans engine jargon in primary Site Studio trust-copy keys', () => {
		const enViolations = collectEngineJargonViolations(
			enSiteStudio as Record<string, unknown>
		);
		const ruViolations = collectEngineJargonViolations(
			ruSiteStudio as Record<string, unknown>
		);

		expect(enViolations, `en: ${JSON.stringify(enViolations)}`).toEqual([]);
		expect(ruViolations, `ru: ${JSON.stringify(ruViolations)}`).toEqual([]);
	});

	it('keeps Site Manager unknown status localized', () => {
		expect(enSiteStudio.siteManager.unknownStatus).toBe('Unknown status');
		expect(ruSiteStudio.siteManager.unknownStatus).toBe('Неизвестный статус');
	});
});
