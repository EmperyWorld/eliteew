/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit coverage for typed playback error classification/mapping.
 *
 * Invariants:
 * - Abort/cancel errors are categorized as non-retriable.
 * - HTTP status aliases map to stable categories.
 *
 * Related:
 * - src/services/audio/playbackErrors.ts
 */

import { describe, expect, it } from 'vitest';

import {
	classifyHtmlMediaElementError,
	classifyPlaybackError,
	HTML_MEDIA_ERR_DECODE,
	HTML_MEDIA_ERR_NETWORK,
	HTML_MEDIA_ERR_SRC_NOT_SUPPORTED,
	isHtmlMediaAbortedError,
	isPlaybackAbortError,
	mapPlaybackErrorInfo,
	playbackErrorMessage,
} from '@/services/audio/playbackErrors';

const t = ((key: string) => key) as never;

describe('playbackErrors', () => {
	it('classifies HTTP errors into categories', () => {
		expect(classifyPlaybackError({ response: { status: 403 } })).toBe(
			'permission'
		);
		expect(classifyPlaybackError({ response: { status: 404 } })).toBe(
			'not_found'
		);
		expect(classifyPlaybackError({ response: { status: 503 } })).toBe(
			'storage_pending'
		);
	});

	it('classifies decode and abort errors', () => {
		expect(
			classifyPlaybackError(new Error('Could not decode media stream'))
		).toBe('decode');
		expect(
			classifyPlaybackError(new DOMException('Aborted', 'AbortError'))
		).toBe('aborted');
		expect(
			classifyPlaybackError(new DOMException('NotAllowed', 'NotAllowedError'))
		).toBe('permission');
	});

	it('maps category to translated message keys', () => {
		expect(playbackErrorMessage(t, 'permission', 'nowPlaying')).toBe(
			'nowPlaying.error403'
		);
		expect(playbackErrorMessage(t, 'storage_pending', 'nowPlaying')).toBe(
			'nowPlaying.errorStoragePending'
		);
	});

	it('returns retriable flag by category', () => {
		expect(
			mapPlaybackErrorInfo({ response: { status: 503 } }, t, 'nowPlaying')
		).toMatchObject({
			category: 'storage_pending',
			retriable: true,
		});
		expect(
			mapPlaybackErrorInfo({ response: { status: 403 } }, t, 'nowPlaying')
		).toMatchObject({
			category: 'permission',
			retriable: false,
		});
	});

	it('exposes helpers for non-fatal media / play abort', () => {
		expect(
			isPlaybackAbortError(new DOMException('Aborted', 'AbortError'))
		).toBe(true);
		expect(isPlaybackAbortError(new Error('decode failed'))).toBe(false);
		expect(isHtmlMediaAbortedError({ error: { code: 1 } as MediaError })).toBe(
			true
		);
		expect(isHtmlMediaAbortedError({ error: { code: 3 } as MediaError })).toBe(
			false
		);
		expect(isHtmlMediaAbortedError({ error: null })).toBe(false);
	});

	it('classifies HTMLMediaElement error codes', () => {
		expect(
			classifyHtmlMediaElementError({
				error: { code: HTML_MEDIA_ERR_NETWORK } as MediaError,
			})
		).toBe('unknown');
		expect(
			classifyHtmlMediaElementError({
				error: { code: HTML_MEDIA_ERR_DECODE } as MediaError,
			})
		).toBe('decode');
		expect(
			classifyHtmlMediaElementError({
				error: { code: HTML_MEDIA_ERR_SRC_NOT_SUPPORTED } as MediaError,
			})
		).toBe('decode');
	});
});
