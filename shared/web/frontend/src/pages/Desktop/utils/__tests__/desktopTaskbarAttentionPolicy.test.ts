/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locks event-gated rail attention for clipboard / tray / notifications and volume glyphs.
 *
 * Related:
 * - ../desktopTaskbarAttentionPolicy.ts
 */

import { describe, expect, it } from 'vitest';
import {
	CLIPBOARD_RAIL_ATTENTION_MS,
	backgroundTrayNeedsRailAttention,
	clipboardNeedsRailAttention,
	newestClipboardTimestamp,
	notificationsNeedRailAttention,
	resolveTaskbarVolumeGlyphLevel,
} from '../desktopTaskbarAttentionPolicy';

describe('desktopTaskbarAttentionPolicy', () => {
	it('promotes clipboard only while recent or panel open', () => {
		const now = 1_000_000;
		expect(
			clipboardNeedsRailAttention({
				newestTimestamp: new Date(now - CLIPBOARD_RAIL_ATTENTION_MS + 1),
				nowMs: now,
			})
		).toBe(true);
		expect(
			clipboardNeedsRailAttention({
				newestTimestamp: new Date(now - CLIPBOARD_RAIL_ATTENTION_MS - 1),
				nowMs: now,
			})
		).toBe(false);
		expect(
			clipboardNeedsRailAttention({
				newestTimestamp: null,
				panelOpen: true,
			})
		).toBe(true);
	});

	it('promotes notifications on unread or open panel', () => {
		expect(
			notificationsNeedRailAttention({ unreadCount: 0, panelOpen: false })
		).toBe(false);
		expect(
			notificationsNeedRailAttention({ unreadCount: 2, panelOpen: false })
		).toBe(true);
		expect(
			notificationsNeedRailAttention({ unreadCount: 0, panelOpen: true })
		).toBe(true);
	});

	it('promotes tray on alert signals or open panel', () => {
		const quiet = {
			gafUnread: 0,
			friendsIncomingCount: 0,
			ugsActiveTaskCount: 0,
			musicPlaybackError: false,
			ugsTrayPollError: false,
			panelOpen: false,
		};
		expect(backgroundTrayNeedsRailAttention(quiet)).toBe(false);
		expect(backgroundTrayNeedsRailAttention({ ...quiet, gafUnread: 1 })).toBe(
			true
		);
		expect(
			backgroundTrayNeedsRailAttention({ ...quiet, panelOpen: true })
		).toBe(true);
	});

	it('maps volume to muted/low/medium/high glyphs', () => {
		expect(resolveTaskbarVolumeGlyphLevel(0)).toBe('muted');
		expect(resolveTaskbarVolumeGlyphLevel(0.2)).toBe('low');
		expect(resolveTaskbarVolumeGlyphLevel(0.5)).toBe('medium');
		expect(resolveTaskbarVolumeGlyphLevel(0.9)).toBe('high');
	});

	it('picks newest clipboard timestamp', () => {
		expect(
			newestClipboardTimestamp([
				{ timestamp: '2026-01-01T00:00:00.000Z' },
				{ timestamp: '2026-06-01T00:00:00.000Z' },
			])
		).toBe('2026-06-01T00:00:00.000Z');
		expect(newestClipboardTimestamp([])).toBeNull();
	});
});
