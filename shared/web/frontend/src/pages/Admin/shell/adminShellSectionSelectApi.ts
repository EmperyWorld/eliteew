/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Best-effort POST of Unified Admin section selects to Prometheus ingest.
 *
 * Invariants:
 * - Never throws into nav; failures are swallowed after debug log.
 * - Debounces identical section+embedded within 400ms (retry inflation guard).
 * - Payload is section id + embedded only (no PII).
 *
 * Related:
 * - `pages/Admin/UnifiedAdminPage.tsx`
 * - `api/routers/desktop_admin_shell_telemetry.py`
 */

import { api } from '../../../services/api/client';
import { log } from '../../../utils/logger';
import type { AdminSectionId } from './adminShellConfig';

const BASE = '/api/v1/desktop/admin/shell';
const DEBOUNCE_MS = 400;

let lastKey = '';
let lastAt = 0;

export function reportAdminShellSectionSelect(
	section: AdminSectionId,
	opts?: { embedded?: boolean }
): void {
	const embedded = Boolean(opts?.embedded);
	const key = `${section}:${embedded ? '1' : '0'}`;
	const now = Date.now();
	if (key === lastKey && now - lastAt < DEBOUNCE_MS) {
		return;
	}
	lastKey = key;
	lastAt = now;

	void api
		.post(`${BASE}/section-select`, { section, embedded })
		.catch((err: unknown) => {
			log.debug('adminShellSectionSelectApi', 'section_select_post_skip', {
				section,
				embedded,
				error: err instanceof Error ? err.message : String(err),
			});
		});
}

/** Vitest isolation only. */
export function resetAdminShellSectionSelectApiForTests(): void {
	lastKey = '';
	lastAt = 0;
}
