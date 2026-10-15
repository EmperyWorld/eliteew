/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Validate-before-save gate for EWA companion workflow Monaco editor.
 *
 * Invariants:
 * - Save/Enable allowed only when last Validate succeeded on **current** editor text.
 *
 * Related:
 * - src/features/ewa/admin/EwaCompanionActionWorkflowsTab.tsx
 */
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';
import type { EwaCompanionWorkflowValidateResponse } from './ewaCompanionAdminApi';

export function workflowEditorFingerprint(editorText: string): string {
	return editorText.trim();
}

export function isWorkflowEditorValidated(
	editorText: string,
	validation: EwaCompanionWorkflowValidateResponse | null,
	validatedFingerprint: string | null
): boolean {
	if (!validation?.ok || !validatedFingerprint) {
		return false;
	}
	return validatedFingerprint === workflowEditorFingerprint(editorText);
}

export function parseWorkflowEditorJson(
	editorText: string
): Record<string, unknown> | null {
	try {
		const parsed = JSON.parse(editorText) as unknown;
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return null;
		}
		return parsed as Record<string, unknown>;
	} catch (err) {
		ewaCompanionDegradeDebug(
			'companion_admin_workflow_editor_json',
			'workflow editor JSON parse failed',
			err
		);
		return null;
	}
}
