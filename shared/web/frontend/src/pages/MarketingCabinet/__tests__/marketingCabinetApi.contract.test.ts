import { describe, expect, it } from 'vitest';
import {
	MARKETING_CABINET_STREAM_AI_ASSIST_URL,
	MARKETING_CABINET_STREAM_CHAT_MESSAGE_URL,
} from '../marketingCabinetApi';

describe('marketing cabinet stream path contract', () => {
	it('stream URLs match OpenAPI pilot paths', () => {
		expect(MARKETING_CABINET_STREAM_AI_ASSIST_URL).toBe(
			'/api/v1/marketing-cabinet/ai/assist/stream'
		);
		expect(MARKETING_CABINET_STREAM_CHAT_MESSAGE_URL).toBe(
			'/api/v1/marketing-cabinet/chat/message/stream'
		);
	});

	it('paths stay under /api/v1 for apiClient base', () => {
		expect(MARKETING_CABINET_STREAM_AI_ASSIST_URL.startsWith('/api/v1/')).toBe(
			true
		);
		expect(
			MARKETING_CABINET_STREAM_CHAT_MESSAGE_URL.startsWith('/api/v1/')
		).toBe(true);
	});
});
