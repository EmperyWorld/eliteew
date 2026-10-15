import { describe, expect, it } from 'vitest';
import {
	ensembleDocConfirmAskedAtMs,
	isEnsembleDocConfirmExpired,
	resolveEnsembleDocConfirmTtlSeconds,
} from '../ensembleDocConfirmPolicy';
import type { DesktopAiMessage } from '../api/desktopChatClient';

function askedMessage(
	overrides: Partial<DesktopAiMessage> = {}
): DesktopAiMessage {
	return {
		id: 'msg-1',
		role: 'user',
		content: 'Нужен документ?',
		created_at: '2026-06-17T10:00:00.000Z',
		metadata: {
			ensemble_doc_confirm: 'asked',
			ensemble_doc_confirm_asked_at: '2026-06-17T10:00:00.000Z',
		},
		...overrides,
	};
}

describe('resolveEnsembleDocConfirmTtlSeconds', () => {
	it('defaults to 3600 seconds', () => {
		expect(resolveEnsembleDocConfirmTtlSeconds(undefined)).toBe(3600);
		expect(resolveEnsembleDocConfirmTtlSeconds({})).toBe(3600);
	});

	it('clamps admin override to 60..86400', () => {
		expect(
			resolveEnsembleDocConfirmTtlSeconds({
				desktop_ensemble_doc_confirm_ttl_seconds: 30,
			})
		).toBe(60);
		expect(
			resolveEnsembleDocConfirmTtlSeconds({
				desktop_ensemble_doc_confirm_ttl_seconds: 999_999,
			})
		).toBe(86_400);
		expect(
			resolveEnsembleDocConfirmTtlSeconds({
				desktop_ensemble_doc_confirm_ttl_seconds: '7200',
			})
		).toBe(7200);
	});
});

describe('ensembleDocConfirmAskedAtMs', () => {
	it('prefers ensemble_doc_confirm_asked_at over created_at', () => {
		const msg = askedMessage({
			created_at: '2026-06-17T09:00:00.000Z',
			metadata: {
				ensemble_doc_confirm: 'asked',
				ensemble_doc_confirm_asked_at: '2026-06-17T10:30:00.000Z',
			},
		});
		expect(ensembleDocConfirmAskedAtMs(msg)).toBe(
			Date.parse('2026-06-17T10:30:00.000Z')
		);
	});

	it('falls back to created_at when asked_at missing', () => {
		const msg = askedMessage({
			metadata: { ensemble_doc_confirm: 'asked' },
		});
		expect(ensembleDocConfirmAskedAtMs(msg)).toBe(
			Date.parse('2026-06-17T10:00:00.000Z')
		);
	});
});

describe('isEnsembleDocConfirmExpired', () => {
	it('returns false when confirm state is not asked', () => {
		const msg = askedMessage({
			metadata: { ensemble_doc_confirm: 'accepted' },
		});
		expect(
			isEnsembleDocConfirmExpired(msg, {}, Date.parse('2099-01-01T00:00:00Z'))
		).toBe(false);
	});

	it('returns false inside TTL window', () => {
		const askedAt = Date.parse('2026-06-17T10:00:00.000Z');
		const msg = askedMessage();
		expect(isEnsembleDocConfirmExpired(msg, {}, askedAt + 3_599_000)).toBe(
			false
		);
	});

	it('returns true after TTL expires', () => {
		const askedAt = Date.parse('2026-06-17T10:00:00.000Z');
		const msg = askedMessage();
		expect(isEnsembleDocConfirmExpired(msg, {}, askedAt + 3_601_000)).toBe(
			true
		);
	});

	it('respects custom TTL from settings defaults', () => {
		const askedAt = Date.parse('2026-06-17T10:00:00.000Z');
		const msg = askedMessage();
		const defaults = { desktop_ensemble_doc_confirm_ttl_seconds: 120 };
		expect(isEnsembleDocConfirmExpired(msg, defaults, askedAt + 119_000)).toBe(
			false
		);
		expect(isEnsembleDocConfirmExpired(msg, defaults, askedAt + 121_000)).toBe(
			true
		);
	});
});
