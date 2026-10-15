/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for agentic observability empty-state resolver.
 */

import { describe, expect, it } from 'vitest';

import { resolveAgenticObservabilityEmptyMessage } from '@/features/ewa/agentic/agenticObservabilityEmptyState';

const t = (_key: string, defaultValue: string) => defaultValue;

describe('resolveAgenticObservabilityEmptyMessage', () => {
	it('uses planning copy for empty tree while planning', () => {
		expect(
			resolveAgenticObservabilityEmptyMessage('tree', 'planning', {}, t)
		).toContain('формируется');
	});

	it('uses sibling-aware copy when trace has checkpoints but tree is empty', () => {
		expect(
			resolveAgenticObservabilityEmptyMessage(
				'tree',
				'executing',
				{ hasSiblingData: true },
				t
			)
		).toContain('трассе');
	});

	it('uses terminal-honest copy when completed mission has no tree', () => {
		expect(
			resolveAgenticObservabilityEmptyMessage('tree', 'completed', {}, t)
		).toContain('не сохранились');
	});

	it('uses terminal-honest copy when completed mission has no trace', () => {
		expect(
			resolveAgenticObservabilityEmptyMessage('trace', 'completed', {}, t)
		).toContain('недоступны');
	});

	it('uses executing copy for empty trace while executing', () => {
		expect(
			resolveAgenticObservabilityEmptyMessage('trace', 'executing', {}, t)
		).toContain('Act');
	});
});
