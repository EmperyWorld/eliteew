/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Component-level coverage for the mounted EWA SVG sprite host.
 *
 * Invariants:
 * - Raw sprite symbol labels must stay hidden from visible text extraction and accessibility snapshots.
 *
 * Related:
 * - src/features/ewa/ewaIcons/EwaIconSprites.tsx
 * - src/features/ewa/ewaIcons/ewa-icons.css
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EwaIconSprites } from '../EwaIconSprites';

describe('EwaIconSprites', () => {
	it('keeps raw sprite text hidden from user-facing chrome', () => {
		const { container } = render(<EwaIconSprites />);

		const host = container.querySelector('.ewa-icon-sprites-host');
		expect(host).toBeInstanceOf(HTMLDivElement);
		expect(host).toHaveAttribute('aria-hidden', 'true');
		expect(host).toHaveAttribute('hidden');
		expect(host?.textContent).toContain('AI');
		expect(container.innerText ?? '').not.toContain('AI WEB');
	});
});
