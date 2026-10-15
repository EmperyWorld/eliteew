/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Toggle integration bindings and inspect destination-specific validation for the active vertical.
 *
 * Invariants:
 * - Updates go through parent callback; parent refreshes snapshot after API call.
 * - Validation is advisory; backend route contracts remain authoritative.
 * - Does not import adminUiShared (Wave 3 New World tab).
 *
 * Related:
 * - src/features/professional-worlds/admin/api.ts
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { useCallback, useEffect, useState } from 'react';

import {
	AdminButton,
	AdminJsonPreview,
	AdminStatusBanner,
} from '@/pages/Admin/ui';

import { loadProfessionalWorldsOpsMetrics } from '../api';
import { adminText } from '../adminI18n';
import type {
	ProfessionalIntegrationBinding,
	ProfessionalWorldsAdminSnapshot,
	ProfessionalWorldsOpsMetrics,
} from '../types';

function validationMessages(binding: ProfessionalIntegrationBinding): string[] {
	const key = binding.integration_key.toLowerCase();
	const config = binding.config ?? {};
	const messages: string[] = [];
	if (key.includes('ewrp')) {
		if (!config.deep_link_template && !config.draft_type) {
			messages.push(adminText('integrations.validation.ewrpLink'));
		}
		if (config.auto_publish === true) {
			messages.push(adminText('integrations.validation.ewrpAutoPublish'));
		}
	}
	if (key.includes('site')) {
		if (config.public === true && !config.internal_review_required) {
			messages.push(adminText('integrations.validation.siteReview'));
		}
		if (config.allow_admin_paths === true) {
			messages.push(adminText('integrations.validation.siteAdminPaths'));
		}
	}
	if (key.includes('gaf') || key.includes('chat')) {
		if (config.auto_send === true) {
			messages.push(adminText('integrations.validation.gafAutoSend'));
		}
		if (!config.recipient_context_source) {
			messages.push(adminText('integrations.validation.gafRecipient'));
		}
	}
	if (key.includes('ewdesk')) {
		if (config.operator_publish_only !== true) {
			messages.push(adminText('integrations.validation.ewdeskOperator'));
		}
	}
	if (key.includes('unified')) {
		if (!config.asset_kind && !config.deep_link_template) {
			messages.push(adminText('integrations.validation.unifiedAsset'));
		}
	}
	return messages;
}

function hasEnabledIntegration(
	snapshot: ProfessionalWorldsAdminSnapshot,
	needle: string
) {
	return snapshot.integrations.some(
		(binding) =>
			binding.is_enabled &&
			binding.integration_key.toLowerCase().includes(needle)
	);
}

function brokenBindingWarnings(
	snapshot: ProfessionalWorldsAdminSnapshot
): string[] {
	const warnings = [...(snapshot.overview.broken_bindings ?? [])];
	const hasImageStudio = hasEnabledIntegration(snapshot, 'image');
	const hasUnifiedContent = hasEnabledIntegration(snapshot, 'unified');

	for (const action of snapshot.aiActions) {
		if (action.is_active && !action.ugs_type_key) {
			warnings.push(
				adminText('integrations.warnings.ugsMissing', {
					key: action.action_key,
				})
			);
		}
	}

	for (const preset of snapshot.photoPresets) {
		if (!preset.is_active) {
			continue;
		}
		if (!preset.ugs_type_key) {
			warnings.push(
				adminText('integrations.warnings.ugsMissing', {
					key: preset.preset_key,
				})
			);
		}
		if (!hasImageStudio || !preset.ugs_type_key.includes('image')) {
			warnings.push(
				adminText('integrations.warnings.imageStudioMissing', {
					key: preset.preset_key,
				})
			);
		}
		if (!hasUnifiedContent) {
			warnings.push(
				adminText('integrations.warnings.unifiedContentMissing', {
					key: preset.preset_key,
				})
			);
		}
	}

	for (const binding of snapshot.integrations) {
		if (!binding.is_enabled) {
			continue;
		}
		warnings.push(...validationMessages(binding));
	}

	return Array.from(new Set(warnings));
}

function StatusPill({ active }: { active: boolean }) {
	return (
		<span
			className={
				active
					? 'rounded-full bg-[var(--admin-ui-status-success-bg)] px-2 py-1 text-xs text-[var(--admin-ui-status-success)]'
					: 'rounded-full bg-[var(--admin-ui-surface-strong)] px-2 py-1 text-xs text-[var(--admin-ui-fg-muted)]'
			}
		>
			{active ? adminText('status.enabled') : adminText('status.disabled')}
		</span>
	);
}

export function IntegrationsTab({
	snapshot,
	onToggleIntegration,
}: {
	snapshot: ProfessionalWorldsAdminSnapshot;
	onToggleIntegration: (
		integrationKey: string,
		enabled: boolean
	) => void | Promise<void>;
}) {
	const [opsMetrics, setOpsMetrics] =
		useState<ProfessionalWorldsOpsMetrics | null>(null);
	const [opsError, setOpsError] = useState<string | null>(null);

	const refreshOpsProbe = useCallback(async () => {
		setOpsError(null);
		try {
			setOpsMetrics(await loadProfessionalWorldsOpsMetrics());
		} catch (err) {
			setOpsError(
				err instanceof Error ? err.message : adminText('errors.operationFailed')
			);
		}
	}, []);

	useEffect(() => {
		void refreshOpsProbe();
	}, [refreshOpsProbe]);

	const warnings = brokenBindingWarnings(snapshot);
	const ugsProbe = (opsMetrics?.probes ?? []).find(
		(probe) => probe.id === 'ugs'
	);

	return (
		<section className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-4">
			<h3 className="mb-3 text-sm font-semibold text-[var(--admin-ui-fg)]">
				{adminText('tabs.integrations')}
			</h3>
			<div className="grid gap-3">
				<AdminStatusBanner
					tone={ugsProbe?.ok === false ? 'warning' : 'success'}
				>
					<p className="font-medium">
						{adminText('integrations.ugsProbeTitle')}
					</p>
					{opsError ? (
						<p className="mt-2">{opsError}</p>
					) : ugsProbe ? (
						<p className="mt-2">
							{ugsProbe.ok
								? adminText('integrations.ugsProbeOk', {
										latency: ugsProbe.latency_ms,
									})
								: adminText('integrations.ugsProbeFail', {
										message: ugsProbe.message,
									})}
						</p>
					) : (
						<p className="mt-2 text-[var(--admin-ui-fg-muted)]">
							{adminText('integrations.ugsProbePending')}
						</p>
					)}
				</AdminStatusBanner>
				<AdminStatusBanner tone={warnings.length > 0 ? 'warning' : 'success'}>
					<p className="font-medium">
						{adminText('integrations.warnings.title')}
					</p>
					{warnings.length > 0 ? (
						<ul className="mt-2 grid gap-1">
							{warnings.map((warning) => (
								<li key={warning}>{warning}</li>
							))}
						</ul>
					) : (
						<p className="mt-2">{adminText('integrations.validation.ok')}</p>
					)}
				</AdminStatusBanner>
				{snapshot.integrations.map((binding) => (
					<div
						key={binding.integration_key}
						className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] p-3"
					>
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<strong className="text-[var(--admin-ui-fg)]">
									{binding.display_name}
								</strong>
								<p className="text-sm text-[var(--admin-ui-fg-muted)]">
									{binding.integration_key}
								</p>
							</div>
							<div className="flex items-center gap-2">
								<StatusPill active={binding.is_enabled} />
								<AdminButton
									variant="secondary"
									onClick={() =>
										void onToggleIntegration(
											binding.integration_key,
											!binding.is_enabled
										)
									}
								>
									{binding.is_enabled
										? adminText('actions.disable')
										: adminText('actions.enable')}
								</AdminButton>
							</div>
						</div>
						<div className="mt-3 grid gap-3 lg:grid-cols-[1fr_280px]">
							<AdminJsonPreview value={binding.config} />
							<div className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-3 text-sm">
								<p className="mb-2 font-medium text-[var(--admin-ui-fg)]">
									{adminText('integrations.validationPanelTitle')}
								</p>
								{validationMessages(binding).length === 0 ? (
									<p className="text-[var(--admin-ui-status-success)]">
										{adminText('integrations.validation.ok')}
									</p>
								) : (
									<ul className="grid gap-1 text-[var(--admin-ui-status-warning)]">
										{validationMessages(binding).map((message) => (
											<li key={message}>{message}</li>
										))}
									</ul>
								)}
							</div>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}
