/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified identity gate shows AUTHENTICATING during auth load and releases children when ready.
 *
 * Invariants:
 * - Unauthenticated users after auth settle see children (login fallback), not infinite gate.
 *
 * Related:
 * - `components/IdentityVerificationGate.tsx`
 */

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { IdentityVerificationGate } from '../IdentityVerificationGate';
import {
	BootstrappingPhase,
	resetBootstrappingState,
	setBootstrappingPhase,
} from '@/services/boot/bootstrappingState';

afterEach(() => {
	resetBootstrappingState();
});

describe('IdentityVerificationGate', () => {
	it('passes children while auth context is still loading (AppRouter owns route loaders)', () => {
		setBootstrappingPhase(BootstrappingPhase.AUTHENTICATING);
		render(
			<IdentityVerificationGate isAuthenticated={false} isAuthLoading>
				<div data-testid="app-child">child</div>
			</IdentityVerificationGate>
		);
		expect(screen.getByTestId('app-child')).toBeTruthy();
	});

	it('renders children when authenticated during workspace sync (no mount deadlock)', () => {
		setBootstrappingPhase(BootstrappingPhase.SYNCING_WORKSPACE);
		render(
			<IdentityVerificationGate isAuthenticated isAuthLoading={false}>
				<div data-testid="app-child">child</div>
			</IdentityVerificationGate>
		);
		expect(screen.getByTestId('app-child')).toBeTruthy();
	});

	it('renders children when unauthenticated and auth settled', () => {
		setBootstrappingPhase(BootstrappingPhase.READY);
		render(
			<IdentityVerificationGate isAuthenticated={false} isAuthLoading={false}>
				<div data-testid="app-child">child</div>
			</IdentityVerificationGate>
		);
		expect(screen.getByTestId('app-child')).toBeTruthy();
	});
});
