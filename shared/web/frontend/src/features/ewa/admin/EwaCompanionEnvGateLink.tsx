/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Clickable env_gate label → navigate to Settings tab for the EWA_* key.
 *
 * Related:
 * - src/features/ewa/admin/EwaCompanionActionWorkflowsTab.tsx
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { isEwaPlatformSettingKey } from './ewaCompanionAdminSettingsNav';

export function EwaCompanionEnvGateLink({
	envGate,
	onOpenSetting,
	className = '',
}: {
	envGate: string | null | undefined;
	onOpenSetting?: (settingKey: string) => void;
	className?: string;
}): React.ReactElement | null {
	const { t } = useTranslation('desktopUi');
	if (!envGate?.trim()) {
		return null;
	}
	const label = envGate.trim();
	if (!isEwaPlatformSettingKey(label) || !onOpenSetting) {
		return (
			<span className={className}>
				{t('ewaCompanionAdmin.envGate')}: {label}
			</span>
		);
	}
	return (
		<button
			type="button"
			className={`text-left font-mono hover:text-[rgb(var(--desktop-accent-rgb)/0.9)] hover:underline ${className}`}
			onClick={(e) => {
				e.stopPropagation();
				onOpenSetting(label);
			}}
			title={t('ewaCompanionAdmin.envGateOpenSettings')}
		>
			{t('ewaCompanionAdmin.envGate')}: {label}
		</button>
	);
}
