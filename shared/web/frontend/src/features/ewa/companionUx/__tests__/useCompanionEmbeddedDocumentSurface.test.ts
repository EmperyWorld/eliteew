/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for useCompanionEmbeddedDocumentSurface (U8.3 slice 10).
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useCompanionEmbeddedDocumentSurface } from '@/features/ewa/companionUx/useCompanionEmbeddedDocumentSurface';

const saveCompanionOutputSurfaceState = vi.fn();

vi.mock(
	'@/features/ewa/companionOutputSurface/companionOutputSurfaceState',
	() => ({
		saveCompanionOutputSurfaceState: (...args: unknown[]) =>
			saveCompanionOutputSurfaceState(...args),
	})
);

describe('useCompanionEmbeddedDocumentSurface', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('opens document_editor surface with unified content id', () => {
		const setOutputSurface = vi.fn();
		const { result } = renderHook(() =>
			useCompanionEmbeddedDocumentSurface({
				principalId: 'principal-1',
				setOutputSurface,
			})
		);
		act(() => {
			result.current.openEmbeddedDocumentSurface({
				unifiedContentId: 'uc-42',
				title: 'Draft',
				rationale: 'From companion',
			});
		});
		expect(setOutputSurface).toHaveBeenCalledWith({
			mode: 'document_editor',
			payload: {
				source: 'companion_action',
				unifiedContentId: 'uc-42',
				title: 'Draft',
				rationale: 'From companion',
			},
		});
		expect(saveCompanionOutputSurfaceState).toHaveBeenCalledWith(
			'principal-1',
			expect.objectContaining({ mode: 'document_editor' })
		);
	});

	it('opens document_editor from initialHtml without uc id', () => {
		const setOutputSurface = vi.fn();
		const { result } = renderHook(() =>
			useCompanionEmbeddedDocumentSurface({
				principalId: 'principal-1',
				setOutputSurface,
			})
		);
		act(() => {
			result.current.openEmbeddedDocumentSurface({
				initialHtml: '<p>Hello</p>',
			});
		});
		expect(setOutputSurface).toHaveBeenCalledWith({
			mode: 'document_editor',
			payload: {
				source: 'companion_action',
				initialHtml: '<p>Hello</p>',
			},
		});
	});

	it('ignores empty input', () => {
		const setOutputSurface = vi.fn();
		const { result } = renderHook(() =>
			useCompanionEmbeddedDocumentSurface({
				principalId: 'principal-1',
				setOutputSurface,
			})
		);
		act(() => {
			result.current.openEmbeddedDocumentSurface({
				unifiedContentId: '   ',
				initialHtml: '',
			});
		});
		expect(setOutputSurface).not.toHaveBeenCalled();
		expect(saveCompanionOutputSurfaceState).not.toHaveBeenCalled();
	});
});
