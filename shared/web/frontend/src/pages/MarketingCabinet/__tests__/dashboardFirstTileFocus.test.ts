import { describe, it, expect, beforeEach } from 'vitest';

import { focusFirstInteractiveInDashboardFirstTile } from '../dashboardFirstTileFocus';

describe('focusFirstInteractiveInDashboardFirstTile', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('focuses the first button inside the first tile', () => {
		const tile = document.createElement('div');
		tile.id = 'mc-dashboard-first-tile';
		tile.tabIndex = -1;
		const b1 = document.createElement('button');
		b1.type = 'button';
		const b2 = document.createElement('button');
		b2.type = 'button';
		tile.appendChild(b1);
		tile.appendChild(b2);
		document.body.appendChild(tile);
		expect(focusFirstInteractiveInDashboardFirstTile()).toBe(true);
		expect(document.activeElement).toBe(b1);
	});

	it('focuses tile root when no focusable descendants', () => {
		const tile = document.createElement('div');
		tile.id = 'mc-dashboard-first-tile';
		tile.tabIndex = -1;
		document.body.appendChild(tile);
		expect(focusFirstInteractiveInDashboardFirstTile()).toBe(true);
		expect(document.activeElement).toBe(tile);
	});

	it('returns false when tile is missing', () => {
		expect(focusFirstInteractiveInDashboardFirstTile()).toBe(false);
	});
});
