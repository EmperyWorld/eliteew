import { describe, expect, it } from 'vitest';
import {
	extractEwrpApiErrorDetail,
	extractEwrpHttpStatus,
	notifyEwrpHttpError,
	resolveEwrpHttpErrorNotify,
} from './ewrpHttpErrors';

describe('extractEwrpHttpStatus', () => {
	it('reads axios response status', () => {
		expect(extractEwrpHttpStatus({ response: { status: 503 } })).toBe(503);
	});

	it('returns undefined for non-http errors', () => {
		expect(extractEwrpHttpStatus(new Error('boom'))).toBeUndefined();
	});
});

describe('extractEwrpApiErrorDetail', () => {
	it('returns string detail', () => {
		expect(
			extractEwrpApiErrorDetail(
				{ response: { data: { detail: 'Insufficient credits' } } },
				'fallback'
			)
		).toBe('Insufficient credits');
	});

	it('returns validation msg from array detail', () => {
		expect(
			extractEwrpApiErrorDetail(
				{ response: { data: { detail: [{ msg: 'too short' }] } } },
				'fallback'
			)
		).toBe('too short');
	});
});

describe('resolveEwrpHttpErrorNotify', () => {
	it('maps 402 to insufficient_energy', () => {
		expect(
			resolveEwrpHttpErrorNotify(
				{
					response: {
						status: 402,
						data: { detail: 'Not enough credits' },
					},
				},
				'fallback'
			)
		).toEqual({
			kind: 'insufficient_energy',
			detail: 'Not enough credits',
			statusCode: 402,
		});
	});

	it('maps 503 to service_unavailable (regen catalog missing)', () => {
		expect(
			resolveEwrpHttpErrorNotify(
				{
					response: {
						status: 503,
						data: {
							detail: 'Тип генерации изображений для UGS не настроен.',
						},
					},
				},
				'fallback'
			)
		).toEqual({
			kind: 'service_unavailable',
			detail: 'Тип генерации изображений для UGS не настроен.',
			statusCode: 503,
		});
	});

	it('falls back to generic', () => {
		expect(resolveEwrpHttpErrorNotify({}, 'failed')).toEqual({
			kind: 'generic',
			detail: 'failed',
			statusCode: undefined,
		});
	});
});

describe('notifyEwrpHttpError', () => {
	it('uses insufficient energy title for 402', () => {
		const calls: Array<[string, string | undefined]> = [];
		notifyEwrpHttpError(
			{ response: { status: 402, data: { detail: 'No credits' } } },
			'fallback',
			{
				error: (title, subtitle) => {
					calls.push([title, subtitle]);
				},
			},
			(key) => (key === 'notify.insufficientEnergy' ? 'Energy' : key)
		);
		expect(calls).toEqual([['Energy', 'No credits']]);
	});

	it('uses service unavailable title for 503', () => {
		const calls: Array<[string, string | undefined]> = [];
		notifyEwrpHttpError(
			{ response: { status: 503, data: { detail: 'Billing missing' } } },
			'fallback',
			{
				error: (title, subtitle) => {
					calls.push([title, subtitle]);
				},
			},
			(key) =>
				key === 'notify.serviceTemporarilyUnavailable' ? 'Unavailable' : key
		);
		expect(calls).toEqual([['Unavailable', 'Billing missing']]);
	});

	it('shows detail only for generic errors', () => {
		const calls: Array<[string, string | undefined]> = [];
		notifyEwrpHttpError(
			{ response: { status: 500, data: { detail: 'Server error' } } },
			'fallback',
			{
				error: (title, subtitle) => {
					calls.push([title, subtitle]);
				},
			},
			(key) => key
		);
		expect(calls).toEqual([['Server error', undefined]]);
	});
});
