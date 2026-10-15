/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for assistant stream error mapping to i18n keys.
 *
 * Invariants:
 * - Rate-limit payloads never pass through as raw server text to users.
 *
 * Related:
 * - pages/Desktop/components/assistant/mapAssistantStreamError.ts
 */
import { describe, expect, it, vi } from 'vitest';
import {
	isAssistantRateLimitMessage,
	mapAssistantStreamError,
} from '../mapAssistantStreamError';

const t = vi.fn((key: string) => `i18n:${key}`) as unknown as Parameters<
	typeof mapAssistantStreamError
>[1];

describe('mapAssistantStreamError', () => {
	it('maps rate_limited token to rateLimited i18n key', () => {
		expect(mapAssistantStreamError('rate_limited', t)).toBe('i18n:rateLimited');
	});

	it('detects common rate-limit message markers', () => {
		expect(isAssistantRateLimitMessage('Too many requests')).toBe(true);
		expect(isAssistantRateLimitMessage('Слишком много запросов')).toBe(true);
		expect(isAssistantRateLimitMessage('HTTP 429 rate limit exceeded')).toBe(
			true
		);
	});

	it('falls back to toastError for empty messages', () => {
		expect(mapAssistantStreamError('', t)).toBe('i18n:toastError');
		expect(mapAssistantStreamError('   ', t)).toBe('i18n:toastError');
	});

	it('passes through non-rate-limit server text unchanged', () => {
		expect(mapAssistantStreamError('Model unavailable', t)).toBe(
			'Model unavailable'
		);
	});

	it('maps stable stream error codes to i18n keys', () => {
		expect(mapAssistantStreamError('network_error', t, { status: 502 })).toBe(
			'i18n:streamErrors.networkErrorWithStatus'
		);
		expect(t).toHaveBeenCalledWith('streamErrors.networkErrorWithStatus', {
			status: 502,
		});
		expect(mapAssistantStreamError('no_response_body', t)).toBe(
			'i18n:streamErrors.noResponseBody'
		);
		expect(mapAssistantStreamError('stream_error', t)).toBe('i18n:toastError');
	});
});
