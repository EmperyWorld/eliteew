/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for FAQ chat actions: show-in-chat (local ids, no SSE), insert, ask.
 *
 * Invariants:
 * - Show-in-chat never calls sendAssistantMessageStream; ids use faq-local-* prefix.
 *
 * Related:
 * - pages/Desktop/components/assistant/assistantFaqChatActions.ts
 * - pages/Desktop/components/assistant/AssistantFaqCard.tsx
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AssistantFaqEntry } from '../../../services/productDesktopApi';
import { writeAssistantLocalFaqMessages } from '../../../utils/assistantLocalFaqStorage';
import { AssistantFaqCard } from '../AssistantFaqCard';
import {
	appendFaqQuestionToComposer,
	buildLocalFaqMessagesFromEntry,
} from '../assistantFaqChatActions';

const sendAssistantMessageStream = vi.hoisted(() => vi.fn());

vi.mock('../../../services/productDesktopApi', async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import('../../../services/productDesktopApi')
		>();
	return {
		...actual,
		sendAssistantMessageStream,
	};
});

vi.mock('../../DesktopAppChrome', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../DesktopAppChrome')>();
	return {
		...actual,
		DesktopAppButton: ({
			children,
			onClick,
			disabled,
			...rest
		}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
			<button type="button" onClick={onClick} disabled={disabled} {...rest}>
				{children}
			</button>
		),
		DesktopAppMenuSurface: ({ children }: { children: React.ReactNode }) => (
			<div>{children}</div>
		),
	};
});

vi.mock('../AssistantDesktopTooltip', () => ({
	AssistantDesktopTooltip: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
}));

vi.mock('../../DesktopChromeTooltip', () => ({
	DesktopChromeTooltip: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
}));

vi.mock('../ProductAssistantMarkdown', () => ({
	ProductAssistantMarkdown: ({ content }: { content: string }) => (
		<div>{content}</div>
	),
}));

vi.mock('../../context/DesktopWindowPortalStackContext', () => ({
	useDesktopWindowPortalStackBase: () => 1000,
}));

const t = ((key: string) => key) as Parameters<typeof AssistantFaqCard>[0]['t'];

const sampleEntry: AssistantFaqEntry = {
	id: 'faq-1',
	question: 'Как открыть магазин?',
	answer: 'Через меню «Пуск».',
	sort_order: 0,
};

describe('assistantFaqChatActions helpers', () => {
	it('buildLocalFaqMessagesFromEntry uses faq-local-u-/faq-local-a- ids', () => {
		const pair = buildLocalFaqMessagesFromEntry(sampleEntry, {
			stamp: 12345,
			createdAt: '2026-01-01T00:00:00.000Z',
		});
		expect(pair).toHaveLength(2);
		expect(pair[0]?.id).toBe('faq-local-u-faq-1-12345');
		expect(pair[1]?.id).toBe('faq-local-a-faq-1-12345');
		expect(pair[0]?.role).toBe('user');
		expect(pair[1]?.role).toBe('assistant');
	});

	it('appendFaqQuestionToComposer appends with newline when composer is non-empty', () => {
		expect(appendFaqQuestionToComposer('', 'Q1')).toBe('Q1');
		expect(appendFaqQuestionToComposer('existing', 'Q2')).toBe('existing\nQ2');
	});

	it('show in chat persists faq-local ids to sessionStorage without SSE', () => {
		sendAssistantMessageStream.mockClear();
		sessionStorage.clear();
		const pair = buildLocalFaqMessagesFromEntry(sampleEntry, { stamp: 99 });
		writeAssistantLocalFaqMessages(pair);
		const stored = JSON.parse(
			sessionStorage.getItem('eliteew.assistant.localFaq.v1') ?? '[]'
		) as { id: string }[];
		expect(stored.some((m) => m.id.startsWith('faq-local-u-'))).toBe(true);
		expect(stored.some((m) => m.id.startsWith('faq-local-a-'))).toBe(true);
		expect(sendAssistantMessageStream).not.toHaveBeenCalled();
	});
});

describe('AssistantFaqCard FAQ actions', () => {
	const baseProps = {
		entry: sampleEntry,
		faqSearch: '',
		openFaqIds: new Set<string>(),
		onOpenFaqIdsChange: vi.fn(),
		sending: false,
		copiedMessageFlashId: null,
		faqInsertFlashId: null,
		faqShowFlashId: null,
		faqAskFlashId: null,
		faqAskDisabled: false,
		faqAskDisabledTitle: undefined,
		onShowFaqInChat: vi.fn(),
		onCopyMessageText: vi.fn(),
		onInsertFaqQuestion: vi.fn(),
		onTryAskFaq: vi.fn(),
		t,
	};

	it('show in chat delegates to onShowFaqInChat without stream', () => {
		const onShowFaqInChat = vi.fn();
		render(
			<ul>
				<AssistantFaqCard {...baseProps} onShowFaqInChat={onShowFaqInChat} />
			</ul>
		);
		fireEvent.click(screen.getByText('faqShowInChat'));
		expect(onShowFaqInChat).toHaveBeenCalledWith(sampleEntry);
		expect(baseProps.onTryAskFaq).not.toHaveBeenCalled();
		expect(sendAssistantMessageStream).not.toHaveBeenCalled();
	});

	it('insert delegates to onInsertFaqQuestion only (composer path)', () => {
		const onInsertFaqQuestion = vi.fn();
		render(
			<ul>
				<AssistantFaqCard
					{...baseProps}
					onInsertFaqQuestion={onInsertFaqQuestion}
				/>
			</ul>
		);
		fireEvent.click(screen.getByLabelText('faqMoreActions'));
		fireEvent.click(screen.getByText('faqInsert'));
		expect(onInsertFaqQuestion).toHaveBeenCalledWith(
			sampleEntry.question,
			'faq-i-faq-1'
		);
		expect(baseProps.onTryAskFaq).not.toHaveBeenCalled();
		expect(sendAssistantMessageStream).not.toHaveBeenCalled();
	});

	it('ask delegates to onTryAskFaq (stream path)', () => {
		const onTryAskFaq = vi.fn();
		render(
			<ul>
				<AssistantFaqCard {...baseProps} onTryAskFaq={onTryAskFaq} />
			</ul>
		);
		fireEvent.click(screen.getByLabelText('faqMoreActions'));
		fireEvent.click(screen.getByText('faqSend'));
		expect(onTryAskFaq).toHaveBeenCalledWith(
			sampleEntry.question,
			'faq-a-faq-1'
		);
	});
});
