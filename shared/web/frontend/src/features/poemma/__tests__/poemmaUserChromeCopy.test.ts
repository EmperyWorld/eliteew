/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * User-facing chrome copy — sync badge visibility and period labels.
 */

import { describe, expect, it } from 'vitest';

import type { PoemmaPeriod } from '../poemmaDomain';
import {
	formatPoemmaUserPeriodRange,
	poemmaUserPeriodLabel,
	resolvePoemmaUserSyncBadge,
} from '../poemmaUserChromeCopy';

describe('poemmaUserChromeCopy', () => {
	it('hides sync badge when online or local-only', () => {
		expect(
			resolvePoemmaUserSyncBadge({
				stage: 'online',
				message: null,
				updatedAt: '2026-06-21T00:00:00Z',
			})
		).toBeNull();
		expect(
			resolvePoemmaUserSyncBadge({
				stage: 'local-only',
				message: null,
				updatedAt: '2026-06-21T00:00:00Z',
			})
		).toBeNull();
	});

	it('uses plain-language labels for degraded sync', () => {
		const badge = resolvePoemmaUserSyncBadge({
			stage: 'degraded',
			message: 'timeout',
			updatedAt: '2026-06-21T00:00:00Z',
		});
		expect(badge?.label).toBe('Проверьте сохранение');
		expect(badge?.tone).toBe('danger');
	});

	it('formats period chip with status', () => {
		const period: PoemmaPeriod = {
			id: 'p1',
			orgId: 'org-1',
			startDate: '2026-03-01',
			endDate: '2026-05-29',
			status: 'active',
		};
		expect(poemmaUserPeriodLabel(period)).toMatch(/идёт/);
		expect(poemmaUserPeriodLabel(period)).toMatch(/март/);
	});

	it('formats readable period range for home meta', () => {
		expect(formatPoemmaUserPeriodRange(null)).toBe('Черновик периода');
		expect(
			formatPoemmaUserPeriodRange({
				id: 'p1',
				orgId: 'org-1',
				startDate: '2026-03-01',
				endDate: '2026-05-29',
				status: 'active',
			})
		).toMatch(/март/);
	});
});
