/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression lock for forward-only boot phase store used by entry orchestration.
 *
 * Invariants:
 * - Phases never regress without explicit reset.
 *
 * Related:
 * - `services/boot/bootstrappingState.ts`
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
	BootstrappingPhase,
	getBootstrappingPhase,
	resetBootstrappingState,
	setBootstrappingPhase,
} from '../bootstrappingState';

afterEach(() => {
	resetBootstrappingState();
});

describe('bootstrappingState', () => {
	it('advances phases forward only', () => {
		expect(getBootstrappingPhase()).toBe(BootstrappingPhase.BRANDING);
		setBootstrappingPhase(BootstrappingPhase.AUTHENTICATING);
		setBootstrappingPhase(BootstrappingPhase.SYNCING_WORKSPACE);
		setBootstrappingPhase(BootstrappingPhase.READY);
		expect(getBootstrappingPhase()).toBe(BootstrappingPhase.READY);
		setBootstrappingPhase(BootstrappingPhase.AUTHENTICATING);
		expect(getBootstrappingPhase()).toBe(BootstrappingPhase.READY);
	});

	it('reset returns to BRANDING', () => {
		setBootstrappingPhase(BootstrappingPhase.READY);
		resetBootstrappingState();
		expect(getBootstrappingPhase()).toBe(BootstrappingPhase.BRANDING);
	});
});
