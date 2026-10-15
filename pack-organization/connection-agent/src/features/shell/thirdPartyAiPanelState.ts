/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure UI gates for O3d third-party AI panel (vitest without keyring).
 *
 * Related:
 * - OfflineThirdPartyAiPanel.tsx
 */

export type ThirdPartyAiGate = {
	baseConfigured: boolean;
	hasApiKey: boolean;
	busy: boolean;
	prompt: string;
	model: string;
};

export function canSendThirdPartyAi(gate: ThirdPartyAiGate): boolean {
	return (
		gate.baseConfigured &&
		gate.hasApiKey &&
		!gate.busy &&
		gate.prompt.trim().length > 0 &&
		gate.model.trim().length > 0
	);
}

export function thirdPartyAiBanner(
	code: string | null,
	message: string,
	keySource: string
): string {
	const src =
		keySource && keySource !== 'none' ? ` · ключ: ${keySource}` : '';
	if (!code) {
		return `${message}${src}`;
	}
	if (code === 'ready') {
		return `${message}${src}`;
	}
	if (code === 'key_required') {
		return (message || 'Нужен API key в OS keyring') + src;
	}
	if (code === 'not_configured') {
		return message || 'Укажите URL стороннего AI';
	}
	return (message || code) + src;
}
