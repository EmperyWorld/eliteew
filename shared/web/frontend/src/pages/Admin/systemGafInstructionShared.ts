/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared types and helpers for admin «GAF: инструкции» (system onboarding template).
 *
 * Invariants:
 * - Step open-app picker uses EliteEW/shared/assistant_desktop_link_components.json only.
 *
 * Related:
 * - EliteEW/shared/assistant_desktop_link_components.json
 * - api/gaf_chat/system_gaf_instruction.py
 */
import assistantDesktopLinkManifest from '../../../../../assistant_desktop_link_components.json';
import type { InstructionStepForPreview } from './systemGafInstructionPreview';

export type InstructionStep = {
	id: string;
	title: string;
	body: string;
	open_app_component: string | null;
	button_label: string;
};

/** Must match EliteEW `api/routers/system_gaf_admin.BROADCAST_CONFIRM_PHRASE`. */
export const BROADCAST_CONFIRM_PHRASE = 'SEND_INSTRUCTION_TO_ALL_USERS';

/** Mirrors `api/gaf_chat/system_gaf_instruction.py` limits. */
export const MAX_WELCOME_THANKS = 8000;
export const MAX_STEP_TITLE = 500;
export const MAX_STEP_BODY = 8000;
export const MAX_STEPS = 30;

export const QK = {
	instruction: (locale: string) =>
		['admin', 'system-gaf', 'instruction', locale] as const,
	broadcastPreview: ['admin', 'system-gaf', 'broadcast-preview'] as const,
};

export const EMPTY_STEP = (): InstructionStep => ({
	id: crypto.randomUUID(),
	title: '',
	body: '',
	open_app_component: null,
	button_label: '',
});

export const COMPONENT_OPTIONS = [
	...assistantDesktopLinkManifest.app_components,
].sort((a, b) => a.localeCompare(b, 'en'));

export function stepsToPayload(steps: InstructionStep[]) {
	return steps.map((s) => ({
		title: s.title,
		body: s.body,
		open_app_component: s.open_app_component || null,
		button_label: s.button_label.trim() || null,
	}));
}

export function toPreviewSteps(
	steps: InstructionStep[]
): InstructionStepForPreview[] {
	return steps.map((s) => ({
		title: s.title,
		body: s.body,
		open_app_component: s.open_app_component,
		button_label: s.button_label.trim() || null,
	}));
}
