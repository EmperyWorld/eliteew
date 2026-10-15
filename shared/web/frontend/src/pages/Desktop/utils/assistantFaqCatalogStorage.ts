/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave K17: persist last-successful Handbook FAQ catalog for offline browse.
 *
 * Invariants:
 * - localStorage only (survives session); never invent FAQ entries.
 * - Malformed / incomplete entries are dropped on read.
 * - Empty successful fetch clears the cache (honest empty online → empty offline).
 *
 * Related:
 * - pages/Desktop/components/assistantQueryOptions.ts
 * - documentation/product/desktop/DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md
 */

import type { AssistantFaqEntry } from '../services/productDesktopApi';

export const ASSISTANT_FAQ_CATALOG_STORAGE_KEY =
	'eliteew.assistant.faqCatalog.v1';

type CatalogEnvelope = {
	saved_at: string;
	entries: AssistantFaqEntry[];
};

function isFaqEntry(value: unknown): value is AssistantFaqEntry {
	if (typeof value !== 'object' || value === null) return false;
	const row = value as Record<string, unknown>;
	return (
		typeof row.id === 'string' &&
		typeof row.question === 'string' &&
		typeof row.answer === 'string' &&
		typeof row.sort_order === 'number'
	);
}

function parseEnvelope(raw: string): CatalogEnvelope | null {
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (typeof parsed !== 'object' || parsed === null) return null;
		const obj = parsed as Record<string, unknown>;
		if (!Array.isArray(obj.entries)) return null;
		const entries = obj.entries.filter(isFaqEntry);
		const savedAt =
			typeof obj.saved_at === 'string' && obj.saved_at.trim()
				? obj.saved_at
				: new Date(0).toISOString();
		return { saved_at: savedAt, entries };
	} catch {
		return null;
	}
}

export function readAssistantFaqCatalog(): AssistantFaqEntry[] | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(ASSISTANT_FAQ_CATALOG_STORAGE_KEY);
		if (!raw) return null;
		const envelope = parseEnvelope(raw);
		if (!envelope) return null;
		return envelope.entries;
	} catch {
		return null;
	}
}

export function readAssistantFaqCatalogSavedAt(): string | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(ASSISTANT_FAQ_CATALOG_STORAGE_KEY);
		if (!raw) return null;
		return parseEnvelope(raw)?.saved_at ?? null;
	} catch {
		return null;
	}
}

export function writeAssistantFaqCatalog(entries: AssistantFaqEntry[]): void {
	if (typeof localStorage === 'undefined') return;
	try {
		if (entries.length === 0) {
			localStorage.removeItem(ASSISTANT_FAQ_CATALOG_STORAGE_KEY);
			return;
		}
		const envelope: CatalogEnvelope = {
			saved_at: new Date().toISOString(),
			entries: entries.filter(isFaqEntry),
		};
		if (envelope.entries.length === 0) {
			localStorage.removeItem(ASSISTANT_FAQ_CATALOG_STORAGE_KEY);
			return;
		}
		localStorage.setItem(
			ASSISTANT_FAQ_CATALOG_STORAGE_KEY,
			JSON.stringify(envelope)
		);
	} catch {
		/* quota / private mode — ignore */
	}
}

export function clearAssistantFaqCatalog(): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.removeItem(ASSISTANT_FAQ_CATALOG_STORAGE_KEY);
	} catch {
		/* ignore */
	}
}
