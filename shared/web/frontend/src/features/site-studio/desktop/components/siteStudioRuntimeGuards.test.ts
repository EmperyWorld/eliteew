/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Validate Site Studio runtime guardrails for launch-control action states.
 *
 * Invariants:
 * - Pending transitions disable all launch actions.
 * - Running status disables start and enables stop/redeploy.
 * - Busy action key has highest priority over semantic disable reasons.
 *
 * Related:
 * - `features/site-studio/desktop/components/siteStudioRuntimeGuards.ts`
 * - `features/site-studio/desktop/components/SiteStudioRuntimePanel.tsx`
 */
import { describe, expect, it } from 'vitest';
import {
	computeSiteStudioRuntimeGuards,
	isSiteStudioPendingStatus,
} from './siteStudioRuntimeGuards';

describe('siteStudioRuntimeGuards', () => {
	it('recognizes pending statuses case-insensitively', () => {
		expect(isSiteStudioPendingStatus('starting')).toBe(true);
		expect(isSiteStudioPendingStatus('ReDeploying')).toBe(true);
		expect(isSiteStudioPendingStatus('running')).toBe(false);
		expect(isSiteStudioPendingStatus(null)).toBe(false);
	});

	it('disables start while runtime is already running', () => {
		const guards = computeSiteStudioRuntimeGuards({
			instanceStatus: 'running',
			healthStatus: 'running',
			publicationState: 'open',
			busyKeys: new Set(),
		});

		expect(guards.isRunning).toBe(true);
		expect(guards.start.disabled).toBe(true);
		expect(guards.start.reason).toBe('already_running');
		expect(guards.stop.disabled).toBe(false);
		expect(guards.redeploy.disabled).toBe(false);
	});

	it('enables start and blocks stop/redeploy for stopped runtime', () => {
		const guards = computeSiteStudioRuntimeGuards({
			instanceStatus: 'stopped',
			healthStatus: 'offline',
			publicationState: 'closed',
			busyKeys: new Set(),
		});

		expect(guards.isRunning).toBe(false);
		expect(guards.start.disabled).toBe(false);
		expect(guards.stop.disabled).toBe(true);
		expect(guards.stop.reason).toBe('already_stopped');
		expect(guards.redeploy.disabled).toBe(true);
		expect(guards.redeploy.reason).toBe('needs_running');
	});

	it('locks all actions while pending transition is active', () => {
		const guards = computeSiteStudioRuntimeGuards({
			instanceStatus: 'starting',
			healthStatus: 'starting',
			publicationState: 'closed',
			busyKeys: new Set(),
		});

		expect(guards.isPending).toBe(true);
		expect(guards.provision.reason).toBe('pending');
		expect(guards.start.reason).toBe('pending');
		expect(guards.stop.reason).toBe('pending');
		expect(guards.redeploy.reason).toBe('pending');
		expect(guards.publishToggle.reason).toBe('pending');
	});

	it('applies busy reason as top priority for specific action', () => {
		const guards = computeSiteStudioRuntimeGuards({
			instanceStatus: 'running',
			healthStatus: 'running',
			publicationState: 'open',
			busyKeys: new Set(['stop']),
		});

		expect(guards.stop.disabled).toBe(true);
		expect(guards.stop.reason).toBe('busy');
	});

	it('resolves publish busy key according to publication state', () => {
		const openGuards = computeSiteStudioRuntimeGuards({
			instanceStatus: 'running',
			healthStatus: 'running',
			publicationState: 'open',
			busyKeys: new Set(['unpublish']),
		});
		expect(openGuards.publishToggle.reason).toBe('busy');

		const closedGuards = computeSiteStudioRuntimeGuards({
			instanceStatus: 'running',
			healthStatus: 'running',
			publicationState: 'closed',
			busyKeys: new Set(['publish']),
		});
		expect(closedGuards.publishToggle.reason).toBe('busy');
	});
});
