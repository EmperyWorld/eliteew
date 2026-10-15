/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for Desktop AI Chat thread/list surface state resolution.
 */
import { describe, expect, it } from 'vitest';

import {
	resolveListSurfaceState,
	resolveThreadSurfaceState,
} from '../desktopAiChatSurfaceState';

describe('desktopAiChatSurfaceState', () => {
	it('resolveThreadSurfaceState maps load and message counts', () => {
		expect(
			resolveThreadSurfaceState({
				loadState: 'idle',
				messageCount: 0,
				sending: false,
			})
		).toBe('idle');
		expect(
			resolveThreadSurfaceState({
				loadState: 'loading',
				messageCount: 0,
				sending: false,
			})
		).toBe('loading');
		expect(
			resolveThreadSurfaceState({
				loadState: 'error',
				messageCount: 0,
				sending: false,
			})
		).toBe('error');
		expect(
			resolveThreadSurfaceState({
				loadState: 'ready',
				messageCount: 0,
				sending: false,
			})
		).toBe('empty');
		expect(
			resolveThreadSurfaceState({
				loadState: 'ready',
				messageCount: 2,
				sending: false,
			})
		).toBe('ready');
		expect(
			resolveThreadSurfaceState({
				loadState: 'ready',
				messageCount: 0,
				sending: true,
			})
		).toBe('ready');
	});

	it('resolveListSurfaceState distinguishes empty filter vs error', () => {
		expect(
			resolveListSurfaceState({
				loadState: 'loading',
				chatCount: 0,
				filterActive: false,
			})
		).toBe('loading');
		expect(
			resolveListSurfaceState({
				loadState: 'error',
				chatCount: 0,
				filterActive: false,
			})
		).toBe('error');
		expect(
			resolveListSurfaceState({
				loadState: 'ready',
				chatCount: 0,
				filterActive: false,
			})
		).toBe('empty');
		expect(
			resolveListSurfaceState({
				loadState: 'ready',
				chatCount: 0,
				filterActive: true,
			})
		).toBe('ready');
	});
});
