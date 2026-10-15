/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for `classifyDesktopLoadFailure` — abort vs timeout classification.
 *
 * Invariants:
 * - Axios/browser cancel must map to `aborted`, not `timeout`.
 *
 * Related:
 * - `utils/desktopUi.ts`, `services/auth/authSessionHttpAbort.ts`
 */

import { describe, expect, it } from 'vitest';
import { classifyDesktopLoadFailure } from '../desktopUi';

describe('classifyDesktopLoadFailure', () => {
	it('classifies CanceledError as aborted (not timeout)', () => {
		const error = {
			name: 'CanceledError',
			message: 'canceled',
			code: 'ERR_CANCELED',
		};
		expect(classifyDesktopLoadFailure(error)).toEqual({ kind: 'aborted' });
	});

	it('classifies AbortError as aborted', () => {
		const error = { name: 'AbortError', message: 'Aborted' };
		expect(classifyDesktopLoadFailure(error)).toEqual({ kind: 'aborted' });
	});

	it('still classifies ECONNABORTED as timeout when not cancel-like', () => {
		const error = {
			name: 'AxiosError',
			message: 'timeout of 10000ms exceeded',
			code: 'ECONNABORTED',
		};
		expect(classifyDesktopLoadFailure(error)).toEqual({ kind: 'timeout' });
	});

	it('classifies APIError statusCode 502 as server (interceptor-thrown)', () => {
		const error = {
			name: 'APIError',
			message: 'Ошибка сервера. Попробуйте позже.',
			statusCode: 502,
		};
		expect(classifyDesktopLoadFailure(error)).toEqual({
			kind: 'server',
			httpStatus: 502,
		});
	});
});
