/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for useCompanionActionDispatch (U8.3 slice 7).
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useCompanionActionDispatch } from '@/features/ewa/companionUx/useCompanionActionDispatch';

const openEmbeddedDocumentSurface = vi.fn();
const requestOpenDesktopApp = vi.fn();
const requestCloseDesktopAppLatest = vi.fn();

vi.mock('@/pages/Desktop/utils/desktopDeepLink', () => ({
	dispatchDocEditorCompanionSetBody: vi.fn(),
	requestOpenDesktopApp: (...args: unknown[]) => requestOpenDesktopApp(...args),
	requestCloseDesktopAppLatest: (...args: unknown[]) =>
		requestCloseDesktopAppLatest(...args),
	requestFocusDesktopAppLatest: vi.fn(),
	requestMinimizeDesktopAppLatest: vi.fn(),
}));

vi.mock('@/features/ewa/companionActionDispatch', () => ({
	dispatchCompanionMusicPlayTrackAction: vi.fn(() => true),
}));

vi.mock('@/services/unifiedContentEvents', () => ({
	requestContentManagerLibraryRefresh: vi.fn(),
}));

describe('useCompanionActionDispatch', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('dispatchActions opens desktop app and records tray row', () => {
		const { result } = renderHook(() =>
			useCompanionActionDispatch({ openEmbeddedDocumentSurface })
		);
		act(() => {
			result.current.dispatchActions([
				{
					type: 'open_app',
					app_component: 'DocEditor',
					rationale: 'Open doc',
				},
			]);
		});
		expect(requestOpenDesktopApp).toHaveBeenCalledWith(
			expect.objectContaining({ appComponent: 'DocEditor' })
		);
		expect(result.current.actionRecords).toHaveLength(1);
		expect(result.current.actionRecords[0]?.kind).toBe('open');
	});

	it('keeps DocEditor with unified_content_id in companion by default', () => {
		const { result } = renderHook(() =>
			useCompanionActionDispatch({ openEmbeddedDocumentSurface })
		);
		act(() => {
			result.current.dispatchActions([
				{
					type: 'open_app',
					app_component: 'DocEditor',
					unified_content_id: 'uc-42',
					rationale: 'Open embedded',
				},
			]);
		});
		expect(requestOpenDesktopApp).not.toHaveBeenCalled();
		expect(openEmbeddedDocumentSurface).toHaveBeenCalledWith(
			expect.objectContaining({ unifiedContentId: 'uc-42' })
		);
	});

	it('opens DocEditor on desk when open_on_desk is set', () => {
		const { result } = renderHook(() =>
			useCompanionActionDispatch({ openEmbeddedDocumentSurface })
		);
		act(() => {
			result.current.dispatchActions([
				{
					type: 'open_app',
					app_component: 'DocEditor',
					unified_content_id: 'uc-42',
					open_on_desk: true,
					rationale: 'Open on desk',
				},
			]);
		});
		expect(requestOpenDesktopApp).toHaveBeenCalledWith(
			expect.objectContaining({ appComponent: 'DocEditor' })
		);
		expect(openEmbeddedDocumentSurface).toHaveBeenCalled();
	});

	it('handleUndoAction dismisses notice without desktop calls', () => {
		const { result } = renderHook(() =>
			useCompanionActionDispatch({ openEmbeddedDocumentSurface })
		);
		act(() => {
			result.current.dispatchActions([
				{
					type: 'companion_action_notice',
					rationale: 'Blocked',
					outcome: 'failed',
				},
			]);
		});
		const record = result.current.actionRecords[0];
		expect(record).toBeDefined();
		act(() => {
			result.current.handleUndoAction(record);
		});
		expect(requestCloseDesktopAppLatest).not.toHaveBeenCalled();
		expect(result.current.actionRecords[0]?.closed).toBe(true);
	});
});
