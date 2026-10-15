/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock ugsHub status/category label helpers against EN locale resources.
 *
 * Related:
 * - ../ugsHubTaskListMeta.ts
 */

import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import enUgsHub from '@/i18n/locales/en/ugsHub.json';

import {
	buildUgsHubCategoryLabelMap,
	ugsHubCategoryLabel,
	ugsHubStatusLabel,
} from '../ugsHubTaskListMeta';

const i18n = createInstance();

beforeAll(async () => {
	await i18n.use(initReactI18next).init({
		lng: 'en',
		resources: { en: { ugsHub: enUgsHub } },
		interpolation: { escapeValue: false },
	});
});

describe('ugsHubTaskListMeta i18n helpers', () => {
	it('returns English status and category labels', () => {
		const t = i18n.getFixedT('en', 'ugsHub');
		expect(ugsHubStatusLabel(t, 'processing')).toBe('Running');
		expect(ugsHubCategoryLabel(t, 'image')).toBe('Images');
		expect(ugsHubCategoryLabel(t, 'unknown-cat')).toBe('Other');
		expect(buildUgsHubCategoryLabelMap(t).text).toBe('Text');
	});
});
