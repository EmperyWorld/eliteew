/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for assistant chat bubble: desktop markdown links and local FAQ ask.
 *
 * Invariants:
 * - Legacy MusicGenerator href resolves to MusicForgeApp open dispatch.
 *
 * Related:
 * - pages/Desktop/components/assistant/AssistantChatMessageBubble.tsx
 * - pages/Desktop/components/ProductAssistantMarkdown.tsx
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AssistantChatMessage } from '../../../services/productDesktopApi';
import { AssistantChatMessageBubble } from '../AssistantChatMessageBubble';

const requestOpenDesktopApp = vi.hoisted(() => vi.fn());

vi.mock('../../../utils/desktopDeepLink', () => ({
	requestOpenDesktopApp: (...args: unknown[]) => requestOpenDesktopApp(...args),
	requestOpenDesktopShellSettings: vi.fn(),
	requestOpenStartMenu: vi.fn(),
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

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
		DesktopAppSurface: ({ children }: { children: React.ReactNode }) => (
			<div>{children}</div>
		),
	};
});

vi.mock('../../DesktopChromeTooltip', () => ({
	DesktopChromeTooltip: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
}));

vi.mock('../AssistantDesktopTooltip', () => ({
	AssistantDesktopTooltip: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
}));

const t = ((key: string) => key) as Parameters<
	typeof AssistantChatMessageBubble
>[0]['t'];

const noopAsync = vi.fn(async () => undefined);

function renderBubble(
	message: AssistantChatMessage,
	overrides: Partial<Parameters<typeof AssistantChatMessageBubble>[0]> = {}
) {
	return render(
		<AssistantChatMessageBubble
			message={message}
			language="ru"
			t={t}
			helpfulAckMessageId={null}
			copiedMessageFlashId={null}
			faqAskFlashId={null}
			faqAskDisabled={false}
			rateLimitSecondsLeft={0}
			sending={false}
			onCopyMessageText={noopAsync}
			onAcknowledgeHelpful={vi.fn()}
			onOpenFeedbackForExchange={vi.fn()}
			onTryAskFaq={vi.fn()}
			{...overrides}
		/>
	);
}

describe('AssistantChatMessageBubble', () => {
	it('desktop markdown link dispatches requestOpenDesktopApp (MusicForgeApp alias)', () => {
		requestOpenDesktopApp.mockClear();
		const message: AssistantChatMessage = {
			id: 'a-desktop-link',
			role: 'assistant',
			content:
				'Откройте [Студию песен](/__eliteew-desktop-open-app__/MusicGenerator).',
			created_at: '2026-01-01T00:00:00.000Z',
		};
		renderBubble(message);
		fireEvent.click(screen.getByRole('button', { name: 'Студию песен' }));
		expect(requestOpenDesktopApp).toHaveBeenCalledWith({
			appComponent: 'MusicForgeApp',
		});
	});

	it('faq-local assistant bubble shows faqAskModelFromLocal action', () => {
		const onTryAskFaq = vi.fn();
		const message: AssistantChatMessage = {
			id: 'faq-local-a-faq-1-123',
			role: 'assistant',
			content: 'FAQ cached answer',
			created_at: '2026-01-01T00:00:00.000Z',
		};
		renderBubble(message, {
			userQuestionForFeedback: 'FAQ question?',
			onTryAskFaq,
		});
		const askBtn = screen.getByRole('button', { name: 'faqAskModelFromLocal' });
		expect(askBtn).toBeTruthy();
		fireEvent.click(askBtn);
		expect(onTryAskFaq).toHaveBeenCalledWith(
			'FAQ question?',
			'faq-a-local-faq-local-a-faq-1-123'
		);
	});
});
