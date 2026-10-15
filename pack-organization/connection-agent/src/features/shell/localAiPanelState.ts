/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure UI state helpers for O3c local AI panel (vitest without Tauri runtime).
 *
 * Invariants:
 * - Send disabled when busy, empty prompt, or base URL missing.
 *
 * Related:
 * - OfflineLocalAiPanel.tsx
 */

export type LocalAiGate = {
	baseConfigured: boolean;
	busy: boolean;
	prompt: string;
	model: string;
};

export function canSendLocalAi(gate: LocalAiGate): boolean {
	return (
		gate.baseConfigured &&
		!gate.busy &&
		gate.prompt.trim().length > 0 &&
		gate.model.trim().length > 0
	);
}

export function localAiBanner(code: string | null, message: string): string {
	if (!code) {
		return message;
	}
	if (code === 'ready') {
		return message;
	}
	if (code === 'model_required') {
		return message || 'Укажите имя модели локального LLM';
	}
	if (code === 'not_configured') {
		return message || 'Локальный AI не настроен';
	}
	if (code === 'unreachable') {
		return message || 'Локальный сервер недоступен';
	}
	return message || code;
}
