/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact EWA companion tool/quick-action strip for the composer chrome (priority row; catalog via parent).
 *
 * Invariants:
 * - User/plan-complete chips collapse to a single summary control; built-in tools open only via «Инструменты» catalog when ``onOpenToolsCatalog`` is set.
 * - «Мои цепочки» / «Новая цепочка» live in the inline row or desktop launcher rail when ``launcherPlacement`` is ``external``.
 * - Expanded/collapsed preference is persisted per ``principal_id`` in ``sessionStorage`` (UI only).
 *
 * Related:
 * - src/features/ewa/companionQuickPresetsCompactUi.ts
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */
import {
	ChevronDownIcon,
	PencilSquareIcon,
	PlusIcon,
	QueueListIcon,
	Squares2X2Icon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	COMPANION_QUICK_PRESET_SCROLL_ROW_CLASS,
	countPriorityQuickPresets,
	partitionQuickPresetsForCompactUi,
	readQuickPresetsPriorityExpanded,
	writeQuickPresetsPriorityExpanded,
} from '@/features/ewa/companionQuickPresetsCompactUi';
import {
	COMPANION_TOOL_CHIP_ACTION_CLASS,
	COMPANION_TOOL_CHIP_ICON_ACTION_CLASS,
	COMPANION_TOOL_CHIP_SURFACE_CLASS,
	getCompanionToolsPopoverSurfaceClassName,
} from '@/features/ewa/companionTools/companionToolsDesktopSurface';
import { companionQuickPresetVisual } from '@/features/ewa/companionQuickPresetIcons';
import {
	COMPANION_PILL_CHROME_CLASS,
	CompanionGlassCard,
	CompanionPillButton,
} from '@/features/ewa/companionPremiumPrimitives';
import {
	type CompanionQuickPresetChip,
	isCompanionQuickPresetDeletable,
	isCompanionQuickPresetRenamable,
} from '@/features/ewa/ewaCompanionQuickPresetsUi';
import { EwaIcon } from '@/features/ewa/ewaIcons/EwaIcon';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import { MOBILE_EMBEDDED_EWA_QUICK_ACTION_ICON_CLASS } from '@/components/mobileEmbedded/mobileEmbeddedLayoutTokens';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

export type EwaCompanionQuickPresetsStripProps = {
	principalId: string;
	presets: CompanionQuickPresetChip[];
	draft: string;
	pending: boolean;
	voiceInputBusy: boolean;
	savingQuickPreset: boolean;
	deletingQuickPresetId: string | null;
	renamingQuickPresetId: string | null;
	onApplyPreset: (preset: CompanionQuickPresetChip) => void;
	onSaveDraft: () => void | Promise<void>;
	onDeletePreset: (preset: CompanionQuickPresetChip) => void | Promise<void>;
	onRenamePreset: (preset: CompanionQuickPresetChip) => void | Promise<void>;
	onOpenWorkflowChains?: () => void;
	onCreateWorkflowChain?: () => void;
	onOpenToolsCatalog?: () => void;
	onOpenMyPhrases?: () => void;
	pinnedPresets?: CompanionQuickPresetChip[];
	companionDisplayName: string;
	variant?: 'panel' | 'inline';
	/** When ``external``, tools/phrases/chains launchers render in desktop rail — strip shows chips only. */
	launcherPlacement?: 'inline' | 'external';
	embeddedMobile?: boolean;
};

function QuickPresetChip({
	preset,
	disabled,
	deleting,
	deletingAny,
	renaming,
	renamingAny,
	onApply,
	onDelete,
	onRename,
}: {
	preset: CompanionQuickPresetChip;
	disabled: boolean;
	deleting: boolean;
	deletingAny: boolean;
	renaming: boolean;
	renamingAny: boolean;
	onApply: () => void;
	onDelete: () => void;
	onRename: () => void;
}) {
	const { t } = useTranslation('marketing');
	const visual = companionQuickPresetVisual(preset.id);
	const deletable = isCompanionQuickPresetDeletable(preset);
	const renamable = isCompanionQuickPresetRenamable(preset);

	return (
		<span
			className={cn(
				COMPANION_TOOL_CHIP_SURFACE_CLASS,
				deletable && 'border-(--desktop-border-subtle)',
				(disabled || deleting || renaming) && 'opacity-60'
			)}
		>
			<button
				type="button"
				disabled={disabled || deleting || renaming}
				className={cn(
					COMPANION_TOOL_CHIP_ACTION_CLASS,
					(disabled || deleting || renaming) && 'cursor-not-allowed'
				)}
				title={preset.label}
				aria-label={t('ewaCompanion.quickPresetChipAria', {
					label: preset.label,
				})}
				onClick={onApply}
			>
				<EwaIcon
					name={visual.icon}
					size="xs"
					tone={visual.tone}
					className="shrink-0 opacity-90"
				/>
				<span className="truncate">{preset.label}</span>
			</button>
			{renamable ? (
				<button
					type="button"
					disabled={disabled || deletingAny || renamingAny}
					className={cn(
						COMPANION_TOOL_CHIP_ICON_ACTION_CLASS,
						'hover:text-[rgb(var(--desktop-accent-rgb))]',
						(disabled || deletingAny || renamingAny) && 'cursor-not-allowed'
					)}
					aria-label={t('ewaCompanion.quickPresetRenameAria', {
						label: preset.label,
					})}
					title={t('ewaCompanion.quickPresetRename')}
					onClick={onRename}
				>
					<PencilSquareIcon className="size-3" aria-hidden />
				</button>
			) : null}
			{deletable ? (
				<button
					type="button"
					disabled={disabled || deletingAny}
					className={cn(
						COMPANION_TOOL_CHIP_ICON_ACTION_CLASS,
						'hover:bg-rose-500/10 hover:text-rose-200',
						(disabled || deletingAny) && 'cursor-not-allowed'
					)}
					aria-label={t('ewaCompanion.quickPresetDeleteAria', {
						label: preset.label,
					})}
					onClick={onDelete}
				>
					<XMarkIcon className="size-3" aria-hidden />
				</button>
			) : null}
		</span>
	);
}

export function EwaCompanionQuickPresetsStrip({
	principalId,
	presets,
	draft,
	pending,
	voiceInputBusy,
	savingQuickPreset,
	deletingQuickPresetId,
	renamingQuickPresetId,
	onApplyPreset,
	onSaveDraft,
	onDeletePreset,
	onRenamePreset,
	onOpenWorkflowChains,
	onCreateWorkflowChain,
	onOpenToolsCatalog,
	onOpenMyPhrases,
	pinnedPresets = [],
	companionDisplayName,
	variant = 'panel',
	launcherPlacement = 'inline',
	embeddedMobile = false,
}: EwaCompanionQuickPresetsStripProps) {
	const { t } = useTranslation('marketing');
	const shellFrame = useDesktopShellFrame();
	const toolsMenuSurfaceClassName =
		getCompanionToolsPopoverSurfaceClassName(shellFrame);
	const displayName = companionDisplayName.trim() || 'EWA';
	const compact = useMemo(
		() => partitionQuickPresetsForCompactUi(presets),
		[presets]
	);
	const priorityCounts = useMemo(
		() => countPriorityQuickPresets(compact.priority),
		[compact.priority]
	);
	const [priorityExpanded, setPriorityExpanded] = useState(() =>
		readQuickPresetsPriorityExpanded(principalId)
	);
	const [suggestedOpen, setSuggestedOpen] = useState(false);

	useEffect(() => {
		setPriorityExpanded(readQuickPresetsPriorityExpanded(principalId));
		setSuggestedOpen(false);
	}, [principalId]);

	useEffect(() => {
		writeQuickPresetsPriorityExpanded(principalId, priorityExpanded);
	}, [principalId, priorityExpanded]);

	const controlsDisabled = pending || voiceInputBusy;

	const prioritySummary = useMemo(() => {
		if (priorityCounts.user > 0 && priorityCounts.planComplete > 0) {
			return t('ewaCompanion.quickPresetsPriorityMixedSummary', {
				userCount: priorityCounts.user,
				planCount: priorityCounts.planComplete,
			});
		}
		if (priorityCounts.planComplete > 0) {
			return t('ewaCompanion.quickPresetsPriorityPlanSummary', {
				count: priorityCounts.planComplete,
			});
		}
		return t('ewaCompanion.quickPresetsPriorityUserSummary', {
			count: priorityCounts.user,
		});
	}, [priorityCounts, t]);

	const revealPriorityRow = useCallback(() => {
		setPriorityExpanded(true);
	}, []);

	const pinnedIds = useMemo(
		() => new Set(pinnedPresets.map((row) => row.id)),
		[pinnedPresets]
	);
	const unpinnedPriority = useMemo(
		() => compact.priority.filter((row) => !pinnedIds.has(row.id)),
		[compact.priority, pinnedIds]
	);

	const showWorkflowActions = Boolean(
		onOpenWorkflowChains || onCreateWorkflowChain
	);
	const showPinnedRow = pinnedPresets.length > 0;
	const showPresetContent =
		presets.length > 0 || draft.trim().length >= 8 || showPinnedRow;

	if (!showWorkflowActions && !showPresetContent && !onOpenToolsCatalog) {
		return null;
	}

	const inline = variant === 'inline';
	const launchersExternal = launcherPlacement === 'external';
	const Root = inline ? 'div' : CompanionGlassCard;
	const embeddedIconPillClass = embeddedMobile
		? MOBILE_EMBEDDED_EWA_QUICK_ACTION_ICON_CLASS
		: undefined;

	return (
		<Root
			data-testid="ewa-companion-quick-presets-strip"
			data-ewa-guide="quick-presets"
			className={cn(
				'flex min-w-0 flex-col gap-1',
				inline ? 'relative z-30 w-full min-w-0 flex-1' : 'shrink-0 px-2 py-1.5',
				embeddedMobile && 'gap-0.5'
			)}
		>
			<div
				className={cn(
					inline && !embeddedMobile
						? cn(COMPANION_QUICK_PRESET_SCROLL_ROW_CLASS, 'pb-0.5')
						: 'flex min-w-0 items-center gap-1.5',
					embeddedMobile &&
						'flex-nowrap gap-1 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden'
				)}
			>
				{unpinnedPriority.length > 0 ? (
					<CompanionPillButton
						disabled={controlsDisabled}
						aria-expanded={priorityExpanded}
						aria-controls="ewa-companion-quick-presets-priority"
						aria-label={prioritySummary}
						title={prioritySummary}
						onClick={() => setPriorityExpanded((open) => !open)}
						className={cn(embeddedIconPillClass, embeddedMobile && 'relative')}
					>
						<EwaIcon
							name="icon-bookmark"
							size="xs"
							tone="aura"
							className="shrink-0 opacity-90"
						/>
						{embeddedMobile ? (
							<span className="sr-only">{prioritySummary}</span>
						) : (
							<span className="max-w-36 truncate whitespace-nowrap">
								{prioritySummary}
							</span>
						)}
						<ChevronDownIcon
							className={cn(
								'size-3 shrink-0 text-(--companion-text-soft) transition-transform duration-200 ease-out',
								priorityExpanded && 'rotate-180'
							)}
							aria-hidden
						/>
					</CompanionPillButton>
				) : null}
				{draft.trim().length >= 8 ? (
					<CompanionPillButton
						disabled={controlsDisabled || savingQuickPreset}
						className={cn(
							'border-dashed hover:border-(--companion-divider)',
							embeddedIconPillClass
						)}
						title={t('ewaCompanion.quickPresetSave')}
						aria-label={t('ewaCompanion.quickPresetSaveAria')}
						onClick={() => {
							void (async () => {
								await onSaveDraft();
								revealPriorityRow();
							})();
						}}
					>
						<EwaIcon
							name="icon-bookmark"
							size="xs"
							tone="muted"
							className="shrink-0 opacity-90"
						/>
						<span className={embeddedMobile ? 'sr-only' : 'hidden sm:inline'}>
							{t('ewaCompanion.quickPresetSave')}
						</span>
					</CompanionPillButton>
				) : null}
				{!launchersExternal ? (
					<div
						className={cn(
							'flex shrink-0 items-center gap-1.5',
							inline && !embeddedMobile
								? 'ml-0'
								: embeddedMobile
									? 'ml-0'
									: 'ml-auto'
						)}
					>
						{onOpenToolsCatalog ? (
							<CompanionPillButton
								disabled={controlsDisabled}
								data-testid="ewa-companion-open-tools-catalog"
								onClick={onOpenToolsCatalog}
								className={cn(
									embeddedIconPillClass,
									embeddedMobile && 'relative'
								)}
								aria-label={
									compact.suggested.length > 0
										? t('ewaCompanion.toolsCatalog.openButtonWithCount', {
												count: compact.suggested.length,
											})
										: t('ewaCompanion.toolsCatalog.openButton')
								}
								title={t('ewaCompanion.toolsCatalog.openButton')}
							>
								<Squares2X2Icon
									className="size-3.5 shrink-0 opacity-90"
									aria-hidden
								/>
								{embeddedMobile ? (
									<span className="sr-only">
										{t('ewaCompanion.toolsCatalog.openButton')}
									</span>
								) : (
									<span className="max-w-28 truncate whitespace-nowrap">
										{t('ewaCompanion.toolsCatalog.openButton')}
									</span>
								)}
								{compact.suggested.length > 0 ? (
									<span
										className={cn(
											'rounded-full bg-(--companion-aura)/15 font-semibold text-(--companion-aura)',
											embeddedMobile
												? 'absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center text-[9px]'
												: 'px-1.5 text-[9px]'
										)}
									>
										{compact.suggested.length}
									</span>
								) : null}
							</CompanionPillButton>
						) : null}
						{onOpenMyPhrases ? (
							<CompanionPillButton
								disabled={controlsDisabled}
								data-testid="ewa-companion-open-my-phrases"
								onClick={onOpenMyPhrases}
								className={embeddedIconPillClass}
								aria-label={t('ewaCompanion.myPhrases.openButton')}
								title={t('ewaCompanion.myPhrases.openButton')}
							>
								<EwaIcon
									name="icon-bookmark"
									size="xs"
									tone="aura"
									className="shrink-0 opacity-90"
								/>
								{embeddedMobile ? (
									<span className="sr-only">
										{t('ewaCompanion.myPhrases.openButton')}
									</span>
								) : (
									<span className="max-w-28 truncate whitespace-nowrap">
										{t('ewaCompanion.myPhrases.openButton')}
									</span>
								)}
							</CompanionPillButton>
						) : null}
						{onOpenWorkflowChains ? (
							<CompanionPillButton
								disabled={controlsDisabled}
								data-testid="ewa-companion-open-workflow-chains"
								onClick={onOpenWorkflowChains}
								className={embeddedIconPillClass}
								aria-label={t('ewaCompanion.userWorkflowChainsLabel')}
								title={t('ewaCompanion.userWorkflowChainsLabel')}
							>
								<QueueListIcon
									className="size-3.5 shrink-0 opacity-90"
									aria-hidden
								/>
								{embeddedMobile ? (
									<span className="sr-only">
										{t('ewaCompanion.userWorkflowChainsLabel')}
									</span>
								) : (
									<span className="max-w-32 truncate whitespace-nowrap">
										{t('ewaCompanion.userWorkflowChainsLabel')}
									</span>
								)}
							</CompanionPillButton>
						) : null}
						{onCreateWorkflowChain ? (
							<CompanionPillButton
								className={cn(
									'border-dashed hover:border-(--companion-divider)',
									embeddedIconPillClass
								)}
								disabled={controlsDisabled}
								data-testid="ewa-companion-create-workflow-chain"
								onClick={onCreateWorkflowChain}
								aria-label={t('ewaCompanion.userWorkflowQuickNew')}
								title={t('ewaCompanion.userWorkflowQuickNew')}
							>
								<PlusIcon
									className="size-3.5 shrink-0 opacity-90"
									aria-hidden
								/>
								{embeddedMobile ? (
									<span className="sr-only">
										{t('ewaCompanion.userWorkflowQuickNew')}
									</span>
								) : (
									<span className="hidden sm:inline whitespace-nowrap">
										{t('ewaCompanion.userWorkflowQuickNew')}
									</span>
								)}
							</CompanionPillButton>
						) : null}
						{!onOpenToolsCatalog && compact.suggested.length > 0 ? (
							<div className="relative z-40 shrink-0">
								<button
									type="button"
									className={COMPANION_PILL_CHROME_CLASS}
									aria-expanded={suggestedOpen}
									aria-controls="ewa-companion-tools-popover"
									onClick={() => setSuggestedOpen((open) => !open)}
								>
									<EwaIcon
										name="icon-pulse"
										size="xs"
										tone="brand"
										className="shrink-0 opacity-90"
									/>
									<span className="whitespace-nowrap">
										{t('ewaCompanion.quickPresetsSuggestedToggle', {
											count: compact.suggested.length,
										})}
									</span>
									<ChevronDownIcon
										className={cn(
											'size-3 shrink-0 transition-transform duration-200',
											suggestedOpen && 'rotate-180'
										)}
										aria-hidden
									/>
								</button>
								{suggestedOpen ? (
									<div
										id="ewa-companion-tools-popover"
										className={cn(
											toolsMenuSurfaceClassName,
											'absolute bottom-full right-0 z-80 mb-1.5 w-[min(20rem,calc(100vw-2rem))]',
											'max-h-[min(40vh,14rem)] overflow-y-auto overscroll-y-contain p-2'
										)}
									>
										<p
											className={cn(
												DESKTOP_TYPOGRAPHY.caption,
												'mb-1.5 px-0.5 text-[10px] text-(--desktop-text-muted)'
											)}
										>
											{t('ewaCompanion.quickPresetsTitle', {
												count: compact.suggested.length,
												name: displayName,
											})}
										</p>
										<div className="flex flex-wrap gap-1.5">
											{compact.suggested.map((preset) => (
												<QuickPresetChip
													key={preset.id}
													preset={preset}
													disabled={controlsDisabled}
													deleting={deletingQuickPresetId === preset.id}
													deletingAny={Boolean(deletingQuickPresetId)}
													renaming={renamingQuickPresetId === preset.id}
													renamingAny={Boolean(renamingQuickPresetId)}
													onApply={() => {
														onApplyPreset(preset);
														setSuggestedOpen(false);
													}}
													onDelete={() => void onDeletePreset(preset)}
													onRename={() => void onRenamePreset(preset)}
												/>
											))}
										</div>
									</div>
								) : null}
							</div>
						) : null}
					</div>
				) : null}
			</div>
			{pinnedPresets.length > 0 ? (
				<fieldset
					className={cn(
						COMPANION_QUICK_PRESET_SCROLL_ROW_CLASS,
						'border-0 p-0 m-0 min-w-0 pb-0.5'
					)}
					data-testid="ewa-companion-pinned-tools"
				>
					<legend className="sr-only">
						{t('ewaCompanion.toolsCatalog.pinnedRowLegend')}
					</legend>
					{pinnedPresets.map((preset) => (
						<QuickPresetChip
							key={preset.id}
							preset={preset}
							disabled={controlsDisabled}
							deleting={deletingQuickPresetId === preset.id}
							deletingAny={Boolean(deletingQuickPresetId)}
							renaming={renamingQuickPresetId === preset.id}
							renamingAny={Boolean(renamingQuickPresetId)}
							onApply={() => onApplyPreset(preset)}
							onDelete={() => void onDeletePreset(preset)}
							onRename={() => void onRenamePreset(preset)}
						/>
					))}
				</fieldset>
			) : null}
			{unpinnedPriority.length > 0 ? (
				<div
					className={cn(
						'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
						priorityExpanded
							? 'grid-rows-[1fr] opacity-100'
							: 'grid-rows-[0fr] opacity-0'
					)}
				>
					<div
						id="ewa-companion-quick-presets-priority"
						className="overflow-hidden"
					>
						<div
							className={cn(toolsMenuSurfaceClassName, 'mt-0.5 px-2 py-1.5')}
						>
							<fieldset
								className={cn(
									COMPANION_QUICK_PRESET_SCROLL_ROW_CLASS,
									'border-0 p-0 m-0 min-w-0'
								)}
							>
								<legend className="sr-only">{prioritySummary}</legend>
								{unpinnedPriority.map((preset) => (
									<QuickPresetChip
										key={preset.id}
										preset={preset}
										disabled={controlsDisabled}
										deleting={deletingQuickPresetId === preset.id}
										deletingAny={Boolean(deletingQuickPresetId)}
										renaming={renamingQuickPresetId === preset.id}
										renamingAny={Boolean(renamingQuickPresetId)}
										onApply={() => onApplyPreset(preset)}
										onDelete={() => void onDeletePreset(preset)}
										onRename={() => void onRenamePreset(preset)}
									/>
								))}
							</fieldset>
						</div>
					</div>
				</div>
			) : null}
		</Root>
	);
}
