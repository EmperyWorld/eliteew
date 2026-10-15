/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Поведенческие проверки `resolveAudioUrlForPlayback`: проход http(s), конвертация `data:` в blob.
 *
 * Invariants:
 * - После теста blob URLs отзываем через `revoke`.
 *
 * Related:
 * - `resolveAudioUrlForPlayback.ts`
 */

import { describe, expect, it, vi } from 'vitest';

import { resolveAudioUrlForPlayback } from './resolveAudioUrlForPlayback';

describe('resolveAudioUrlForPlayback', () => {
	it('passes through non-data URLs', async () => {
		const { playUrl, revoke } = await resolveAudioUrlForPlayback(
			'https://example.com/x.wav'
		);
		expect(playUrl).toBe('https://example.com/x.wav');
		revoke();
	});

	it('rejects undecodable data URLs', async () => {
		await expect(
			resolveAudioUrlForPlayback('data:audio/wav;base64,!!!')
		).rejects.toThrow(/normalize/i);
	});

	it('converts decodable data URL into blob URL', async () => {
		const originalCreate = URL.createObjectURL;
		const originalRevoke = URL.revokeObjectURL;
		const createMock = vi.fn(() => 'blob:audio-preview');
		const revokeMock = vi.fn();
		Object.defineProperty(URL, 'createObjectURL', {
			value: createMock,
			configurable: true,
			writable: true,
		});
		Object.defineProperty(URL, 'revokeObjectURL', {
			value: revokeMock,
			configurable: true,
			writable: true,
		});
		try {
			const { playUrl, revoke } = await resolveAudioUrlForPlayback(
				'data:audio/wav;base64,UklGRg=='
			);
			expect(playUrl).toBe('blob:audio-preview');
			expect(createMock).toHaveBeenCalledTimes(1);
			revoke();
			expect(revokeMock).toHaveBeenCalledWith('blob:audio-preview');
		} finally {
			Object.defineProperty(URL, 'createObjectURL', {
				value: originalCreate,
				configurable: true,
				writable: true,
			});
			Object.defineProperty(URL, 'revokeObjectURL', {
				value: originalRevoke,
				configurable: true,
				writable: true,
			});
		}
	});
});
