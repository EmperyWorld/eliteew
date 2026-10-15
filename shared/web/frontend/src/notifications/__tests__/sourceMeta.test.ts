import { describe, expect, it } from 'vitest';
import {
	getNotificationSourceI18nKey,
	normalizeNotificationSource,
} from '../sourceMeta';

describe('notification source metadata', () => {
	it('normalizes known aliases to canonical source keys', () => {
		expect(normalizeNotificationSource('bi')).toBe('business_intelligence');
		expect(normalizeNotificationSource('system')).toBe('server');
		expect(normalizeNotificationSource('gaf_chat')).toBe('gaf_chat');
	});

	it('falls back to server for unknown source and i18n key', () => {
		expect(normalizeNotificationSource('some_new_domain')).toBe('server');
		expect(getNotificationSourceI18nKey('some_new_domain')).toBe(
			'sources.server'
		);
	});
});
