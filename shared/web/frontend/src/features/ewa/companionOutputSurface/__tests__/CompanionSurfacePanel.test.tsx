/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Component-level regression coverage for shared EWA output-surface panel accessibility chrome.
 *
 * Invariants:
 * - Titled panels expose a named region and real heading.
 * - Hidden-header panels keep an accessible region name.
 *
 * Related:
 * - ../CompanionSurfacePanel
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionSurfacePanel } from '../CompanionSurfacePanel';

describe('CompanionSurfacePanel', () => {
	it('exposes visible titled panels as named regions with headings', () => {
		render(
			<CompanionSurfacePanel
				title="File results"
				subtitle="Found: 2"
				onBack={vi.fn()}
				backLabel="Back"
			>
				<div>Panel body</div>
			</CompanionSurfacePanel>
		);

		const region = screen.getByRole('region', { name: 'File results' });
		expect(region).toHaveAccessibleDescription('Found: 2');
		expect(
			screen.getByRole('heading', { name: 'File results', level: 2 })
		).toBeInTheDocument();
	});

	it('keeps hidden-header panels named for screen readers', () => {
		render(
			<CompanionSurfacePanel
				title="Document editor"
				onBack={vi.fn()}
				backLabel="Back"
				hideHeader
			>
				<div>Editor body</div>
			</CompanionSurfacePanel>
		);

		expect(
			screen.getByRole('region', { name: 'Document editor' })
		).toBeInTheDocument();
		expect(screen.queryByRole('heading')).not.toBeInTheDocument();
	});
});
