/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Security smoke tests for Product Assistant markdown link rendering.
 *
 * Invariants:
 * - External anchors require absolute http/https URLs via sanitizeMarkdownHref.
 * - javascript:, protocol-relative, and relative /path links stay inert text.
 *
 * Related:
 * - pages/Desktop/components/ProductAssistantMarkdown.tsx
 * - src/utils/markdownSecurity.ts
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProductAssistantMarkdown } from '../../ProductAssistantMarkdown';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../components/DesktopChromeTooltip', () => ({
	DesktopChromeTooltip: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
}));

vi.mock('../../../components/DesktopAppChrome', () => ({
	DesktopAppButton: ({
		children,
		onClick,
	}: {
		children: React.ReactNode;
		onClick?: () => void;
	}) => (
		<button type="button" onClick={onClick}>
			{children}
		</button>
	),
}));

describe('ProductAssistantMarkdown security', () => {
	it('keeps https links and disables javascript links', () => {
		render(
			<ProductAssistantMarkdown content="[bad](javascript:alert(1)) [good](https://example.com/path)" />
		);

		const goodLink = screen.getByRole('link', { name: 'good' });
		expect(goodLink.getAttribute('href')).toBe('https://example.com/path');
		expect(screen.queryByRole('link', { name: 'bad' })).toBeNull();
		expect(screen.getByText('bad').closest('a')).toBeNull();
	});

	it('blocks protocol-relative and relative path external anchors', () => {
		render(
			<ProductAssistantMarkdown content="[proto](//evil.example/path) [relative](/internal/path)" />
		);

		expect(screen.queryByRole('link', { name: 'proto' })).toBeNull();
		expect(screen.queryByRole('link', { name: 'relative' })).toBeNull();
		expect(screen.getByText('proto').closest('a')).toBeNull();
		expect(screen.getByText('relative').closest('a')).toBeNull();
	});

	it('renders desktop open-app links as buttons, not external anchors', () => {
		render(
			<ProductAssistantMarkdown content="[open](/__eliteew-desktop-open-app__/MusicForgeApp)" />
		);

		expect(screen.queryByRole('link', { name: 'open' })).toBeNull();
		expect(screen.getByRole('button', { name: 'open' })).toBeTruthy();
	});
});
