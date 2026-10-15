/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Persist last opened admin shell section for restore when URL has no `?section=`.
 *
 * Related:
 * - `pages/Admin/shell/adminShellUrl.ts`
 */

import type { AdminSectionId } from './adminShellConfig';
import { isAdminSectionId } from './adminShellConfig';
import { normalizeLegacyUgsAdminSectionId } from './ugsAdminShellUrl';

const LAST_SECTION_KEY = 'eliteew.admin.lastSection.v1';
const EMBEDDED_SECTION_KEY = 'eliteew.admin.embeddedSection.v1';

function normalizeStoredAdminSection(raw: string): AdminSectionId | null {
	const normalized = normalizeLegacyUgsAdminSectionId(raw);
	if (normalized && isAdminSectionId(normalized)) {
		return normalized as AdminSectionId;
	}
	return null;
}

export function loadLastAdminSection(): AdminSectionId | null {
	try {
		const raw = localStorage.getItem(LAST_SECTION_KEY);
		if (raw) {
			return normalizeStoredAdminSection(raw);
		}
	} catch {
		/* ignore */
	}
	return null;
}

export function saveLastAdminSection(section: AdminSectionId): void {
	try {
		localStorage.setItem(LAST_SECTION_KEY, section);
	} catch {
		/* ignore */
	}
}

export function loadEmbeddedAdminSection(): AdminSectionId | null {
	try {
		const raw = sessionStorage.getItem(EMBEDDED_SECTION_KEY);
		if (raw) {
			return normalizeStoredAdminSection(raw);
		}
	} catch {
		/* ignore */
	}
	return null;
}

export function saveEmbeddedAdminSection(section: AdminSectionId): void {
	try {
		sessionStorage.setItem(EMBEDDED_SECTION_KEY, section);
	} catch {
		/* ignore */
	}
}
