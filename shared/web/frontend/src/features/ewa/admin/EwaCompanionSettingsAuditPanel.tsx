/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Audit trail panel for EWA platform settings (Postgres ``ewa_platform_setting_audit``).
 *
 * Related:
 * - GET /api/v1/ewa/admin/companion/settings/audit
 */
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { fetchEwaCompanionPlatformSettingsAudit } from './ewaCompanionAdminApi';

export function EwaCompanionSettingsAuditPanel({
	filterKey,
}: {
	filterKey: string;
}): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const trimmed = filterKey.trim();
	const auditQuery = useQuery({
		queryKey: ['ewa', 'admin', 'companion', 'settings-audit', trimmed || 'all'],
		queryFn: () =>
			fetchEwaCompanionPlatformSettingsAudit({
				setting_key: trimmed || undefined,
				limit: 50,
			}),
		retry: false,
	});

	const entries = auditQuery.data?.entries ?? [];

	return (
		<section className="rounded-lg border border-white/10 bg-black/20 p-4">
			<h3 className="text-sm font-medium text-white">
				{t('ewaCompanionAdmin.settingsAuditTitle')}
			</h3>
			<p
				className={`${DESKTOP_TYPOGRAPHY.meta} mt-1 text-(--desktop-text-dim)`}
			>
				{t('ewaCompanionAdmin.settingsAuditHint')}
			</p>
			{auditQuery.isLoading ? (
				<p
					className={`${DESKTOP_TYPOGRAPHY.meta} mt-3 text-(--desktop-text-muted)`}
				>
					{t('ewaCompanionAdmin.loadingSettingsAudit')}
				</p>
			) : null}
			{auditQuery.error ? (
				<p className="mt-3 text-sm text-red-300">
					{t('ewaCompanionAdmin.errorSettingsAudit')}
				</p>
			) : null}
			{!auditQuery.isLoading && !auditQuery.error && entries.length === 0 ? (
				<p
					className={`${DESKTOP_TYPOGRAPHY.meta} mt-3 text-(--desktop-text-muted)`}
				>
					{t('ewaCompanionAdmin.emptySettingsAudit')}
				</p>
			) : null}
			{entries.length > 0 ? (
				<div className="mt-3 overflow-auto">
					<table className="min-w-full text-left text-xs text-(--desktop-text-secondary)">
						<thead className="text-[10px] uppercase tracking-wide text-(--desktop-text-dim)">
							<tr>
								<th className="px-2 py-1">
									{t('ewaCompanionAdmin.settingsAuditColTime')}
								</th>
								<th className="px-2 py-1">
									{t('ewaCompanionAdmin.settingsAuditColKey')}
								</th>
								<th className="px-2 py-1">
									{t('ewaCompanionAdmin.settingsAuditColChange')}
								</th>
								<th className="px-2 py-1">
									{t('ewaCompanionAdmin.settingsAuditColActor')}
								</th>
							</tr>
						</thead>
						<tbody>
							{entries.map((entry) => (
								<tr key={entry.id} className="border-t border-white/5">
									<td className="px-2 py-1.5 whitespace-nowrap text-(--desktop-text-muted)">
										{entry.created_at ?? '—'}
									</td>
									<td className="px-2 py-1.5 font-mono text-[rgb(var(--desktop-accent-rgb)/0.9)]">
										{entry.setting_key}
									</td>
									<td className="px-2 py-1.5 font-mono">
										{entry.value_masked ? (
											<span className="text-(--desktop-text-dim)">
												{t('ewaCompanionAdmin.settingsAuditSecret')}
											</span>
										) : (
											<>
												<span className="text-(--desktop-text-dim)">
													{entry.old_value || '—'}
												</span>
												<span className="text-(--desktop-text-dim)"> → </span>
												<span>{entry.new_value || '—'}</span>
											</>
										)}
									</td>
									<td className="px-2 py-1.5 text-(--desktop-text-muted)">
										{entry.actor_sub ?? '—'}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : null}
		</section>
	);
}
