/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit locks for Shell portal stack controller (z-index by kind + Escape top).
 *
 * Related:
 * - ../portalStackController.ts
 * - documentation/product/desktop/DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md §5
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DESKTOP_PORTAL_STACK_BUMP, DESKTOP_Z_INDEX } from '../../constants';
import { resolveShellPortalLayerBump } from '../portalLayerBumps';
import {
	__resetShellPortalStackForTests,
	closeShellPortalSurface,
	computeShellPortalZIndex,
	dismissTopShellPortalSurface,
	getTopShellPortalSurface,
	listShellPortalSurfaces,
	openShellPortalSurface,
	subscribeShellPortalStack,
} from '../portalStackController';

describe('portalLayerBumps', () => {
	it('maps layer kinds to DESKTOP_PORTAL_STACK_BUMP floors', () => {
		expect(resolveShellPortalLayerBump('window_menu')).toBe(0);
		expect(resolveShellPortalLayerBump('embedded_popover')).toBe(
			DESKTOP_PORTAL_STACK_BUMP.NOTIFICATION_HUB_ITEM_MENU
		);
		expect(resolveShellPortalLayerBump('embedded_modal_backdrop')).toBe(
			DESKTOP_PORTAL_STACK_BUMP.EMBEDDED_MODAL_BACKDROP
		);
		expect(resolveShellPortalLayerBump('embedded_modal')).toBe(
			DESKTOP_PORTAL_STACK_BUMP.EMBEDDED_MODAL_CONTENT
		);
		expect(resolveShellPortalLayerBump('doc_side_panel')).toBe(
			DESKTOP_PORTAL_STACK_BUMP.DOC_EDITOR_IN_WINDOW_SIDE_PANEL
		);
		expect(resolveShellPortalLayerBump('doc_toolbar_popover')).toBe(
			DESKTOP_PORTAL_STACK_BUMP.DOC_EDITOR_IN_WINDOW_TOOLBAR_PORTAL_POPOVER
		);
		expect(resolveShellPortalLayerBump('doc_context_menu')).toBe(
			DESKTOP_PORTAL_STACK_BUMP.DOC_EDITOR_IN_WINDOW_CONTEXT_MENU
		);
		expect(resolveShellPortalLayerBump('shell_global')).toBe(0);
	});
});

describe('portalStackController', () => {
	beforeEach(() => {
		__resetShellPortalStackForTests();
	});

	afterEach(() => {
		__resetShellPortalStackForTests();
	});

	it('assigns z-index from window base + layer bump + open order', () => {
		const base = DESKTOP_Z_INDEX.CONTEXT_MENU + 5;
		const a = openShellPortalSurface({
			layer: 'embedded_popover',
			windowPortalBase: base,
		});
		const b = openShellPortalSurface({
			layer: 'embedded_modal',
			windowPortalBase: base,
		});

		const surfaces = listShellPortalSurfaces();
		expect(surfaces).toHaveLength(2);
		expect(surfaces[0]?.id).toBe(a);
		expect(surfaces[0]?.zIndex).toBe(
			computeShellPortalZIndex(base, 'embedded_popover', 0)
		);
		expect(surfaces[1]?.id).toBe(b);
		expect(surfaces[1]?.zIndex).toBe(
			computeShellPortalZIndex(base, 'embedded_modal', 1)
		);
		expect(surfaces[1]?.zIndex ?? 0).toBeGreaterThan(surfaces[0]?.zIndex ?? 0);
		expect(getTopShellPortalSurface()?.id).toBe(b);
	});

	it('closes by id and updates top', () => {
		const first = openShellPortalSurface({ layer: 'window_menu' });
		const second = openShellPortalSurface({ layer: 'embedded_popover' });
		closeShellPortalSurface(second);
		expect(getTopShellPortalSurface()?.id).toBe(first);
		closeShellPortalSurface(first);
		expect(getTopShellPortalSurface()).toBeNull();
	});

	it('Escape / dismissTop only closes dismissible top surface', () => {
		const onCloseLower = vi.fn();
		const onCloseTop = vi.fn();
		openShellPortalSurface({
			layer: 'embedded_popover',
			dismissOnEscape: true,
			onRequestClose: onCloseLower,
		});
		openShellPortalSurface({
			layer: 'embedded_modal',
			dismissOnEscape: true,
			onRequestClose: onCloseTop,
		});

		expect(dismissTopShellPortalSurface()).toBe(true);
		expect(onCloseTop).toHaveBeenCalledTimes(1);
		expect(onCloseLower).not.toHaveBeenCalled();

		document.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
		);
		// Top still open until React/host closes — Escape still hits same top
		expect(onCloseTop).toHaveBeenCalledTimes(2);
	});

	it('skips Escape when top has dismissOnEscape=false', () => {
		const onClose = vi.fn();
		openShellPortalSurface({
			layer: 'embedded_modal',
			dismissOnEscape: false,
			onRequestClose: onClose,
		});
		expect(dismissTopShellPortalSurface()).toBe(false);
		document.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
		);
		expect(onClose).not.toHaveBeenCalled();
	});

	it('notifies subscribers on open/close', () => {
		const listener = vi.fn();
		const unsub = subscribeShellPortalStack(listener);
		openShellPortalSurface({ layer: 'shell_global' });
		expect(listener).toHaveBeenCalled();
		listener.mockClear();
		const topId = getTopShellPortalSurface()?.id;
		expect(topId).toBeTruthy();
		if (topId) closeShellPortalSurface(topId);
		expect(listener).toHaveBeenCalled();
		unsub();
	});
});
