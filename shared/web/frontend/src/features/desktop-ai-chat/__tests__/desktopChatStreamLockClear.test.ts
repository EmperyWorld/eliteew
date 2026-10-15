import { describe, expect, it } from 'vitest';
import { APIError } from '../../../services/api/client';
import { classifyStreamLockClearError } from '../desktopChatStreamLockClear';

describe('classifyStreamLockClearError', () => {
	it('maps chat-not-found 404 to chat_not_found', () => {
		const err = new APIError('Chat not found', 404);
		expect(classifyStreamLockClearError(err)).toEqual({
			kind: 'chat_not_found',
			messageKey: 'streamLockClear404Chat',
		});
	});

	it('maps other 404 to backend_404', () => {
		const err = new APIError('Not Found', 404);
		expect(classifyStreamLockClearError(err)).toEqual({
			kind: 'backend_404',
			messageKey: 'streamLockClear404Backend',
		});
	});

	it('maps generic errors with raw message', () => {
		expect(classifyStreamLockClearError(new Error('network down'))).toEqual({
			kind: 'generic',
			messageKey: 'streamLockClearFailed',
			rawMessage: 'network down',
		});
	});

	it('falls back when generic error message is empty', () => {
		expect(classifyStreamLockClearError(new Error('   '))).toEqual({
			kind: 'generic',
			messageKey: 'streamLockClearFailed',
			rawMessage: undefined,
		});
	});
});
