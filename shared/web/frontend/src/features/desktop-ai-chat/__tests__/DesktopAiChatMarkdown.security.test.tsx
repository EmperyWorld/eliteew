/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Security smoke coverage for Desktop AI Chat markdown surface.
 *
 * Invariants:
 * - Unsafe markdown links (`javascript:` etc.) are rendered as non-clickable text.
 * - Raw script payload from model output never appears as executable `<script>` in DOM.
 *
 * Related:
 * - src/features/desktop-ai-chat/DesktopAiChatMarkdown.tsx
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DesktopAiChatMarkdown } from '@/features/desktop-ai-chat/DesktopAiChatMarkdown';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('sonner', () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

describe('DesktopAiChatMarkdown security', () => {
	beforeEach(() => {
		document.documentElement.classList.add('dark');
	});

	it('keeps https links and blocks javascript links', () => {
		render(
			<DesktopAiChatMarkdown markdown="[bad](javascript:alert(1)) [good](https://example.com/path)" />
		);

		const goodLink = screen.getByRole('link', { name: 'good' });
		expect(goodLink.getAttribute('href')).toBe('https://example.com/path');
		expect(screen.queryByRole('link', { name: 'bad' })).toBeNull();
		expect(screen.getByText('bad').closest('a')).toBeNull();
	});

	it('does not render raw script nodes from markdown payload', () => {
		const { container } = render(
			<DesktopAiChatMarkdown
				markdown={'safe text\n\n<script>alert(1)</script>'}
			/>
		);

		expect(container.querySelector('script')).toBeNull();
	});

	it('uses document reading rhythm and code line numbers for expert artifacts', () => {
		const { container } = render(
			<DesktopAiChatMarkdown
				presentation="document"
				markdown={
					'## Implementation\n\n```ts\nconst first = 1;\nconst second = 2;\n```'
				}
			/>
		);

		const root = container.querySelector(
			'[data-markdown-presentation="document"]'
		);
		expect(root?.className).toContain('prose-base');
		expect(root?.className).toContain('prose-h2:text-lg');
		expect(screen.getByText('ts')).toBeTruthy();
		expect(
			Array.from(container.querySelectorAll('[aria-hidden]')).some(
				(node) => node.textContent === '12'
			)
		).toBe(true);
	});

	it('wraps document table cells for careful multi-column layout', () => {
		const { container } = render(
			<DesktopAiChatMarkdown
				presentation="document"
				markdown={
					'| Параметр | Must have | Nice to have |\n| --- | --- | --- |\n| Данные | Один источник правды без потери контекста кампании | Десять разрозненных источников |'
				}
			/>
		);

		const table = container.querySelector('table');
		expect(table).toBeTruthy();
		expect(table?.className).toContain('break-words');
		expect(table?.className).toContain('align-top');
		expect(table?.className).toContain('table-fixed');
		expect(table?.className).toContain('max-w-0');
		expect(table?.closest('div')?.className).toContain('overflow-x-auto');
		expect(screen.getByText('Must have')).toBeTruthy();
		expect(
			screen.getByText(/Один источник правды без потери контекста кампании/)
		).toBeTruthy();
	});

	it('strips Gemma channel thought markup from visible document markdown', () => {
		const { container } = render(
			<DesktopAiChatMarkdown
				presentation="document"
				markdown={
					'<|channel>thought <channel|>## Ценность\n\nICP для научной группы.'
				}
			/>
		);
		expect(container.textContent).not.toMatch(/channel/i);
		expect(container.textContent).toContain('Ценность');
		expect(container.textContent).toContain('ICP для научной группы');
	});
});
