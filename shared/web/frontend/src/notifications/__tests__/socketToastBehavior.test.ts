import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationEvent } from '@/services/communication/EmperyworldSocketService';
import { buildSocketToastOptions } from '../socketToastOptions';
import type { NotificationInput } from '../types';
import { showDocCollabInviteToast } from '../docCollabInviteSonner';

const { customMock } = vi.hoisted(() => ({
	customMock: vi.fn(),
}));

vi.mock('sonner', () => ({
	toast: {
		custom: customMock,
		dismiss: vi.fn(),
	},
}));

describe('socket toast behavior', () => {
	beforeEach(() => {
		customMock.mockReset();
	});

	it('keeps regular socket toasts finite while adding to center', () => {
		const center: NotificationInput = {
			type: 'info',
			title: 'Regular event',
			message: 'Should auto-dismiss',
			persistent: true,
			source: 'gaf_chat',
		};

		const opts = buildSocketToastOptions({
			shouldAddToCenter: true,
			center,
		});

		expect(opts).toEqual({
			addToCenter: true,
			center,
			className: expect.any(String),
		});
		expect(opts && 'duration' in opts).toBe(false);
	});

	it('applies source visual class for socket toast without forcing center entry', () => {
		const opts = buildSocketToastOptions({
			shouldAddToCenter: false,
			center: {
				type: 'info',
				title: 'Incoming',
				message: 'From UGS',
				source: 'ugs',
			},
		});
		expect(opts).toEqual({
			className: expect.any(String),
		});
		expect(opts?.className?.length).toBeGreaterThan(0);
	});

	it('uses infinite duration only for doc-collab invite custom toast', () => {
		const event: NotificationEvent = {
			id: 'doc-invite-1',
			type: 'info',
			title: 'Doc invite',
			message: 'Join collaboration',
			priority: 'high',
			persistent: true,
			created_at: '2026-04-10T00:00:00.000Z',
			source: 'doc_editor',
		};

		showDocCollabInviteToast({
			level: 'info',
			event,
			serverActions: [
				{ label: 'Accept', action: 'doc_collab_invite_accept' },
				{ label: 'Decline', action: 'doc_collab_invite_decline' },
			],
			metaObj: { kind: 'doc_collaboration_invite', invite_id: 'inv-1' },
		});

		expect(customMock).toHaveBeenCalledTimes(1);
		expect(customMock).toHaveBeenCalledWith(expect.any(Function), {
			id: event.id,
			duration: Number.POSITIVE_INFINITY,
			classNames: expect.any(Object),
		});
	});
});
