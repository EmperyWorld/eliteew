/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared yes/no badge for EWA companion admin tables and workflow lists.
 *
 * Invariants:
 * - Labels come from i18n ``desktopUi.ewaCompanionAdmin.boolYes|boolNo``.
 *
 * Related:
 * - src/features/ewa/admin/EwaCompanionAdminPanel.tsx
 * - src/features/ewa/admin/EwaCompanionToolsTab.tsx
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

export function EwaCompanionAdminBoolBadge({
	value,
}: {
	value: boolean;
}): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	return (
		<span
			className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${
				value
					? 'bg-emerald-500/15 text-emerald-300'
					: 'bg-[rgb(var(--desktop-fg-primary-rgb)/0.12)] text-(--desktop-text-muted)'
			}`}
		>
			{value ? t('ewaCompanionAdmin.boolYes') : t('ewaCompanionAdmin.boolNo')}
		</span>
	);
}
