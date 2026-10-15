/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Types for Desktop AI Chat blueprint (ensemble plan template) admin tab.
 *
 * Related:
 * - pages/Admin/desktopAiChat/DesktopAiChatBlueprintTab.tsx
 */

export type EnsemblePlanBuiltinItem = {
	id: string;
	title: string;
	keywords: string[];
	example_command?: string;
};

export type EnsemblePlanDraftRow = {
	id: string;
	template_id: string;
	title: string;
	description: string;
	keywords: string[];
	is_active: boolean;
	sort_order: number;
	created_at: string | null;
	updated_at: string | null;
	body?: Record<string, unknown>;
};

export type BlueprintAdminLoadState =
	| 'idle'
	| 'loading'
	| 'ready'
	| 'error'
	| 'permissionDenied';

export type BlueprintAdminActionState = 'idle' | 'saving' | 'validating';

export type BlueprintAdminStatusKind = 'success' | 'error' | null;
