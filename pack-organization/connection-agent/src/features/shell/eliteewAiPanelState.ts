/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure UI gates for O3e EliteEW AI panel (network required).
 *
 * Related:
 * - OfflineEliteewAiPanel.tsx
 */

export type EliteewAiGate = {
	baseConfigured: boolean;
	networkOk: boolean;
	busy: boolean;
	prompt: string;
	model: string;
};

export function canSendEliteewAi(gate: EliteewAiGate): boolean {
	return (
		gate.baseConfigured &&
		gate.networkOk &&
		!gate.busy &&
		gate.prompt.trim().length > 0 &&
		gate.model.trim().length > 0
	);
}

export function eliteewAiBanner(
	code: string | null,
	message: string,
	networkOk: boolean
): string {
	if (code === 'offline' || (!networkOk && code !== 'not_configured')) {
		return message || 'Нет сети до EliteEW AI';
	}
	if (code === 'not_configured') {
		return message || 'EliteEW AI не настроен';
	}
	if (code === 'ready') {
		return message;
	}
	return message || code || '…';
}
