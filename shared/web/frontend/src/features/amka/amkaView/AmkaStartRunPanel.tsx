/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * AMKA run start form: mode, instruction, presets, IMC params, section subset.
 *
 * Related:
 * - AmkaView.tsx, useAmkaViewMutations.ts
 */

import { ArrowPathIcon, PlayIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
	DesktopAppInput,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import {
	AMKA_START_SECTION_KEYS,
	MarketingCabinetSelect,
	SectionPanel,
	TEXTAREA_CLASS,
} from '@/services/amka/marketingCabinetAmkaBridge';
import type {
	AmkaImcFocus,
	AmkaMainTab,
	AmkaRunMode,
} from '@/features/amka/amkaView/amkaViewTypes';
import { cn } from '@/utils/cn';

type SelectOption = { value: string; label: string };

type AmkaStartRunPanelProps = {
	busy: boolean;
	startPending: boolean;
	onStart: () => void;
	runMode: AmkaRunMode;
	onRunModeChange: (mode: AmkaRunMode) => void;
	runModeClusterClass: string;
	runModeTabClass: (active: boolean) => string;
	autoCycleCount: number;
	onAutoCycleCountChange: (count: number) => void;
	autoCycleSelectOptions: SelectOption[];
	perStepExecution: boolean;
	onPerStepExecutionChange: (value: boolean) => void;
	formCheckboxClass: string;
	userInstruction: string;
	onUserInstructionChange: (value: string) => void;
	startPresetId: string;
	onStartPresetIdChange: (value: string) => void;
	presetStartOptions: SelectOption[];
	presetsFetching: boolean;
	onOpenBuilderTab: (tab: AmkaMainTab) => void;
	imcTypeKey: string;
	onImcTypeKeyChange: (value: string) => void;
	imcTypeSelectOptions: SelectOption[];
	imcTypesLoading: boolean;
	imcFocus: AmkaImcFocus;
	onImcFocusChange: (value: AmkaImcFocus) => void;
	imcFocusSelectOptions: SelectOption[];
	imcMaxWait: string;
	onImcMaxWaitChange: (value: string) => void;
	sectionToggles: Record<string, boolean>;
	onSectionToggle: (key: string) => void;
};

export function AmkaStartRunPanel({
	busy,
	startPending,
	onStart,
	runMode,
	onRunModeChange,
	runModeClusterClass,
	runModeTabClass,
	autoCycleCount,
	onAutoCycleCountChange,
	autoCycleSelectOptions,
	perStepExecution,
	onPerStepExecutionChange,
	formCheckboxClass,
	userInstruction,
	onUserInstructionChange,
	startPresetId,
	onStartPresetIdChange,
	presetStartOptions,
	presetsFetching,
	onOpenBuilderTab,
	imcTypeKey,
	onImcTypeKeyChange,
	imcTypeSelectOptions,
	imcTypesLoading,
	imcFocus,
	onImcFocusChange,
	imcFocusSelectOptions,
	imcMaxWait,
	onImcMaxWaitChange,
	sectionToggles,
	onSectionToggle,
}: AmkaStartRunPanelProps) {
	const { t } = useTranslation('marketing');

	return (
		<SectionPanel
			title={t('amkaView.title')}
			description={t('amkaView.description')}
		>
			<div className="space-y-4">
				<DesktopAppButton
					type="button"
					variant="accent"
					size="md"
					className="min-h-11 w-full gap-2 text-sm font-semibold"
					disabled={busy}
					onClick={onStart}
				>
					{startPending ? (
						<ArrowPathIcon
							className="h-5 w-5 motion-safe:animate-spin motion-reduce:animate-none"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					) : (
						<PlayIcon
							className="h-5 w-5"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					)}
					{t('amkaView.startButton')}
				</DesktopAppButton>
				<div
					className="flex flex-col gap-2"
					role="radiogroup"
					aria-label={t('amkaView.runModeLabel')}
				>
					<span
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'text-(--desktop-text-secondary)'
						)}
					>
						{t('amkaView.runModeLabel')}
					</span>
					<div className={runModeClusterClass}>
						{/* biome-ignore lint/a11y/useSemanticElements: segmented toggle; native radios would require heavy layout rework */}
						<button
							type="button"
							role="radio"
							aria-checked={runMode === 'semi_auto'}
							className={runModeTabClass(runMode === 'semi_auto')}
							onClick={() => onRunModeChange('semi_auto')}
						>
							{t('amkaView.runModeSemiAuto')}
						</button>
						{/* biome-ignore lint/a11y/useSemanticElements: segmented toggle */}
						<button
							type="button"
							role="radio"
							aria-checked={runMode === 'auto'}
							className={runModeTabClass(runMode === 'auto')}
							onClick={() => onRunModeChange('auto')}
						>
							{t('amkaView.runModeAuto')}
						</button>
					</div>
					{runMode === 'auto' ? (
						<div className="flex max-w-xs flex-col gap-1.5">
							<span className={DESKTOP_TYPOGRAPHY.caption}>
								{t('amkaView.autoCyclesLabel')}
							</span>
							<MarketingCabinetSelect
								size="compact"
								className="w-full"
								aria-label={t('amkaView.autoCyclesLabel')}
								value={String(autoCycleCount)}
								options={autoCycleSelectOptions}
								onChange={(v) => {
									const n = Number.parseInt(v, 10);
									if (Number.isFinite(n)) onAutoCycleCountChange(n);
								}}
							/>
						</div>
					) : null}
					{runMode === 'semi_auto' ? (
						<p
							className={cn(
								DESKTOP_TYPOGRAPHY.caption,
								'text-(--desktop-text-muted) wrap-pretty'
							)}
						>
							{t('amkaView.runModeSemiAutoHelp')}
						</p>
					) : (
						<p
							className={cn(
								DESKTOP_TYPOGRAPHY.caption,
								'text-(--desktop-text-muted) wrap-pretty'
							)}
						>
							{t('amkaView.executionHintAuto')}
						</p>
					)}
					{runMode === 'semi_auto' ? (
						<div className="space-y-1.5">
							<label className="flex cursor-pointer items-center gap-2.5 text-sm text-(--desktop-text-primary)">
								<input
									type="checkbox"
									className={formCheckboxClass}
									checked={perStepExecution}
									onChange={(e) => onPerStepExecutionChange(e.target.checked)}
								/>
								<span>{t('amkaView.perStepLabel')}</span>
							</label>
							<p
								className={cn(
									DESKTOP_TYPOGRAPHY.caption,
									'text-(--desktop-text-muted)'
								)}
							>
								{t('amkaView.perStepHint')}
							</p>
						</div>
					) : null}
				</div>
				<fieldset className="m-0 min-w-0 border-0 p-0">
					<legend className="sr-only">
						{t('amkaView.focusFieldsetLegend')}
					</legend>
					<label className="flex flex-col gap-2">
						<span
							className={cn(
								DESKTOP_TYPOGRAPHY.caption,
								'text-(--desktop-text-secondary)'
							)}
						>
							{t('amkaView.userInstructionLabel')}
						</span>
						<textarea
							value={userInstruction}
							onChange={(event) => onUserInstructionChange(event.target.value)}
							placeholder={t('amkaView.userInstructionPlaceholder')}
							className={TEXTAREA_CLASS}
						/>
					</label>
				</fieldset>
				<details className="rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/50 px-3 py-2.5">
					<summary
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'cursor-pointer list-none font-semibold text-(--desktop-text-primary) [&::-webkit-details-marker]:hidden'
						)}
						aria-label={t('amkaView.spoilerStartParamsAria')}
					>
						{t('amkaView.spoilerStartParamsSummary')}
					</summary>
					<div className="mt-3 space-y-4 border-t border-(--desktop-border-subtle) pt-3">
						<div className="flex max-w-md flex-col gap-1.5">
							<span
								className={cn(
									DESKTOP_TYPOGRAPHY.caption,
									'text-(--desktop-text-secondary)'
								)}
							>
								{t('amkaView.presetLabel')}
							</span>
							<MarketingCabinetSelect
								size="compact"
								className="w-full"
								aria-label={t('amkaView.presetLabel')}
								value={startPresetId}
								options={presetStartOptions}
								onChange={onStartPresetIdChange}
								disabled={presetsFetching}
							/>
							<p
								className={cn(
									DESKTOP_TYPOGRAPHY.caption,
									'text-(--desktop-text-muted) wrap-pretty'
								)}
							>
								{t('amkaView.presetHint')}
							</p>
							<button
								type="button"
								onClick={() => onOpenBuilderTab('builder')}
								className={cn(
									DESKTOP_TYPOGRAPHY.caption,
									'text-left font-medium text-[rgb(var(--desktop-accent-rgb)/0.95)] underline decoration-[rgb(var(--desktop-accent-rgb)/0.35)] underline-offset-2 hover:decoration-[rgb(var(--desktop-accent-rgb)/0.7)]',
									DESKTOP_CHROME_FOCUS_VISIBLE
								)}
							>
								{t('amkaView.openBuilderPresets')}
							</button>
						</div>
						<div
							className={cn(
								'grid gap-3',
								runMode === 'semi_auto' ? 'sm:grid-cols-2' : 'sm:max-w-xs'
							)}
						>
							{runMode === 'semi_auto' ? (
								<div className="flex min-w-0 flex-col gap-1.5">
									<span className={DESKTOP_TYPOGRAPHY.caption}>
										{t('amkaView.imcTypeLabel')}
									</span>
									<MarketingCabinetSelect
										className="w-full min-w-0"
										size="compact"
										aria-label={t('amkaView.imcTypeLabel')}
										value={imcTypeKey}
										options={imcTypeSelectOptions}
										onChange={onImcTypeKeyChange}
										disabled={imcTypesLoading}
									/>
								</div>
							) : null}
							<div className="flex min-w-0 flex-col gap-1.5">
								<span className={DESKTOP_TYPOGRAPHY.caption}>
									{t('amkaView.imcFocusLabel')}
								</span>
								<MarketingCabinetSelect
									className="w-full min-w-0"
									size="compact"
									aria-label={t('amkaView.imcFocusLabel')}
									value={imcFocus}
									options={imcFocusSelectOptions}
									onChange={(v) => onImcFocusChange(v as AmkaImcFocus)}
								/>
							</div>
						</div>
						{runMode === 'auto' ? (
							<p
								className={cn(
									DESKTOP_TYPOGRAPHY.caption,
									'text-(--desktop-text-muted) wrap-pretty'
								)}
							>
								{t('amkaView.imcAutoTypeHint')}
							</p>
						) : null}
						<div className="flex max-w-xs flex-col gap-1.5">
							<span className={DESKTOP_TYPOGRAPHY.caption}>
								{t('amkaView.imcMaxWaitLabel')}
							</span>
							<DesktopAppInput
								type="number"
								min={10}
								max={3600}
								inputMode="numeric"
								placeholder="900"
								value={imcMaxWait}
								onChange={(e) => onImcMaxWaitChange(e.target.value)}
								className="w-full text-sm"
							/>
						</div>
						<div>
							<div
								className={cn(
									DESKTOP_TYPOGRAPHY.caption,
									'mb-2 text-(--desktop-text-secondary)'
								)}
							>
								{t('amkaView.sectionSubsetHint')}
							</div>
							<div
								className={cn(
									'grid max-h-48 grid-cols-1 gap-2 overflow-y-auto overscroll-contain rounded-(--desktop-radius) border border-(--desktop-border-subtle)/80 bg-(--desktop-surface-elevated)/35 p-2 sm:grid-cols-2'
								)}
							>
								{AMKA_START_SECTION_KEYS.map((key) => (
									<label
										key={key}
										className="flex cursor-pointer items-center gap-2.5 text-xs text-(--desktop-text-primary)"
									>
										<input
											type="checkbox"
											className={formCheckboxClass}
											checked={Boolean(sectionToggles[key])}
											onChange={() => onSectionToggle(key)}
										/>
										<span className="min-w-0 leading-snug">
											{key === 'dashboard'
												? t('amkaView.sectionDashboard')
												: t(`modules.${key}.title`)}
										</span>
									</label>
								))}
							</div>
						</div>
						<p
							className={cn(
								DESKTOP_TYPOGRAPHY.caption,
								'text-(--desktop-text-muted) wrap-pretty'
							)}
						>
							{t('amkaView.rateLimitHint')}
						</p>
					</div>
				</details>
			</div>
		</SectionPanel>
	);
}
