import { render, screen } from '@testing-library/react';
import { useRef, type JSX } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { useSyncDesktopThemeFromMain } from '../useSyncDesktopThemeFromMain';

function TestHost({ enabled }: { enabled: boolean }): JSX.Element {
	const ref = useRef<HTMLDivElement>(null);
	useSyncDesktopThemeFromMain(enabled, ref);
	return <div ref={ref} data-testid="portal-target" />;
}

describe('useSyncDesktopThemeFromMain', () => {
	afterEach(() => {
		document.body.replaceChildren();
		document.documentElement.classList.remove('dark');
	});

	function mountDesktopMain() {
		const main = document.createElement('div');
		main.id = 'desktop-main';
		main.setAttribute('data-theme', 'dark');
		main.style.setProperty('--desktop-test-token', 'ok');
		document.body.appendChild(main);
	}

	it('копирует inline --* и data-theme на узел при enabled, снимает при выключении', () => {
		mountDesktopMain();
		const { rerender, unmount } = render(<TestHost enabled={false} />);
		const el = screen.getByTestId('portal-target');

		expect(el.style.getPropertyValue('--desktop-test-token')).toBe('');

		rerender(<TestHost enabled />);
		expect(el.style.getPropertyValue('--desktop-test-token')).toBe('ok');
		expect(el.getAttribute('data-theme')).toBe('dark');
		expect(el.classList.contains('dark')).toBe(true);

		rerender(<TestHost enabled={false} />);
		expect(el.style.getPropertyValue('--desktop-test-token')).toBe('');
		expect(el.hasAttribute('data-theme')).toBe(false);

		unmount();
	});
});
