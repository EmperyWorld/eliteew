/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 5 locale guard for Site Studio embedded CMS shell namespace parity.
 *
 * Invariants:
 * - en/ru `shell` subtrees stay aligned for shell keys migrated in Wave 5.
 * - AdminRouteGuard must not regress to hardcoded Russian loading copy.
 *
 * Related:
 * - ../../../../i18n/locales/en/siteStudioCms.json
 * - ../../../../i18n/locales/ru/siteStudioCms.json
 * - ../AdminRouteGuard.tsx
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import enSiteStudioCms from '@/i18n/locales/en/siteStudioCms.json';
import ruSiteStudioCms from '@/i18n/locales/ru/siteStudioCms.json';

function flattenKeys(value: unknown, prefix = ''): string[] {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		return prefix ? [prefix] : [];
	}

	return Object.entries(value).flatMap(([key, child]) =>
		flattenKeys(child, prefix ? `${prefix}.${key}` : key)
	);
}

describe('siteStudioCms locale guard', () => {
	it('keeps en and ru shell key trees aligned', () => {
		const enKeys = flattenKeys(enSiteStudioCms.shell).sort();
		const ruKeys = flattenKeys(ruSiteStudioCms.shell).sort();

		expect(enKeys).toEqual(ruKeys);
	});

	it('keeps products and content a11y key trees aligned', () => {
		const enProducts = flattenKeys(enSiteStudioCms.products).sort();
		const ruProducts = flattenKeys(ruSiteStudioCms.products).sort();
		const enContent = flattenKeys(enSiteStudioCms.content).sort();
		const ruContent = flattenKeys(ruSiteStudioCms.content).sort();

		expect(enProducts).toEqual(ruProducts);
		expect(enContent).toEqual(ruContent);
	});

	it('documents Wave 5 scope in locale meta', () => {
		expect(enSiteStudioCms._meta.wave5Scope).toContain('Wave 5');
		expect(ruSiteStudioCms._meta.wave5Scope).toContain('Wave 5');
	});

	it('removes hardcoded route guard checking copy from AdminRouteGuard source', () => {
		const guardPath = join(
			dirname(fileURLToPath(import.meta.url)),
			'../AdminRouteGuard.tsx'
		);
		const source = readFileSync(guardPath, 'utf8');

		expect(source).not.toContain('Проверяем доступ');
		expect(source).toContain('data-site-studio-cms="island"');
		expect(source).toContain("t('shell.routeGuard.checkingAccess')");
	});
});
