/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Form body for UGS Admin v2 provider bulk edit — fields, scan, validation display, ops preview.
 *
 * Invariants:
 * - Presentational; state and op building live in useProvidersBulkEditState.
 * - Does not apply bulk operations directly.
 *
 * Related:
 * - src/features/ugs/admin-v2/components/ProvidersBulkEditModal.tsx
 * - src/features/ugs/admin-v2/hooks/useProvidersBulkEditState.ts
 */

import * as React from 'react';

import { Button, InputField } from '@/features/ugs/shared/ugsAdminUi';

import type { ProvidersBulkEditFormState } from '../hooks/useProvidersBulkEditState';
import type { ProviderRole, TriBool } from './providersBulkEditUtils';

export type ProvidersBulkEditFormProps = ProvidersBulkEditFormState & {
	onClose: () => void;
};

export function ProvidersBulkEditForm({
	t,
	onClose,
	displayLabel,
	setDisplayLabel,
	baseUrl,
	setBaseUrl,
	healthEndpoint,
	setHealthEndpoint,
	apiKeyRequired,
	setApiKeyRequired,
	enabled,
	setEnabled,
	timeoutSeconds,
	setTimeoutSeconds,
	maxConcurrent,
	setMaxConcurrent,
	costPerRequest,
	setCostPerRequest,
	fallbackPriority,
	setFallbackPriority,
	fallbackForCSV,
	setFallbackForCSV,
	defaultModel,
	setDefaultModel,
	modelsCSV,
	setModelsCSV,
	providerRole,
	setProviderRole,
	configMode,
	setConfigMode,
	configJsonRaw,
	setConfigJsonRaw,
	scanLoading,
	scanError,
	scannedModels,
	knownProviderNames,
	singleProviderName,
	effectiveRole,
	clientErrors,
	previewOps,
	hasChanges,
	nonTextConfigCleanupOps,
	modelRoutesForProviderOps,
	scanModelsNow,
	selectScannedModel,
	submit,
	submitApplyModelToProviderTypes,
	submitCleanupNonTextConfig,
}: ProvidersBulkEditFormProps): React.ReactElement {
	return (
		<div className="space-y-4">
			<p className="text-sm text-(--desktop-text-muted)">
				{t('bulkEditProviders.subtitle')}
			</p>

			{nonTextConfigCleanupOps.length ? (
				<div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100">
					<div className="font-semibold">
						{t('bulkEditProviders.legacyModelFieldsTitle')}
					</div>
					<div className="mt-1 text-amber-100/75">
						{t('bulkEditProviders.legacyModelFieldsHint')}
					</div>
					<Button
						variant="secondary"
						className="mt-3"
						onClick={submitCleanupNonTextConfig}
					>
						{t('bulkEditProviders.generateConfigJsonCleanup')}
					</Button>
				</div>
			) : null}

			<div className="grid gap-4 lg:grid-cols-3">
				<InputField
					label="display_label"
					value={displayLabel}
					onChange={(e) => setDisplayLabel(e.target.value)}
					placeholder={t('bulkEditProviders.displayLabelPlaceholder')}
				/>
				<InputField
					label="base_url"
					value={baseUrl}
					onChange={(e) => setBaseUrl(e.target.value)}
					placeholder="http://stack2-llama-chat:8080"
				/>
				<InputField
					label="health_endpoint"
					value={healthEndpoint}
					onChange={(e) => setHealthEndpoint(e.target.value)}
					placeholder="/health"
				/>

				<label className="text-sm text-(--desktop-text-secondary)">
					<span className="block text-xs font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)">
						api_key_required
					</span>
					<select
						value={apiKeyRequired}
						onChange={(e) => setApiKeyRequired(e.target.value as TriBool)}
						className="mt-2 w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-(--desktop-text-primary)"
					>
						<option value="">{t('common.doNotChange')}</option>
						<option value="true">true</option>
						<option value="false">false</option>
					</select>
				</label>

				<label className="text-sm text-(--desktop-text-secondary)">
					<span className="block text-xs font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)">
						enabled
					</span>
					<select
						value={enabled}
						onChange={(e) => setEnabled(e.target.value as TriBool)}
						className="mt-2 w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-(--desktop-text-primary)"
					>
						<option value="">{t('common.doNotChange')}</option>
						<option value="true">{t('common.enable')}</option>
						<option value="false">{t('common.disable')}</option>
					</select>
				</label>

				<InputField
					label="fallback_for (csv)"
					value={fallbackForCSV}
					onChange={(e) => setFallbackForCSV(e.target.value)}
					placeholder={
						knownProviderNames.slice(0, 6).join(', ') +
						(knownProviderNames.length > 6 ? ', …' : '')
					}
					hint={t('bulkEditProviders.fallbackForHint')}
				/>
			</div>

			<div className="grid gap-4 sm:grid-cols-4">
				<InputField
					label="timeout_seconds"
					value={timeoutSeconds}
					onChange={(e) => setTimeoutSeconds(e.target.value)}
					placeholder={t('common.forExample', { value: '120' })}
					inputMode="numeric"
				/>
				<InputField
					label="max_concurrent"
					value={maxConcurrent}
					onChange={(e) => setMaxConcurrent(e.target.value)}
					placeholder={t('common.forExample', { value: '5' })}
					inputMode="numeric"
				/>
				<InputField
					label="cost_per_request"
					value={costPerRequest}
					onChange={(e) => setCostPerRequest(e.target.value)}
					placeholder={t('common.forExample', { value: '0.25' })}
					inputMode="decimal"
				/>
				<InputField
					label="fallback_priority"
					value={fallbackPriority}
					onChange={(e) => setFallbackPriority(e.target.value)}
					placeholder={t('common.forExample', { value: '10' })}
					inputMode="numeric"
				/>
			</div>

			<div className="rounded-2xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/90 p-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<div className="text-sm font-semibold">
							{t('bulkEditProviders.configJsonSectionTitle')}
						</div>
						<div className="mt-1 text-xs text-(--desktop-text-muted)">
							{t('bulkEditProviders.configJsonSectionHint')}
						</div>
					</div>
					<label className="text-sm text-(--desktop-text-secondary)">
						<select
							value={configMode}
							onChange={(e) =>
								setConfigMode(e.target.value as typeof configMode)
							}
							className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-(--desktop-text-primary)"
						>
							<option value="none">{t('common.doNotChangeShort')}</option>
							<option value="merge">
								{t('bulkEditProviders.configModeMerge')}
							</option>
							<option value="replace">
								{t('bulkEditProviders.configModeReplace')}
							</option>
						</select>
					</label>
				</div>

				{singleProviderName ? (
					<div className="mt-4 rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<div className="text-sm font-semibold">
									{t('bulkEditProviders.scanTitle')}
								</div>
								<div className="mt-1 text-xs text-(--desktop-text-muted)">
									{t('bulkEditProviders.scanHint')}
								</div>
							</div>
							<Button
								variant="secondary"
								onClick={() => void scanModelsNow()}
								disabled={scanLoading}
							>
								{scanLoading
									? t('bulkEditProviders.scanning')
									: t('bulkEditProviders.scanModels')}
							</Button>
						</div>
						{scanError ? (
							<div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
								{scanError}
							</div>
						) : null}
						{scannedModels.length ? (
							<div className="mt-3">
								<div className="text-xs font-semibold uppercase tracking-[0.16em] text-(--desktop-text-muted)">
									{t('bulkEditProviders.modelsFound', {
										count: scannedModels.length,
									})}
								</div>
								<div className="mt-2 flex flex-wrap gap-2">
									{scannedModels.slice(0, 60).map((m) => (
										<button
											key={m}
											type="button"
											className="rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-1 text-xs text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft-hover)"
											onClick={() => selectScannedModel(m)}
										>
											{m}
										</button>
									))}
								</div>
								{scannedModels.length > 60 ? (
									<div className="mt-2 text-xs text-(--desktop-text-muted)">
										{t('bulkEditProviders.modelsTruncated', {
											total: scannedModels.length,
										})}
									</div>
								) : null}
							</div>
						) : null}
					</div>
				) : null}

				<div className="mt-4 grid gap-4 lg:grid-cols-3">
					<label className="text-sm text-(--desktop-text-secondary)">
						<span className="block text-xs font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)">
							provider_role
						</span>
						<select
							value={providerRole}
							onChange={(e) => setProviderRole(e.target.value as ProviderRole)}
							className="mt-2 w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-(--desktop-text-primary)"
						>
							<option value="">{t('bulkEditProviders.autoOption')}</option>
							<option value="text">text</option>
							<option value="image">image</option>
							<option value="audio">audio</option>
							<option value="other">other</option>
						</select>
						<div className="mt-1 text-xs text-(--desktop-text-muted)">
							{t('bulkEditProviders.providerRoleHint')}
						</div>
					</label>
					<InputField
						label="default_model"
						value={defaultModel}
						onChange={(e) => setDefaultModel(e.target.value)}
						placeholder="qwen3-14b-q4_k_m.gguf"
						disabled={effectiveRole !== 'text'}
						hint={
							effectiveRole === 'text'
								? t('bulkEditProviders.defaultModelHintText')
								: t('bulkEditProviders.defaultModelHintNonText')
						}
					/>
					<InputField
						label="models (csv)"
						value={modelsCSV}
						onChange={(e) => setModelsCSV(e.target.value)}
						placeholder="modelA, modelB, modelC"
						hint={t('bulkEditProviders.modelsCsvHint')}
						disabled={effectiveRole !== 'text'}
					/>
					{modelRoutesForProviderOps ? (
						<div className="lg:col-span-3">
							<div className="rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4 text-sm">
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div>
										<div className="font-semibold">
											{t('bulkEditProviders.applyModelToAllTypesTitle')}
										</div>
										<div className="mt-1 text-xs text-(--desktop-text-muted)">
											{t('bulkEditProviders.applyModelToAllTypesHint', {
												provider: modelRoutesForProviderOps.providerName,
												count:
													modelRoutesForProviderOps.affectedTypeKeys.length,
											})}
										</div>
									</div>
									<Button onClick={submitApplyModelToProviderTypes}>
										{t('common.generateChanges')}
									</Button>
								</div>
							</div>
						</div>
					) : null}
					<div className="lg:col-span-3">
						<label
							htmlFor="ugs-admin-v2-provider-config-json"
							className="text-xs font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)"
						>
							config_json (JSON object)
						</label>
						<textarea
							id="ugs-admin-v2-provider-config-json"
							value={configJsonRaw}
							onChange={(e) => setConfigJsonRaw(e.target.value)}
							placeholder='{"k": "v"}'
							className="mt-2 h-36 w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 font-mono text-[0.75rem] text-(--desktop-text-primary) placeholder:opacity-55"
							disabled={configMode === 'none'}
						/>
					</div>
				</div>
			</div>

			{clientErrors.length ? (
				<div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
					<ul className="list-disc space-y-1 pl-5">
						{clientErrors.map((e) => (
							<li key={e}>{e}</li>
						))}
					</ul>
				</div>
			) : null}

			<div className="rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4 text-sm">
				<div className="text-xs font-semibold uppercase tracking-[0.16em] text-(--desktop-text-muted)">
					{t('common.operationsPreview')}
				</div>
				<ul className="mt-2 space-y-1 text-(--desktop-text-secondary)">
					{hasChanges ? (
						previewOps.map((op) => (
							<li
								key={`${op.kind}:${'provider_names' in op ? op.provider_names.join(',') : ''}`}
								className="font-mono text-[0.75rem]"
							>
								{op.kind}
								{'provider_names' in op
									? ` → ${op.provider_names.join(', ')}`
									: ''}
							</li>
						))
					) : (
						<li className="text-(--desktop-text-muted)">
							{t('common.noChanges')}
						</li>
					)}
				</ul>
			</div>

			<div className="flex flex-wrap gap-3 pt-2">
				<Button variant="secondary" onClick={onClose}>
					{t('common.cancel')}
				</Button>
				<Button
					onClick={submit}
					disabled={!hasChanges || !!clientErrors.length}
				>
					{t('common.generateChanges')}
				</Button>
			</div>
		</div>
	);
}
