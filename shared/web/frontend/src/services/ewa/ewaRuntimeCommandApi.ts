/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed HTTP client for EWA Runtime Gateway write-side (`/api/v1/ewa/runtime-command`): allowlisted app/content/doc
 * commands executed under backend policy and returned as structured results/actions.
 *
 * Invariants:
 * - Command bodies carry command kind and arguments only; backend derives user scope from auth.
 * - Mutating commands must surface `requires_confirmation` before UI applies powerful document actions.
 *
 * Related:
 * - shared/api/ewa_platform/gateways/routers/runtime_command.py
 */
import { API_OPTIONS } from '@/pages/MarketingCabinet/marketingCabinetApi/config';
import { apiClient } from '@/services/api/client';

export const EWA_RUNTIME_COMMAND_PATH = '/ewa/runtime-command' as const;
export const EWA_RUNTIME_TURN_PATH = '/ewa/runtime-turn' as const;

export type EwaRuntimeCommandKind =
	| 'desktop.open_app'
	| 'desktop.focus_app'
	| 'desktop.minimize_app'
	| 'desktop.close_app'
	| 'content.list'
	| 'content.search'
	| 'catalog.preferences.update'
	| 'catalog.preferences.reset'
	| 'doc.create'
	| 'doc.resolve'
	| 'doc.read'
	| 'doc.edit.propose'
	| 'doc.edit.apply'
	| 'doc.delete.propose'
	| 'doc.delete.apply'
	| 'doc.restore'
	| 'file.rename'
	| 'file.update_metadata';

export type EwaRuntimeSafetyTier =
	| 'safe_ui'
	| 'safe_content_read'
	| 'draft_mutation'
	| 'confirmed_mutation'
	| 'destructive_mutation';

export type EwaRuntimeCommandStatus =
	| 'ok'
	| 'dry_run'
	| 'requires_confirmation'
	| 'rejected';

export type EwaRuntimeCommandRequest = {
	command_kind: EwaRuntimeCommandKind;
	target_app?: string | null;
	arguments?: Record<string, unknown>;
	dry_run?: boolean;
	confirmed?: boolean;
	confirmation_token?: string | null;
};

export type EwaRuntimeCommandResult = {
	command_kind: EwaRuntimeCommandKind;
	status: EwaRuntimeCommandStatus;
	safety_tier: EwaRuntimeSafetyTier;
	source: 'ewa_runtime_gateway';
	authorized_user_id: string;
	target: Record<string, unknown>;
	result: Record<string, unknown>;
	actions: Record<string, unknown>[];
	events: Record<string, unknown>[];
	audit_event_id?: string | null;
	audit_skipped_reason?: string | null;
	rejection_reason?: string | null;
};

export type EwaRuntimeTurnRequest = {
	message?: string;
	commands?: EwaRuntimeCommandRequest[];
	include_context?: boolean;
	dry_run?: boolean;
};

export type EwaRuntimeTurnResult = {
	reply: string;
	context?: Record<string, unknown> | null;
	command_results: EwaRuntimeCommandResult[];
	events: Record<string, unknown>[];
};

export function buildEwaRuntimeCommandBody(
	body: EwaRuntimeCommandRequest
): EwaRuntimeCommandRequest {
	return {
		command_kind: body.command_kind,
		...(body.target_app ? { target_app: body.target_app } : {}),
		arguments: body.arguments ?? {},
		...(body.dry_run !== undefined ? { dry_run: body.dry_run } : {}),
		...(body.confirmed !== undefined ? { confirmed: body.confirmed } : {}),
		...(body.confirmation_token
			? { confirmation_token: body.confirmation_token }
			: {}),
	};
}

export async function postEwaRuntimeCommand(
	body: EwaRuntimeCommandRequest
): Promise<EwaRuntimeCommandResult> {
	const res = await apiClient.post<EwaRuntimeCommandResult>(
		EWA_RUNTIME_COMMAND_PATH,
		buildEwaRuntimeCommandBody(body),
		API_OPTIONS
	);
	return res.data;
}

export async function postEwaRuntimeTurn(
	body: EwaRuntimeTurnRequest
): Promise<EwaRuntimeTurnResult> {
	const res = await apiClient.post<EwaRuntimeTurnResult>(
		EWA_RUNTIME_TURN_PATH,
		{
			message: body.message ?? '',
			commands: (body.commands ?? []).map(buildEwaRuntimeCommandBody),
			...(body.include_context !== undefined
				? { include_context: body.include_context }
				: {}),
			...(body.dry_run !== undefined ? { dry_run: body.dry_run } : {}),
		},
		API_OPTIONS
	);
	return res.data;
}
