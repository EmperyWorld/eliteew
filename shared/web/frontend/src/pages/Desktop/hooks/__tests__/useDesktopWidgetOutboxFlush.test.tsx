/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave B flush hook: 500 mid-flush keeps outbox and surfaces syncError state.
 *
 * Related:
 * - hooks/useDesktopWidgetOutboxFlush.ts
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearDesktopWidgetOutbox,
	enqueueDesktopWidgetOutboxOp,
	getDesktopWidgetOutboxCount,
} from '../../utils/desktopWidgetOutboxQueue';
import { useDesktopWidgetOutboxFlush } from '../useDesktopWidgetOutboxFlush';

const syncDesktopWidgets = vi.hoisted(() => vi.fn());

vi.mock('../../services/desktopApi', () => ({
	syncDesktopWidgets,
}));

function wrapper(client: QueryClient) {
	return function W({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={client}>{children}</QueryClientProvider>
		);
	};
}

describe('useDesktopWidgetOutboxFlush', () => {
	beforeEach(() => {
		localStorage.clear();
		clearDesktopWidgetOutbox();
		syncDesktopWidgets.mockReset();
	});

	it('on HTTP 500 keeps outbox and sets widgetOutboxFlushFailed (syncError)', async () => {
		const subject = 'user-flush-500';
		enqueueDesktopWidgetOutboxOp(subject, {
			kind: 'note_create',
			client_id: 'n1',
			payload: { content: 'x' },
		});
		syncDesktopWidgets.mockRejectedValue(
			new Error('HTTP 500 widget-sync apply failed')
		);

		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const { result } = renderHook(
			() =>
				useDesktopWidgetOutboxFlush({
					persistSubjectKey: subject,
					isOnline: true,
				}),
			{ wrapper: wrapper(client) }
		);

		await act(async () => {
			const ok = await result.current.flushWidgetOutbox();
			expect(ok).toBe(false);
		});

		await waitFor(() => {
			expect(result.current.widgetOutboxFlushFailed).toMatch(/500/);
		});
		expect(getDesktopWidgetOutboxCount(subject)).toBe(1);
		expect(result.current.widgetOutboxPendingCount).toBe(1);
	});
});
