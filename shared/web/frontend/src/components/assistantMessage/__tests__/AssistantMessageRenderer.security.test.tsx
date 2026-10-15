/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Security smoke tests for assistant markdown rendering in desktop/GAF bubbles.
 *
 * Invariants:
 * - `javascript:` links never become clickable anchors.
 * - Raw `<script>` payloads from model output must not create script DOM nodes.
 *
 * Related:
 * - src/components/assistantMessage/AssistantMessageRenderer.tsx
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import AssistantMessageRenderer from '@/components/assistantMessage/AssistantMessageRenderer';

describe('AssistantMessageRenderer security', () => {
	it('keeps https links and disables javascript links', () => {
		render(
			<AssistantMessageRenderer content="[bad](javascript:alert(1)) [good](https://example.com/path)" />
		);

		const goodLink = screen.getByRole('link', { name: 'good' });
		expect(goodLink.getAttribute('href')).toBe('https://example.com/path');
		expect(screen.queryByRole('link', { name: 'bad' })).toBeNull();
		expect(screen.getByText('bad').closest('a')).toBeNull();
	});

	it('does not render raw script nodes from markdown payload', () => {
		const { container } = render(
			<AssistantMessageRenderer
				content={'safe text\n\n<script>alert(1)</script>'}
			/>
		);

		expect(container.querySelector('script')).toBeNull();
	});
});
