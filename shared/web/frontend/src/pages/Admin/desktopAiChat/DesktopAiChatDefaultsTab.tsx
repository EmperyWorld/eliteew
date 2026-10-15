/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Structured defaults editor + advanced JSON merge for Desktop AI Chat admin.
 * Includes typed generation budget fields persisted in desktop_ai_chat_config.defaults.
 *
 * Related:
 * - desktopAiChatAdminDefaults.ts
 * - documentation/product/DESKTOP-LLAMA-CHAT.md
 */

import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownTrayIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '../../Desktop/constants';
import { DesktopAiChatAdminNumberField } from './DesktopAiChatAdminNumberField';
import { useDesktopAiChatAdmin } from './DesktopAiChatAdminContext';
import { DesktopAiChatAdminStatusBanner } from './DesktopAiChatAdminStatusBanner';
import {
	DESKTOP_AI_CHAT_ENSEMBLE_ENGINES,
	DESKTOP_AI_CHAT_ROUTING_MODES,
	DESKTOP_AI_CHAT_TOOL_ROUTER_MODES,
	GENERATION_BUDGET_LIMITS,
	mergeDefaultsForm,
	parseAdvancedDefaultsJson,
	readDefaultsForm,
	readKbsewSummaryFromDefaults,
	type DesktopAiChatDefaultsForm,
} from './desktopAiChatAdminDefaults';

type DefaultsEditorMode = 'form' | 'json';

const SECTION_TITLE = `${DESKTOP_TYPOGRAPHY.shellMeta10} font-medium tracking-normal text-white/65`;
const SECTION_CARD =
	'space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4';

function ToggleRow({
	id,
	label,
	hint,
	checked,
	disabled,
	onChange,
}: {
	id: string;
	label: string;
	hint?: string;
	checked: boolean;
	disabled?: boolean;
	onChange: (next: boolean) => void;
}) {
	return (
		<label
			htmlFor={id}
			className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5"
		>
			<input
				id={id}
				type="checkbox"
				className="mt-1 rounded border-white/20 bg-black/40"
				checked={checked}
				disabled={disabled}
				onChange={(e) => onChange(e.target.checked)}
			/>
			<span className="min-w-0 flex-1">
				<span className="font-medium text-white/95">{label}</span>
				{hint ? (
					<span
						className={`${DESKTOP_TYPOGRAPHY.caption} mt-0.5 block text-white/55`}
					>
						{hint}
					</span>
				) : null}
			</span>
		</label>
	);
}

export function DesktopAiChatDefaultsTab({
	onOpenBlueprint,
}: {
	onOpenBlueprint?: () => void;
}): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const {
		defaults,
		saveState,
		statusKind,
		statusMessage,
		saveDefaultsPatch,
		refresh,
	} = useDesktopAiChatAdmin();
	const [mode, setMode] = React.useState<DefaultsEditorMode>('form');
	const [form, setForm] = React.useState<DesktopAiChatDefaultsForm>(() =>
		readDefaultsForm(defaults)
	);
	const [advancedJson, setAdvancedJson] = React.useState('{}');
	const [confirmDisableFeature, setConfirmDisableFeature] =
		React.useState(false);
	const [pendingForm, setPendingForm] =
		React.useState<DesktopAiChatDefaultsForm | null>(null);
	const [jsonError, setJsonError] = React.useState<string | null>(null);
	const busy = saveState === 'saving';
	const g = GENERATION_BUDGET_LIMITS;

	React.useEffect(() => {
		setForm(readDefaultsForm(defaults));
		setAdvancedJson(JSON.stringify(defaults, null, 2));
	}, [defaults]);

	const kbsewSummary = readKbsewSummaryFromDefaults(defaults);

	const applyFormSave = async (nextForm: DesktopAiChatDefaultsForm) => {
		const patch = mergeDefaultsForm(defaults, nextForm);
		const ok = await saveDefaultsPatch(patch);
		if (ok) {
			setForm(readDefaultsForm(patch));
		}
	};

	const onSaveForm = async () => {
		if (!form.featureEnabled && readDefaultsForm(defaults).featureEnabled) {
			setPendingForm(form);
			setConfirmDisableFeature(true);
			return;
		}
		await applyFormSave(form);
	};

	const onAdvancedJsonSaveClick = async () => {
		setJsonError(null);
		try {
			const patch = parseAdvancedDefaultsJson(advancedJson);
			await saveDefaultsPatch(patch);
		} catch {
			setJsonError(t('adminAiChat.invalidJson'));
		}
	};

	return (
		<div className="space-y-4 max-w-3xl">
			<DesktopAiChatAdminStatusBanner
				kind={statusKind}
				message={statusMessage}
			/>
			{jsonError ? (
				<div
					role="alert"
					className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
				>
					{jsonError}
				</div>
			) : null}

			<div
				className="flex flex-wrap gap-2"
				role="tablist"
				aria-label={t('adminAiChat.defaultsModeAria')}
			>
				{(['form', 'json'] as const).map((id) => (
					<button
						key={id}
						type="button"
						role="tab"
						aria-selected={mode === id}
						className={`${DESKTOP_INTERACTIVE.btnRounded} px-3 py-1.5 text-sm ${
							mode === id
								? 'bg-violet-600/30 text-white ring-1 ring-violet-400/40'
								: 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
						}`}
						onClick={() => setMode(id)}
					>
						{id === 'form'
							? t('adminAiChat.defaultsModeForm')
							: t('adminAiChat.defaultsModeJson')}
					</button>
				))}
			</div>

			{mode === 'form' ? (
				<div className="space-y-4" role="tabpanel">
					<section className={SECTION_CARD}>
						<h4 className={SECTION_TITLE}>
							{t('adminAiChat.defaultsSectionGates')}
						</h4>
						<div className="space-y-2">
							<ToggleRow
								id="dac-admin-feature-enabled"
								label={t('adminAiChat.field.featureEnabled')}
								hint={t('adminAiChat.field.featureEnabledHint')}
								checked={form.featureEnabled}
								disabled={busy}
								onChange={(v) => setForm((f) => ({ ...f, featureEnabled: v }))}
							/>
							<ToggleRow
								id="dac-admin-voice-enabled"
								label={t('adminAiChat.field.voiceEnabled')}
								checked={form.voiceEnabled}
								disabled={busy}
								onChange={(v) => setForm((f) => ({ ...f, voiceEnabled: v }))}
							/>
							<ToggleRow
								id="dac-admin-web-search"
								label={t('adminAiChat.field.toolsWebSearch')}
								checked={form.toolsWebSearchEnabled}
								disabled={busy}
								onChange={(v) =>
									setForm((f) => ({ ...f, toolsWebSearchEnabled: v }))
								}
							/>
							<ToggleRow
								id="dac-admin-fetch-url"
								label={t('adminAiChat.field.toolsFetchUrl')}
								hint={t('adminAiChat.field.toolsFetchUrlHint')}
								checked={form.toolsFetchUrlEnabled}
								disabled={busy}
								onChange={(v) =>
									setForm((f) => ({ ...f, toolsFetchUrlEnabled: v }))
								}
							/>
							<ToggleRow
								id="dac-admin-image"
								label={t('adminAiChat.field.toolsImage')}
								checked={form.toolsImageEnabled}
								disabled={busy}
								onChange={(v) =>
									setForm((f) => ({ ...f, toolsImageEnabled: v }))
								}
							/>
							<ToggleRow
								id="dac-admin-tool-router"
								label={t('adminAiChat.field.toolRouter')}
								checked={form.desktopToolRouterEnabled}
								disabled={busy}
								onChange={(v) =>
									setForm((f) => ({ ...f, desktopToolRouterEnabled: v }))
								}
							/>
						</div>
					</section>

					<section className={SECTION_CARD}>
						<h4 className={SECTION_TITLE}>
							{t('adminAiChat.defaultsSectionModel')}
						</h4>
						<label
							htmlFor="dac-admin-default-model"
							className={`block ${DESKTOP_TYPOGRAPHY.caption} mb-1 text-white/70`}
						>
							{t('adminAiChat.field.defaultLlamaModel')}
						</label>
						<input
							id="dac-admin-default-model"
							type="text"
							disabled={busy}
							value={form.defaultLlamaModel}
							onChange={(e) =>
								setForm((f) => ({ ...f, defaultLlamaModel: e.target.value }))
							}
							className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/90"
						/>
						<label
							htmlFor="dac-admin-router-mode"
							className={`block ${DESKTOP_TYPOGRAPHY.caption} mb-1 mt-3 text-white/70`}
						>
							{t('adminAiChat.field.toolRouterMode')}
						</label>
						<select
							id="dac-admin-router-mode"
							disabled={busy}
							value={form.desktopToolRouterMode}
							onChange={(e) =>
								setForm((f) => ({
									...f,
									desktopToolRouterMode: e.target
										.value as DesktopAiChatDefaultsForm['desktopToolRouterMode'],
								}))
							}
							className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/90"
						>
							{DESKTOP_AI_CHAT_TOOL_ROUTER_MODES.map((m) => (
								<option key={m} value={m}>
									{m}
								</option>
							))}
						</select>
					</section>

					<section className={SECTION_CARD}>
						<h4 className={SECTION_TITLE}>
							{t('adminAiChat.defaultsSectionEnsemble')}
						</h4>
						<label
							htmlFor="dac-admin-routing-mode"
							className={`block ${DESKTOP_TYPOGRAPHY.caption} mb-1 text-white/70`}
						>
							{t('adminAiChat.field.ensembleRoutingMode')}
						</label>
						<select
							id="dac-admin-routing-mode"
							disabled={busy}
							value={form.desktopEnsembleRoutingMode}
							onChange={(e) =>
								setForm((f) => ({
									...f,
									desktopEnsembleRoutingMode: e.target
										.value as DesktopAiChatDefaultsForm['desktopEnsembleRoutingMode'],
								}))
							}
							className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/90"
						>
							{DESKTOP_AI_CHAT_ROUTING_MODES.map((m) => (
								<option key={m} value={m}>
									{m}
								</option>
							))}
						</select>
						<label
							htmlFor="dac-admin-ensemble-engine"
							className={`block ${DESKTOP_TYPOGRAPHY.caption} mb-1 mt-3 text-white/70`}
						>
							{t('adminAiChat.field.ensembleEngine')}
						</label>
						<select
							id="dac-admin-ensemble-engine"
							disabled={busy}
							value={form.desktopEnsembleEngine}
							onChange={(e) =>
								setForm((f) => ({
									...f,
									desktopEnsembleEngine: e.target
										.value as DesktopAiChatDefaultsForm['desktopEnsembleEngine'],
								}))
							}
							className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/90"
						>
							{DESKTOP_AI_CHAT_ENSEMBLE_ENGINES.map((m) => (
								<option key={m} value={m}>
									{m}
								</option>
							))}
						</select>
						{form.desktopEnsembleEngine === 'blueprint' ? (
							<div className="mt-3 rounded-lg border border-violet-400/25 bg-violet-950/20 px-3 py-3">
								<p className={`${DESKTOP_TYPOGRAPHY.caption} text-white/70`}>
									{t('adminAiChat.defaultsBlueprintHint')}
								</p>
								{onOpenBlueprint ? (
									<button
										type="button"
										onClick={onOpenBlueprint}
										className={`${DESKTOP_TYPOGRAPHY.caption} mt-2 text-violet-300 hover:underline`}
									>
										{t('adminAiChat.defaultsOpenBlueprint')}
									</button>
								) : null}
							</div>
						) : null}
					</section>

					<section className={SECTION_CARD}>
						<h4 className={SECTION_TITLE}>
							{t('adminAiChat.defaultsSectionGeneration')}
						</h4>
						<p className={`${DESKTOP_TYPOGRAPHY.caption} text-white/55`}>
							{t('adminAiChat.defaultsGenerationLead')}
						</p>
						<div className="grid gap-4 sm:grid-cols-2">
							<DesktopAiChatAdminNumberField
								id="dac-admin-num-predict"
								label={t('adminAiChat.field.numPredict')}
								hint={t('adminAiChat.field.numPredictHint')}
								value={form.desktopChatNumPredict}
								min={g.numPredict.lo}
								max={g.numPredict.hi}
								disabled={busy}
								onChange={(v) =>
									setForm((f) => ({ ...f, desktopChatNumPredict: v }))
								}
							/>
							<DesktopAiChatAdminNumberField
								id="dac-admin-timeout-sec"
								label={t('adminAiChat.field.timeoutSec')}
								hint={t('adminAiChat.field.timeoutSecHint')}
								value={form.desktopChatTimeoutSec}
								min={g.timeoutSec.lo}
								max={g.timeoutSec.hi}
								disabled={busy}
								onChange={(v) =>
									setForm((f) => ({ ...f, desktopChatTimeoutSec: v }))
								}
							/>
							<DesktopAiChatAdminNumberField
								id="dac-admin-separate-reply"
								label={t('adminAiChat.field.separateReplyMaxTokens')}
								hint={t('adminAiChat.field.separateReplyMaxTokensHint')}
								value={form.ensembleSeparateReplyMaxTokens}
								min={g.separateReply.lo}
								max={g.separateReply.hi}
								disabled={busy}
								onChange={(v) =>
									setForm((f) => ({
										...f,
										ensembleSeparateReplyMaxTokens: v,
									}))
								}
							/>
							<DesktopAiChatAdminNumberField
								id="dac-admin-joint-section"
								label={t('adminAiChat.field.jointSectionMaxTokens')}
								hint={t('adminAiChat.field.jointSectionMaxTokensHint')}
								value={form.ensembleJointSectionMaxTokens}
								min={g.jointSection.lo}
								max={g.jointSection.hi}
								disabled={busy}
								onChange={(v) =>
									setForm((f) => ({
										...f,
										ensembleJointSectionMaxTokens: v,
									}))
								}
							/>
							<DesktopAiChatAdminNumberField
								id="dac-admin-blueprint-step"
								label={t('adminAiChat.field.blueprintStepMaxTokens')}
								hint={t('adminAiChat.field.blueprintStepMaxTokensHint')}
								value={form.ensembleBlueprintStepMaxTokens}
								min={g.blueprintStep.lo}
								max={g.blueprintStep.hi}
								disabled={busy}
								onChange={(v) =>
									setForm((f) => ({
										...f,
										ensembleBlueprintStepMaxTokens: v,
									}))
								}
							/>
						</div>
					</section>

					<section className={SECTION_CARD}>
						<label
							htmlFor="dac-admin-fetch-hosts"
							className={`block ${SECTION_TITLE} mb-2`}
						>
							{t('adminAiChat.field.fetchUrlAllowHosts')}
						</label>
						<textarea
							id="dac-admin-fetch-hosts"
							disabled={busy}
							value={form.fetchUrlAllowHosts}
							onChange={(e) =>
								setForm((f) => ({ ...f, fetchUrlAllowHosts: e.target.value }))
							}
							rows={4}
							spellCheck={false}
							className="w-full rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-xs text-white/90"
						/>
						<p className={`${DESKTOP_TYPOGRAPHY.caption} mt-2 text-white/50`}>
							{t('adminAiChat.field.fetchUrlAllowHostsHint')}
						</p>
					</section>

					<section className={SECTION_CARD}>
						<p className={SECTION_TITLE}>
							{t('adminAiChat.kbsewSummaryTitle')}
						</p>
						<p className={`${DESKTOP_TYPOGRAPHY.body} mt-1 text-white/85`}>
							{t('adminAiChat.kbsewSummaryLine', {
								count: kbsewSummary.enabledCount,
								barrels: kbsewSummary.form.allowedBarrelIds.length,
							})}
						</p>
						<a
							href="?section=kbsew&kbsewTab=agent-access"
							className={`${DESKTOP_TYPOGRAPHY.caption} mt-2 inline-block text-violet-300 hover:underline`}
						>
							{t('adminAiChat.overview.kbsewLink')}
						</a>
					</section>
				</div>
			) : (
				<div className="space-y-2" role="tabpanel">
					<p className={`${DESKTOP_TYPOGRAPHY.caption} text-white/55`}>
						{t('adminAiChat.advancedJsonHint')}
					</p>
					<textarea
						id="admin-ai-chat-defaults-json"
						disabled={busy}
						aria-busy={busy}
						value={advancedJson}
						onChange={(e) => setAdvancedJson(e.target.value)}
						spellCheck={false}
						className="w-full min-h-[240px] rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-xs text-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
					/>
				</div>
			)}

			<div className="sticky bottom-0 z-10 flex flex-wrap gap-2 border-t border-white/10 bg-[#0a0520]/92 py-3 backdrop-blur-md">
				<button
					type="button"
					onClick={() => void refresh()}
					disabled={busy}
					className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/90 hover:bg-white/5 disabled:opacity-50"
				>
					<ArrowPathIcon className="h-4 w-4" aria-hidden />
					{t('adminAiChat.refresh')}
				</button>
				<button
					type="button"
					disabled={busy}
					aria-busy={busy}
					onClick={() =>
						void (mode === 'form' ? onSaveForm() : onAdvancedJsonSaveClick())
					}
					className="inline-flex items-center gap-1 rounded-lg bg-violet-600/90 px-3 py-1.5 text-sm text-white hover:bg-violet-600 disabled:opacity-50"
				>
					<ArrowDownTrayIcon className="h-4 w-4" aria-hidden />
					{busy ? t('adminAiChat.saving') : t('adminAiChat.saveDefaults')}
				</button>
			</div>

			<ConfirmDeleteModal
				isOpen={confirmDisableFeature}
				onClose={() => {
					setConfirmDisableFeature(false);
					setPendingForm(null);
				}}
				onConfirm={async () => {
					if (pendingForm) {
						await applyFormSave(pendingForm);
					}
					setConfirmDisableFeature(false);
					setPendingForm(null);
				}}
				title={t('adminAiChat.confirmDisableFeatureTitle')}
				warningMessage={t('adminAiChat.confirmDisableFeatureBody')}
				confirmButtonLabel={t('adminAiChat.confirmDisableFeatureButton')}
			/>
		</div>
	);
}
