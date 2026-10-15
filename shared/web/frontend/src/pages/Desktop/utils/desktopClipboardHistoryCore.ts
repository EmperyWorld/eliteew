/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure clipboard history mutations: dedupe, caps, sensitive classification, search.
 *
 * Related:
 * - utils/clipboardHistoryPersistence.ts
 * - context/DesktopClipboardHistoryContext.tsx
 */

import type { DesktopClipboardHistoryItem } from './clipboardHistoryPersistence';
import {
	DESKTOP_CLIPBOARD_SHELL_MAX_ITEMS,
	DESKTOP_CLIPBOARD_SHELL_MAX_STRING,
} from './clipboardHistoryPersistence';

export type DesktopClipboardPersistScope = 'cloud' | 'session';

export const DESKTOP_CLIPBOARD_MAX_PINNED = 8;

const JWT_LIKE = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./;
const API_KEY_LIKE = /^(sk-[A-Za-z0-9]{8,}|pk_live_[A-Za-z0-9]+|xox[baprs]-[A-Za-z0-9-]+)/;

export type ClipboardHistoryCaptureInput = Omit<
	DesktopClipboardHistoryItem,
	'id' | 'timestamp' | 'pinned' | 'persistScope'
>;

export function createClipboardHistoryItemId(): string {
	return `clip-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function classifyClipboardPersistScope(
	item: Pick<DesktopClipboardHistoryItem, 'type' | 'content'>
): DesktopClipboardPersistScope {
	if (
		item.type === 'image' &&
		item.content.startsWith('data:') &&
		item.content.length > DESKTOP_CLIPBOARD_SHELL_MAX_STRING
	) {
		return 'session';
	}
	if (item.type !== 'text' && item.type !== 'html') {
		return 'cloud';
	}
	const trimmed = item.content.trim();
	if (!trimmed) {
		return 'session';
	}
	if (JWT_LIKE.test(trimmed) || API_KEY_LIKE.test(trimmed)) {
		return 'session';
	}
	return 'cloud';
}

export function mergeClipboardHistoryCapture(
	prev: DesktopClipboardHistoryItem[],
	input: ClipboardHistoryCaptureInput
): DesktopClipboardHistoryItem[] {
	const content = typeof input.content === 'string' ? input.content : '';
	if (!content.trim()) {
		return prev;
	}

	const exists = prev.find((entry) => entry.content === content && !entry.pinned);
	if (exists) {
		return [
			{ ...exists, timestamp: new Date() },
			...prev.filter((entry) => entry.id !== exists.id),
		].slice(0, DESKTOP_CLIPBOARD_SHELL_MAX_ITEMS);
	}

	const persistScope = classifyClipboardPersistScope({
		type: input.type,
		content,
	});

	const newItem: DesktopClipboardHistoryItem = {
		...input,
		content,
		id: createClipboardHistoryItemId(),
		timestamp: new Date(),
		pinned: false,
		persistScope,
	};

	return [newItem, ...prev].slice(0, DESKTOP_CLIPBOARD_SHELL_MAX_ITEMS);
}

export function toggleClipboardHistoryPin(
	prev: DesktopClipboardHistoryItem[],
	id: string
): DesktopClipboardHistoryItem[] {
	const target = prev.find((entry) => entry.id === id);
	if (!target) {
		return prev;
	}
	if (!target.pinned) {
		const pinnedCount = prev.filter((entry) => entry.pinned).length;
		if (pinnedCount >= DESKTOP_CLIPBOARD_MAX_PINNED) {
			return prev;
		}
	}
	return prev.map((entry) =>
		entry.id === id ? { ...entry, pinned: !entry.pinned } : entry
	);
}

export function filterClipboardHistoryForSearch(
	items: DesktopClipboardHistoryItem[],
	query: string
): DesktopClipboardHistoryItem[] {
	const trimmed = query.trim().toLowerCase();
	if (!trimmed) {
		return items;
	}
	return items.filter((item) => {
		if (item.content.toLowerCase().includes(trimmed)) {
			return true;
		}
		if (typeof item.preview === 'string' && item.preview.toLowerCase().includes(trimmed)) {
			return true;
		}
		if (typeof item.source === 'string' && item.source.toLowerCase().includes(trimmed)) {
			return true;
		}
		return false;
	});
}

export function sortClipboardHistoryItems(
	items: DesktopClipboardHistoryItem[]
): DesktopClipboardHistoryItem[] {
	return [...items].sort((left, right) => {
		if (left.pinned && !right.pinned) return -1;
		if (!left.pinned && right.pinned) return 1;
		const leftMs =
			left.timestamp instanceof Date
				? left.timestamp.getTime()
				: Date.parse(String(left.timestamp));
		const rightMs =
			right.timestamp instanceof Date
				? right.timestamp.getTime()
				: Date.parse(String(right.timestamp));
		return rightMs - leftMs;
	});
}
