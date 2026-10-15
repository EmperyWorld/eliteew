import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesktopAppSkeleton } from '../DesktopAppChrome';

describe('DesktopAppSkeleton', () => {
	it('applies motion-safe pulse and reduced-motion guard', () => {
		const { container } = render(
			<DesktopAppSkeleton data-testid="desktop-app-skeleton" />
		);
		const el = container.firstChild as HTMLElement;
		expect(el.className).toMatch(/motion-safe:animate-pulse/);
		expect(el.className).toMatch(/motion-reduce:animate-none/);
	});
});
