import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';
import { voiceGatewayErrorMessage } from '../voiceGatewayErrorMessage';

describe('voiceGatewayErrorMessage', () => {
	it('returns Error message for non-axios errors', () => {
		expect(voiceGatewayErrorMessage(new Error('boom'))).toBe('boom');
	});

	it('maps FastAPI detail from axios 400 response body', () => {
		const err = new AxiosError('bad');
		err.response = {
			status: 400,
			statusText: 'Bad Request',
			data: { detail: 'Нет аудио' },
			headers: {},
			config: {} as never,
		};
		expect(voiceGatewayErrorMessage(err)).toBe('Нет аудио');
	});
});
