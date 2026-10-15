/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for useCompanionMobileDeepLinkBootstrap (U8.1 extract).
 */

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCompanionMobileDeepLinkBootstrap } from '@/features/ewa/companionUx/useCompanionMobileDeepLinkBootstrap';

const originalHash = window.location.hash;

afterEach(() => {
	window.location.hash = originalHash;
});

describe('useCompanionMobileDeepLinkBootstrap', () => {
	it('focuses operation run from hash on mobile layout', () => {
		window.location.hash = '#/mobile-ewa-companion?operation=run-deep';
		const focusOperationRun = vi.fn();
		const onOpenToolsCatalog = vi.fn();
		const onOpenMyPhrases = vi.fn();
		const onOpenWorkflowEdit = vi.fn();

		renderHook(() =>
			useCompanionMobileDeepLinkBootstrap({
				mobileEmbeddedLayout: true,
				focusOperationRun,
				onOpenToolsCatalog,
				onOpenMyPhrases,
				onOpenWorkflowEdit,
			})
		);

		expect(focusOperationRun).toHaveBeenCalledWith('run-deep');
		expect(onOpenToolsCatalog).not.toHaveBeenCalled();
	});

	it('opens tools catalog from tools deep link', () => {
		window.location.hash = '#/mobile-ewa-companion?tools=1';
		const focusOperationRun = vi.fn();
		const onOpenToolsCatalog = vi.fn();

		renderHook(() =>
			useCompanionMobileDeepLinkBootstrap({
				mobileEmbeddedLayout: true,
				focusOperationRun,
				onOpenToolsCatalog: onOpenToolsCatalog,
				onOpenMyPhrases: vi.fn(),
				onOpenWorkflowEdit: vi.fn(),
			})
		);

		expect(onOpenToolsCatalog).toHaveBeenCalledTimes(1);
		expect(focusOperationRun).not.toHaveBeenCalled();
	});

	it('no-ops when not on mobile embedded layout', () => {
		window.location.hash = '#/mobile-ewa-companion?operation=run-deep';
		const focusOperationRun = vi.fn();

		renderHook(() =>
			useCompanionMobileDeepLinkBootstrap({
				mobileEmbeddedLayout: false,
				focusOperationRun,
				onOpenToolsCatalog: vi.fn(),
				onOpenMyPhrases: vi.fn(),
				onOpenWorkflowEdit: vi.fn(),
			})
		);

		expect(focusOperationRun).not.toHaveBeenCalled();
	});
});
