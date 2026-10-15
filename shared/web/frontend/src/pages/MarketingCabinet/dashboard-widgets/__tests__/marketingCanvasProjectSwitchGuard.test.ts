import { describe, expect, it } from 'vitest';
import { shouldConfirmMarketingCanvasDraftProjectSwitch } from '../marketingCanvasProjectSwitchGuard';

describe('shouldConfirmMarketingCanvasDraftProjectSwitch', () => {
	it('returns false when not on overview_dashboard', () => {
		expect(
			shouldConfirmMarketingCanvasDraftProjectSwitch({
				activeView: 'projects',
				currentProjectId: 'p1',
				nextProjectId: 'p2',
				hasDraftForCurrentProject: true,
			})
		).toBe(false);
	});

	it('returns false when no current project', () => {
		expect(
			shouldConfirmMarketingCanvasDraftProjectSwitch({
				activeView: 'overview_dashboard',
				currentProjectId: null,
				nextProjectId: 'p2',
				hasDraftForCurrentProject: true,
			})
		).toBe(false);
	});

	it('returns false when next equals current', () => {
		expect(
			shouldConfirmMarketingCanvasDraftProjectSwitch({
				activeView: 'overview_dashboard',
				currentProjectId: 'p1',
				nextProjectId: 'p1',
				hasDraftForCurrentProject: true,
			})
		).toBe(false);
	});

	it('returns false when no draft', () => {
		expect(
			shouldConfirmMarketingCanvasDraftProjectSwitch({
				activeView: 'overview_dashboard',
				currentProjectId: 'p1',
				nextProjectId: 'p2',
				hasDraftForCurrentProject: false,
			})
		).toBe(false);
	});

	it('returns true on dashboard with draft and different next project', () => {
		expect(
			shouldConfirmMarketingCanvasDraftProjectSwitch({
				activeView: 'overview_dashboard',
				currentProjectId: 'p1',
				nextProjectId: 'p2',
				hasDraftForCurrentProject: true,
			})
		).toBe(true);
	});

	it('returns true when clearing project (null) with draft', () => {
		expect(
			shouldConfirmMarketingCanvasDraftProjectSwitch({
				activeView: 'overview_dashboard',
				currentProjectId: 'p1',
				nextProjectId: null,
				hasDraftForCurrentProject: true,
			})
		).toBe(true);
	});
});
