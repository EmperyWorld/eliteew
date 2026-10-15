/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared types for Desktop AI Chat admin hub (load states, tabs, API shapes).
 *
 * Invariants:
 * - UI load states are distinct from API merge semantics.
 *
 * Related:
 * - pages/Admin/desktopAiChat/DesktopAiChatAdminSection.tsx
 */

export type DesktopAiChatAdminLoadState =
	| 'idle'
	| 'loading'
	| 'ready'
	| 'error'
	| 'permissionDenied';

export type DesktopAiChatAdminTab =
	| 'overview'
	| 'defaults'
	| 'memoryCells'
	| 'blueprint'
	| 'templates'
	| 'diagnostics';

export type DesktopAiChatAdminSaveState = 'idle' | 'saving';

export type DesktopAiChatPromptTemplateRow = {
	id: string;
	template_key: string;
	display_name: string;
	system_prompt: string;
	company_id: string | null;
	is_active: boolean;
	sort_order: number;
	created_at: string | null;
	updated_at: string | null;
};

export type DesktopAiChatProbeCheck = {
	id: string;
	ok: boolean;
	latency_ms: number;
	message: string;
	details?: Record<string, unknown>;
};

export type DesktopAiChatProbeResponse = {
	all_ok: boolean;
	checks: DesktopAiChatProbeCheck[];
};

export type DesktopAiChatAdminStatusKind = 'success' | 'error' | null;
