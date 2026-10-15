/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Per-stage form fields for AMKA operator config in the Builder (snapshot through final).
 *
 * Invariants:
 * - Field keys map to `AmkaOperatorConfigV1` schema; caps come from effective env/trusted config.
 *
 * Related:
 * - src/features/amka/AmkaBuilderView.tsx
 * - src/features/amka/amkaOperatorConfigNormalize.ts
 */
import {
	AMKA_OPERATOR_CONFIG_V1_DEFAULT,
	type AmkaOperatorConfigV1,
} from '@/services/amka/marketingCabinetAmkaBridge';
import { cn } from '@/utils/cn';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';
import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { TEXTAREA_CLASS } from '@/services/amka/marketingCabinetAmkaBridge';
import { normalizeAmkaOperatorConfigV1 } from './amkaOperatorConfigNormalize';

export type AmkaPipelineStageId =
	| 'snapshot'
	| 'baseline'
	| 'section_llm'
	| 'master_plan'
	| 'operator_gate'
	| 'execute'
	| 'final';

function readEffNum(
	eff: Record<string, unknown> | undefined,
	key: string
): string | null {
	if (!eff || typeof eff !== 'object') return null;
	const v = eff[key];
	if (typeof v === 'number' && Number.isFinite(v)) return String(v);
	return null;
}

function readEffBool(
	eff: Record<string, unknown> | undefined,
	key: string
): boolean | null {
	if (!eff || typeof eff !== 'object') return null;
	const v = eff[key];
	return typeof v === 'boolean' ? v : null;
}

export function AmkaBuilderStageForm({
	stageId,
	draft,
	setDraft,
	ro,
	caps,
	secEff,
	mpEff,
	exEff,
	finEff,
	t,
}: {
	stageId: AmkaPipelineStageId;
	draft: AmkaOperatorConfigV1;
	setDraft: Dispatch<SetStateAction<AmkaOperatorConfigV1>>;
	ro: boolean;
	caps:
		| {
				audit_delay_ms_max: number;
				audit_parallelism_max: number;
				execute_max_wait_seconds_max: number;
				execute_max_wait_seconds_min: number;
				final_prompt_chars_max: number;
				master_plan_max_tokens_max: number;
		  }
		| undefined;
	secEff: Record<string, unknown> | undefined;
	mpEff: Record<string, unknown> | undefined;
	exEff: Record<string, unknown> | undefined;
	finEff: Record<string, unknown> | undefined;
	t: TFunction<'marketing'>;
}) {
	const n = normalizeAmkaOperatorConfigV1(draft);
	const defaults = normalizeAmkaOperatorConfigV1(
		AMKA_OPERATOR_CONFIG_V1_DEFAULT
	);
	switch (stageId) {
		case 'snapshot':
			return (
				<p className="text-sm text-(--desktop-text-muted)">
					{t('amkaBuilder.readOnlyHint')}
				</p>
			);
		case 'baseline':
			return (
				<div className="space-y-3">
					<label className="flex flex-col gap-1.5">
						<span className="text-sm font-medium text-(--desktop-text-secondary)">
							{t('amkaBuilder.baseline.suffixLabel')}
						</span>
						<textarea
							value={n.baseline_audit.extra_prompt_suffix}
							onChange={(e) =>
								setDraft({
									...draft,
									baseline_audit: {
										...n.baseline_audit,
										extra_prompt_suffix: e.target.value,
									},
								})
							}
							className={TEXTAREA_CLASS}
							rows={4}
							readOnly={ro}
							disabled={ro}
						/>
					</label>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						disabled={ro}
						onClick={() =>
							setDraft({
								...draft,
								baseline_audit: defaults.baseline_audit,
							})
						}
					>
						{t('amkaBuilder.resetSection')}
					</DesktopAppButton>
				</div>
			);
		case 'section_llm':
			return (
				<div className="space-y-4">
					<label className="flex items-center gap-2.5 text-sm">
						<input
							type="checkbox"
							checked={n.section_llm_audit.enabled}
							onChange={(e) =>
								setDraft({
									...draft,
									section_llm_audit: {
										...n.section_llm_audit,
										enabled: e.target.checked,
									},
								})
							}
							disabled={ro}
							className={cn(
								'size-4 shrink-0 accent-[rgb(var(--desktop-accent-rgb))]',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
						/>
						{t('amkaBuilder.sectionLlm.enabled')}
					</label>
					{readEffBool(secEff, 'enabled') !== null ? (
						<p className="text-xs text-(--desktop-text-muted)">
							{t('amkaBuilder.effectiveApplied', {
								value: readEffBool(secEff, 'enabled')
									? t('amkaBuilder.effectiveOn')
									: t('amkaBuilder.effectiveOff'),
							})}
						</p>
					) : null}
					<div className="grid gap-3 sm:grid-cols-2">
						<label className="flex flex-col gap-1.5">
							<span className="text-sm font-medium text-(--desktop-text-secondary)">
								{t('amkaBuilder.sectionLlm.delay')}
							</span>
							<input
								type="number"
								min={0}
								max={caps?.audit_delay_ms_max}
								value={n.section_llm_audit.delay_ms ?? ''}
								onChange={(e) => {
									const v = e.target.value;
									setDraft({
										...draft,
										section_llm_audit: {
											...n.section_llm_audit,
											delay_ms: v === '' ? null : Number.parseInt(v, 10),
										},
									});
								}}
								disabled={ro}
								className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary)"
								placeholder={t('amkaBuilder.placeholderDefault')}
							/>
							{readEffNum(secEff, 'delay_ms') !== null ? (
								<span className="text-xs text-(--desktop-text-muted)">
									{t('amkaBuilder.effectiveApplied', {
										value: readEffNum(secEff, 'delay_ms') ?? '',
									})}
								</span>
							) : null}
						</label>
						<label className="flex flex-col gap-1.5">
							<span className="text-sm font-medium text-(--desktop-text-secondary)">
								{t('amkaBuilder.sectionLlm.parallel')}
							</span>
							<input
								type="number"
								min={1}
								max={caps?.audit_parallelism_max}
								value={n.section_llm_audit.parallelism ?? ''}
								onChange={(e) => {
									const v = e.target.value;
									setDraft({
										...draft,
										section_llm_audit: {
											...n.section_llm_audit,
											parallelism: v === '' ? null : Number.parseInt(v, 10),
										},
									});
								}}
								disabled={ro}
								className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary)"
								placeholder={t('amkaBuilder.placeholderDefault')}
							/>
							{readEffNum(secEff, 'parallelism') !== null ? (
								<span className="text-xs text-(--desktop-text-muted)">
									{t('amkaBuilder.effectiveApplied', {
										value: readEffNum(secEff, 'parallelism') ?? '',
									})}
								</span>
							) : null}
						</label>
					</div>
					<p className="text-xs leading-relaxed text-(--desktop-text-muted) wrap-pretty">
						{t('amkaBuilder.sectionLlm.parallelismHint')}
					</p>
					<p className="text-xs leading-relaxed text-(--desktop-text-muted) wrap-pretty">
						{t('amkaBuilder.sectionLlm.backoffHint')}
					</p>
					<p className="text-xs leading-relaxed text-(--desktop-text-muted) wrap-pretty">
						{t('amkaBuilder.sectionLlm.evidenceHint')}
					</p>
					<label className="flex items-center gap-2.5 text-sm">
						<input
							type="checkbox"
							checked={n.section_llm_audit.require_work_needed_quotes}
							onChange={(e) =>
								setDraft({
									...draft,
									section_llm_audit: {
										...n.section_llm_audit,
										require_work_needed_quotes: e.target.checked,
									},
								})
							}
							disabled={ro}
							className={cn(
								'size-4 shrink-0 accent-[rgb(var(--desktop-accent-rgb))]',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
						/>
						{t('amkaBuilder.sectionLlm.requireQuotes')}
					</label>
					{readEffBool(secEff, 'require_work_needed_quotes') !== null ? (
						<p className="text-xs text-(--desktop-text-muted)">
							{t('amkaBuilder.effectiveApplied', {
								value: readEffBool(secEff, 'require_work_needed_quotes')
									? t('amkaBuilder.effectiveOn')
									: t('amkaBuilder.effectiveOff'),
							})}
						</p>
					) : null}
					<label className="flex flex-col gap-1.5">
						<span className="text-sm font-medium text-(--desktop-text-secondary)">
							{t('amkaBuilder.extraInstruction')}
						</span>
						<textarea
							value={n.section_llm_audit.extra_prompt_instruction}
							onChange={(e) =>
								setDraft({
									...draft,
									section_llm_audit: {
										...n.section_llm_audit,
										extra_prompt_instruction: e.target.value,
									},
								})
							}
							className={TEXTAREA_CLASS}
							rows={3}
							readOnly={ro}
							disabled={ro}
						/>
					</label>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						disabled={ro}
						onClick={() =>
							setDraft({
								...draft,
								section_llm_audit: defaults.section_llm_audit,
							})
						}
					>
						{t('amkaBuilder.resetSection')}
					</DesktopAppButton>
				</div>
			);
		case 'master_plan':
			return (
				<div className="space-y-4">
					<label className="flex items-center gap-2.5 text-sm">
						<input
							type="checkbox"
							checked={n.master_plan.llm_enabled}
							onChange={(e) =>
								setDraft({
									...draft,
									master_plan: {
										...n.master_plan,
										llm_enabled: e.target.checked,
									},
								})
							}
							disabled={ro}
							className={cn(
								'size-4 shrink-0 accent-[rgb(var(--desktop-accent-rgb))]',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
						/>
						{t('amkaBuilder.masterPlan.llm')}
					</label>
					{readEffBool(mpEff, 'llm_enabled') !== null ? (
						<p className="text-xs text-(--desktop-text-muted)">
							{t('amkaBuilder.effectiveApplied', {
								value: readEffBool(mpEff, 'llm_enabled')
									? t('amkaBuilder.effectiveOn')
									: t('amkaBuilder.effectiveOff'),
							})}
						</p>
					) : null}
					<label className="flex flex-col gap-1.5">
						<span className="text-sm font-medium text-(--desktop-text-secondary)">
							{t('amkaBuilder.masterPlan.maxTokens')}
						</span>
						<input
							type="number"
							min={512}
							max={caps?.master_plan_max_tokens_max}
							value={n.master_plan.max_tokens ?? ''}
							onChange={(e) => {
								const v = e.target.value;
								setDraft({
									...draft,
									master_plan: {
										...n.master_plan,
										max_tokens: v === '' ? null : Number.parseInt(v, 10),
									},
								});
							}}
							disabled={ro}
							className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary)"
							placeholder={t('amkaBuilder.placeholderDefault')}
						/>
						{readEffNum(mpEff, 'max_tokens') !== null ? (
							<span className="text-xs text-(--desktop-text-muted)">
								{t('amkaBuilder.effectiveApplied', {
									value: readEffNum(mpEff, 'max_tokens') ?? '',
								})}
							</span>
						) : null}
					</label>
					<div className="space-y-2">
						<label className="flex items-center gap-2.5 text-sm">
							<input
								type="checkbox"
								checked={n.master_plan.retry_on_parse_failure}
								onChange={(e) =>
									setDraft({
										...draft,
										master_plan: {
											...n.master_plan,
											retry_on_parse_failure: e.target.checked,
										},
									})
								}
								disabled={ro}
								className={cn(
									'size-4 shrink-0 accent-[rgb(var(--desktop-accent-rgb))]',
									DESKTOP_CHROME_FOCUS_VISIBLE
								)}
							/>
							{t('amkaBuilder.masterPlan.retryOnParse')}
						</label>
						{readEffBool(mpEff, 'retry_on_parse_failure') !== null ? (
							<p className="text-xs text-(--desktop-text-muted)">
								{t('amkaBuilder.effectiveApplied', {
									value: readEffBool(mpEff, 'retry_on_parse_failure')
										? t('amkaBuilder.effectiveOn')
										: t('amkaBuilder.effectiveOff'),
								})}
							</p>
						) : null}
						<label className="flex items-center gap-2.5 text-sm">
							<input
								type="checkbox"
								checked={n.master_plan.repair_json_on_parse_failure}
								onChange={(e) =>
									setDraft({
										...draft,
										master_plan: {
											...n.master_plan,
											repair_json_on_parse_failure: e.target.checked,
										},
									})
								}
								disabled={ro}
								className={cn(
									'size-4 shrink-0 accent-[rgb(var(--desktop-accent-rgb))]',
									DESKTOP_CHROME_FOCUS_VISIBLE
								)}
							/>
							{t('amkaBuilder.masterPlan.repairJson')}
						</label>
						{readEffBool(mpEff, 'repair_json_on_parse_failure') !== null ? (
							<p className="text-xs text-(--desktop-text-muted)">
								{t('amkaBuilder.effectiveApplied', {
									value: readEffBool(mpEff, 'repair_json_on_parse_failure')
										? t('amkaBuilder.effectiveOn')
										: t('amkaBuilder.effectiveOff'),
								})}
							</p>
						) : null}
					</div>
					<p className="text-xs leading-relaxed text-(--desktop-text-muted) wrap-pretty">
						{t('amkaBuilder.masterPlan.qualityHint')}
					</p>
					<label className="flex flex-col gap-1.5">
						<span className="text-sm font-medium text-(--desktop-text-secondary)">
							{t('amkaBuilder.extraInstruction')}
						</span>
						<textarea
							value={n.master_plan.extra_prompt_instruction}
							onChange={(e) =>
								setDraft({
									...draft,
									master_plan: {
										...n.master_plan,
										extra_prompt_instruction: e.target.value,
									},
								})
							}
							className={TEXTAREA_CLASS}
							rows={3}
							readOnly={ro}
							disabled={ro}
						/>
					</label>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						disabled={ro}
						onClick={() =>
							setDraft({
								...draft,
								master_plan: defaults.master_plan,
							})
						}
					>
						{t('amkaBuilder.resetSection')}
					</DesktopAppButton>
				</div>
			);
		case 'operator_gate':
			return (
				<p className="text-sm text-(--desktop-text-muted)">
					{t('amkaBuilder.gateHint')}
				</p>
			);
		case 'execute':
			return (
				<div className="space-y-3">
					<label className="flex flex-col gap-1.5">
						<span className="text-sm font-medium text-(--desktop-text-secondary)">
							{t('amkaBuilder.execute.maxWait')}
						</span>
						<input
							type="number"
							min={caps?.execute_max_wait_seconds_min}
							max={caps?.execute_max_wait_seconds_max}
							value={n.execute.max_wait_seconds ?? ''}
							onChange={(e) => {
								const v = e.target.value;
								setDraft({
									...draft,
									execute: {
										...n.execute,
										max_wait_seconds: v === '' ? null : Number.parseFloat(v),
									},
								});
							}}
							disabled={ro}
							className="max-w-xs rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary)"
							placeholder={t('amkaBuilder.placeholderDefault')}
						/>
						{readEffNum(exEff, 'max_wait_seconds') !== null ? (
							<span className="text-xs text-(--desktop-text-muted)">
								{t('amkaBuilder.effectiveApplied', {
									value: readEffNum(exEff, 'max_wait_seconds') ?? '',
								})}
							</span>
						) : null}
					</label>
					<label className="flex items-center gap-2.5 text-sm">
						<input
							type="checkbox"
							checked={n.execute.desktop_ensemble_enabled ?? true}
							onChange={(e) =>
								setDraft({
									...draft,
									execute: {
										...n.execute,
										desktop_ensemble_enabled: e.target.checked,
									},
								})
							}
							disabled={ro}
							className={cn(
								'size-4 shrink-0 accent-[rgb(var(--desktop-accent-rgb))]',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
						/>
						{t('amkaBuilder.execute.desktopEnsembleEnabled')}
					</label>
					{readEffBool(exEff, 'desktop_ensemble_enabled') !== null ? (
						<p className="text-xs text-(--desktop-text-muted)">
							{t('amkaBuilder.effectiveApplied', {
								value: readEffBool(exEff, 'desktop_ensemble_enabled')
									? t('amkaBuilder.effectiveOn')
									: t('amkaBuilder.effectiveOff'),
							})}
						</p>
					) : null}
					<label className="flex items-center gap-2.5 text-sm">
						<input
							type="checkbox"
							checked={n.execute.ensemble_fallback_to_tool_agent ?? true}
							onChange={(e) =>
								setDraft({
									...draft,
									execute: {
										...n.execute,
										ensemble_fallback_to_tool_agent: e.target.checked,
									},
								})
							}
							disabled={ro}
							className={cn(
								'size-4 shrink-0 accent-[rgb(var(--desktop-accent-rgb))]',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
						/>
						{t('amkaBuilder.execute.ensembleFallbackToToolAgent')}
					</label>
					{readEffBool(exEff, 'ensemble_fallback_to_tool_agent') !== null ? (
						<p className="text-xs text-(--desktop-text-muted)">
							{t('amkaBuilder.effectiveApplied', {
								value: readEffBool(exEff, 'ensemble_fallback_to_tool_agent')
									? t('amkaBuilder.effectiveOn')
									: t('amkaBuilder.effectiveOff'),
							})}
						</p>
					) : null}
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						disabled={ro}
						onClick={() =>
							setDraft({
								...draft,
								execute: defaults.execute,
							})
						}
					>
						{t('amkaBuilder.resetSection')}
					</DesktopAppButton>
				</div>
			);
		case 'final':
			return (
				<div className="space-y-4">
					<label className="flex items-center gap-2.5 text-sm">
						<input
							type="checkbox"
							checked={n.final_assessment.llm_enabled}
							onChange={(e) =>
								setDraft({
									...draft,
									final_assessment: {
										...n.final_assessment,
										llm_enabled: e.target.checked,
									},
								})
							}
							disabled={ro}
							className={cn(
								'size-4 shrink-0 accent-[rgb(var(--desktop-accent-rgb))]',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
						/>
						{t('amkaBuilder.final.llm')}
					</label>
					{readEffBool(finEff, 'llm_enabled') !== null ? (
						<p className="text-xs text-(--desktop-text-muted)">
							{t('amkaBuilder.effectiveApplied', {
								value: readEffBool(finEff, 'llm_enabled')
									? t('amkaBuilder.effectiveOn')
									: t('amkaBuilder.effectiveOff'),
							})}
						</p>
					) : null}
					<label className="flex flex-col gap-1.5">
						<span className="text-sm font-medium text-(--desktop-text-secondary)">
							{t('amkaBuilder.final.maxChars')}
						</span>
						<input
							type="number"
							min={10_000}
							max={caps?.final_prompt_chars_max}
							value={n.final_assessment.max_prompt_chars ?? ''}
							onChange={(e) => {
								const v = e.target.value;
								setDraft({
									...draft,
									final_assessment: {
										...n.final_assessment,
										max_prompt_chars: v === '' ? null : Number.parseInt(v, 10),
									},
								});
							}}
							disabled={ro}
							className="max-w-xs rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary)"
							placeholder={t('amkaBuilder.placeholderDefault')}
						/>
						{readEffNum(finEff, 'max_prompt_chars') !== null ? (
							<span className="text-xs text-(--desktop-text-muted)">
								{t('amkaBuilder.effectiveApplied', {
									value: readEffNum(finEff, 'max_prompt_chars') ?? '',
								})}
							</span>
						) : null}
					</label>
					<label className="flex flex-col gap-1.5">
						<span className="text-sm font-medium text-(--desktop-text-secondary)">
							{t('amkaBuilder.extraInstruction')}
						</span>
						<textarea
							value={n.final_assessment.extra_prompt_instruction}
							onChange={(e) =>
								setDraft({
									...draft,
									final_assessment: {
										...n.final_assessment,
										extra_prompt_instruction: e.target.value,
									},
								})
							}
							className={TEXTAREA_CLASS}
							rows={3}
							readOnly={ro}
							disabled={ro}
						/>
					</label>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						disabled={ro}
						onClick={() =>
							setDraft({
								...draft,
								final_assessment: defaults.final_assessment,
							})
						}
					>
						{t('amkaBuilder.resetSection')}
					</DesktopAppButton>
				</div>
			);
		default:
			return null;
	}
}
