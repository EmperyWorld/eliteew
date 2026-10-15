/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Configure Monaco editor loader to use the bundled ``monaco-editor`` package instead of
 * jsDelivr CDN (blocked by prod CSP ``script-src 'self'``).
 *
 * Invariants:
 * - Call once before first ``@monaco-editor/react`` ``Editor`` mount.
 * - ``configureMonacoEnvironment`` runs first (web workers); then bundled ``monaco`` for loader.
 *
 * Related:
 * - src/lib/monaco/configureMonacoEnvironment.ts
 * - src/features/ewa/admin/CompanionWorkflowMonacoTab.tsx
 * - documentation/platform/FRONTEND-SECURITY-NGINX-STATIC.md
 */
import './configureMonacoEnvironment';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

let configured = false;

export function ensureMonacoLoaderConfigured(): void {
	if (configured) {
		return;
	}
	loader.config({ monaco });
	configured = true;
}

ensureMonacoLoaderConfigured();
