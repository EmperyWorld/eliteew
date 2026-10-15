/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock freeform (non-blueprint) «Пройти интервью» CTA visibility and click.
 *
 * Invariants:
 * - Same canShowInterviewHandoffCta gate as blueprint header.
 * - Click invokes start handler once; never auto-starts.
 *
 * Related:
 * - ../FreeformInterviewHandoffBar.tsx
 * - ../interviewHandoff.ts
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { DesktopAiMessage } from '../../api/desktopChatClient';
import { FreeformInterviewHandoffBar } from '../FreeformInterviewHandoffBar';

const t = ((key: string) => key) as never;

const interviewMarkdown = `## Тема интервью

Стратегический вектор EliteEW.

## Цель интервью

Синхронизировать видение основателя.
`;

function msg(
	partial: Partial<DesktopAiMessage> & { content: string }
): DesktopAiMessage {
	return {
		id: '550e8400-e29b-41d4-a716-446655440000',
		role: 'assistant',
		created_at: '2026-08-15T00:00:00Z',
		...partial,
	} as DesktopAiMessage;
}

describe('FreeformInterviewHandoffBar', () => {
	it('shows Take interview and calls start on click', () => {
		const onStart = vi.fn();
		const message = msg({ content: interviewMarkdown });
		render(
			<FreeformInterviewHandoffBar
				message={message}
				onStartInterviewFromMessage={onStart}
				interviewStartBusy={false}
				t={t}
			/>
		);
		expect(screen.getByTestId('freeform-interview-handoff-bar')).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'interviewTakeAria' }));
		expect(onStart).toHaveBeenCalledTimes(1);
		expect(onStart).toHaveBeenCalledWith(message);
	});

	it('hides when body has no interview headings', () => {
		render(
			<FreeformInterviewHandoffBar
				message={msg({ content: '## Marketing brief\n\nBody' })}
				onStartInterviewFromMessage={vi.fn()}
				interviewStartBusy={false}
				t={t}
			/>
		);
		expect(screen.queryByTestId('freeform-interview-handoff-bar')).toBeNull();
	});

	it('hides for local streaming message ids', () => {
		render(
			<FreeformInterviewHandoffBar
				message={msg({ id: 'local-stream-1', content: interviewMarkdown })}
				onStartInterviewFromMessage={vi.fn()}
				interviewStartBusy={false}
				t={t}
			/>
		);
		expect(screen.queryByTestId('freeform-interview-handoff-bar')).toBeNull();
	});
});
