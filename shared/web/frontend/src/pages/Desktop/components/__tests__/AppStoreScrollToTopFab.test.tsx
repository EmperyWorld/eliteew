import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import '@/i18n/config';
import { AppStoreScrollToTopFab } from '../AppStoreScrollToTopFab';

describe('AppStoreScrollToTopFab', () => {
	it('scrolls the catalog container to top when clicked', () => {
		const scrollRef = createRef<HTMLDivElement>();
		const scrollTo = vi.fn();

		render(
			<div>
				<div
					ref={scrollRef}
					data-testid="scroll"
					style={{ height: 200, overflow: 'auto' }}
				>
					<div style={{ height: 800 }} />
				</div>
				<AppStoreScrollToTopFab
					scrollRef={scrollRef}
					t={((key: string) => key) as never}
					reduceMotion
					active
				/>
			</div>
		);

		const el = scrollRef.current;
		expect(el).toBeTruthy();
		if (!el) return;

		el.scrollTo = scrollTo;
		act(() => {
			Object.defineProperty(el, 'scrollTop', {
				value: 500,
				writable: true,
				configurable: true,
			});
			el.dispatchEvent(new Event('scroll'));
		});

		const btn = screen.getByRole('button', { name: 'scrollToTop.aria' });
		fireEvent.click(btn);
		expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
	});
});
