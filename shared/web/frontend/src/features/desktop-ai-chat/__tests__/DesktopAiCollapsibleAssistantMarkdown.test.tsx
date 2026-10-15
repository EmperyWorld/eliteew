/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock collapsible markdown: clamp tall content; keep toggle after expand.
 *
 * Related:
 * - DesktopAiCollapsibleAssistantMarkdown.tsx
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DesktopAiCollapsibleAssistantMarkdown } from '../DesktopAiCollapsibleAssistantMarkdown';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('@/hooks/useDesktopShellTheme', () => ({
	useDesktopShellTheme: () => 'dark',
}));

vi.mock('../DesktopAiChatMarkdown', () => ({
	DesktopAiChatMarkdown: ({ markdown }: { markdown: string }) => (
		<div data-testid="md-inner">{markdown}</div>
	),
}));

describe('DesktopAiCollapsibleAssistantMarkdown', () => {
	beforeEach(() => {
		Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
			configurable: true,
			get() {
				return 2000;
			},
		});
	});

	it('clamps tall content and keeps collapse control after expand', () => {
		render(
			<DesktopAiCollapsibleAssistantMarkdown
				markdown={`## Long\n\n${'x\n'.repeat(40)}`}
				maxCollapsedPx={400}
			/>
		);

		const body = screen.getByTestId('desktop-ai-collapsible-md-body');
		expect(body.style.maxHeight).toBe('400px');

		const toggle = screen.getByTestId('desktop-ai-collapsible-md-toggle');
		expect(toggle).toHaveAttribute('aria-expanded', 'false');

		fireEvent.click(toggle);
		expect(toggle).toHaveAttribute('aria-expanded', 'true');
		expect(body.style.maxHeight).toBe('');
		expect(
			screen.getByTestId('desktop-ai-collapsible-md-toggle')
		).toBeInTheDocument();
		expect(screen.getByText('markdownCollapse')).toBeInTheDocument();

		fireEvent.click(screen.getByTestId('desktop-ai-collapsible-md-toggle'));
		expect(body.style.maxHeight).toBe('400px');
	});

	it('keeps toggle when controlled expanded starts true', () => {
		render(
			<DesktopAiCollapsibleAssistantMarkdown
				markdown={`## Long\n\n${'y\n'.repeat(40)}`}
				maxCollapsedPx={400}
				expanded
				onExpandedChange={vi.fn()}
			/>
		);

		expect(
			screen.getByTestId('desktop-ai-collapsible-md-toggle')
		).toBeInTheDocument();
		expect(screen.getByText('markdownCollapse')).toBeInTheDocument();
	});
});
