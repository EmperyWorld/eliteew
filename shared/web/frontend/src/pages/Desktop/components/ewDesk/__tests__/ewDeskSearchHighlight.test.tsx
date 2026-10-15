import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { highlightEwDeskSearchText } from '../ewDeskSearchHighlight';

describe('highlightEwDeskSearchText', () => {
	it('returns plain text when query is empty', () => {
		expect(highlightEwDeskSearchText('Hello world', '')).toBe('Hello world');
	});

	it('wraps matched tokens in mark elements', () => {
		const { container } = render(
			<span>{highlightEwDeskSearchText('Release notes today', 'release')}</span>
		);
		expect(container.querySelector('mark')?.textContent).toBe('Release');
	});

	it('matches multiple whitespace-separated terms case-insensitively', () => {
		const { container } = render(
			<span>
				{highlightEwDeskSearchText('Alpha beta gamma', 'alpha GAMMA')}
			</span>
		);
		expect(container.querySelectorAll('mark')).toHaveLength(2);
	});
});
