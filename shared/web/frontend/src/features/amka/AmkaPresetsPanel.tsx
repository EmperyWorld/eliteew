/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Preset templates and project-scoped AMKA presets editor embedded in the AMKA Builder.
 *
 * Invariants:
 * - Validation rules mirror server expectations for section keys and execution modes.
 *
 * Related:
 * - src/features/amka/AmkaBuilderView.tsx
 */
import {
	useAmkaPresetTemplates,
	useAmkaPresets,
	useCreateAmkaPreset,
	useDeleteAmkaPreset,
	useUpdateAmkaPreset,
} from '@/hooks/api/useAmka';
import { useNotifications } from '@/notifications';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
} from '@/pages/Desktop/components/DesktopAppChrome';
import type {
	AmkaPresetConfigV1,
	AmkaPresetExtraPlanTaskIn,
	AmkaPresetTemplate,
} from '@/services/amka/marketingCabinetAmkaBridge';
import {
	AMKA_ENSEMBLE_TEMPLATE_HINT_OPTIONS,
	AMKA_PLAN_EXECUTION_MODE_OPTIONS,
	AMKA_PRESET_ACTIONABLE_SECTION_KEYS,
	AMKA_PRESET_INSERT_ANCHOR_KEYS,
	extractApiErrorMessage,
	TEXTAREA_CLASS,
} from '@/services/amka/marketingCabinetAmkaBridge';
import { cn } from '@/utils/cn';
import {
	ArrowDownTrayIcon,
	ArrowUpTrayIcon,
	ClipboardDocumentIcon,
	ArrowPathIcon,
	PlusIcon,
	RectangleStackIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const DEFAULT_PRESET_CONFIG: AmkaPresetConfigV1 = {
	schema_version: 1,
	extra_plan_tasks: [],
};

/** Порядок чипов фильтра (остальные ключи из API — в конце по алфавиту). */
const TEMPLATE_CATEGORY_ORDER = [
	'basics',
	'imc',
	'autofill',
	'agent',
	'general',
] as const;

function formatConfigJson(config: AmkaPresetConfigV1): string {
	return JSON.stringify(
		{
			schema_version: config.schema_version ?? 1,
			extra_plan_tasks: config.extra_plan_tasks ?? [],
		},
		null,
		2
	);
}

function emptyTaskRow(): AmkaPresetExtraPlanTaskIn {
	return {
		insert_after_section_key: null,
		task: {
			section_key: 'jtbd',
			execution_mode: 'project_generate_async',
			title: '',
		},
	};
}

function validatePresetConfigLocal(
	cfg: AmkaPresetConfigV1,
	t: (k: string, o?: Record<string, unknown>) => string
): string | null {
	const tasks = cfg.extra_plan_tasks ?? [];
	const modes = new Set<string>([...AMKA_PLAN_EXECUTION_MODE_OPTIONS]);
	const sections = new Set<string>([...AMKA_PRESET_ACTIONABLE_SECTION_KEYS]);
	for (let i = 0; i < tasks.length; i++) {
		const spec = tasks[i];
		const tk = spec?.task;
		if (!tk || typeof tk !== 'object' || Array.isArray(tk)) {
			return t('amkaBuilder.presets.validationTaskObject', { index: i + 1 });
		}
		const rec = tk as Record<string, unknown>;
		const sk = String(rec.section_key ?? '').trim();
		if (!sk || !sections.has(sk)) {
			return t('amkaBuilder.presets.validationSection', {
				index: i + 1,
				section: sk || '—',
			});
		}
		const em = String(rec.execution_mode ?? '').trim();
		if (!em || !modes.has(em)) {
			return t('amkaBuilder.presets.validationMode', {
				index: i + 1,
				mode: em || '—',
			});
		}
		const title = String(rec.title ?? '').trim();
		if (!title) {
			return t('amkaBuilder.presets.validationTitle', { index: i + 1 });
		}
		if (em === 'imc_research' && sk !== 'imc') {
			return t('amkaBuilder.presets.validationImcSection', { index: i + 1 });
		}
	}
	return null;
}

export function AmkaPresetsPanel({
	projectId,
	embedded = false,
}: {
	projectId: string | null;
	/** Внутри визуальной оболочки билдера — без внешнего collapsible. */
	embedded?: boolean;
}) {
	const { t } = useTranslation('marketing');
	const { success, error } = useNotifications();
	const templatesQuery = useAmkaPresetTemplates();
	const presetsQuery = useAmkaPresets(projectId ?? undefined);
	const createMut = useCreateAmkaPreset(projectId ?? undefined);
	const updateMut = useUpdateAmkaPreset(projectId ?? undefined);
	const deleteMut = useDeleteAmkaPreset(projectId ?? undefined);

	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [isNew, setIsNew] = useState(false);
	const [displayName, setDisplayName] = useState('');
	const [slugInput, setSlugInput] = useState('');
	const [draftConfig, setDraftConfig] = useState<AmkaPresetConfigV1>(
		DEFAULT_PRESET_CONFIG
	);
	const [advancedJsonText, setAdvancedJsonText] = useState('');
	const [advancedJsonError, setAdvancedJsonError] = useState<string | null>(
		null
	);
	const [localValidationError, setLocalValidationError] = useState<
		string | null
	>(null);
	const [presetListQuery, setPresetListQuery] = useState('');
	const [templateCategoryFilter, setTemplateCategoryFilter] = useState<
		string | null
	>(null);
	const importConfigInputRef = useRef<HTMLInputElement>(null);

	const items = presetsQuery.data?.items ?? [];
	const allPresetTemplates = templatesQuery.data?.items ?? [];

	const templateFilterCategories = useMemo(() => {
		const orderSet = new Set<string>([...TEMPLATE_CATEGORY_ORDER]);
		const fromData = new Set(
			allPresetTemplates.map((x) => {
				const c = (x.category ?? 'general').trim();
				return c || 'general';
			})
		);
		const ordered: string[] = [];
		for (const c of TEMPLATE_CATEGORY_ORDER) {
			if (fromData.has(c)) ordered.push(c);
		}
		const rest = [...fromData]
			.filter((c) => !orderSet.has(c))
			.sort((a, b) => a.localeCompare(b));
		return [...ordered, ...rest];
	}, [allPresetTemplates]);

	const filteredPresetTemplates = useMemo(() => {
		if (!templateCategoryFilter) return allPresetTemplates;
		return allPresetTemplates.filter(
			(t) => (t.category?.trim() || 'general') === templateCategoryFilter
		);
	}, [allPresetTemplates, templateCategoryFilter]);

	const filteredPresetItems = useMemo(() => {
		const q = presetListQuery.trim().toLowerCase();
		let list = items;
		if (q) {
			list = items.filter(
				(p) =>
					p.display_name.toLowerCase().includes(q) ||
					p.slug.toLowerCase().includes(q)
			);
		}
		if (selectedId && !isNew) {
			const sel = items.find((p) => p.id === selectedId);
			if (sel && !list.some((p) => p.id === selectedId)) {
				return [sel, ...list];
			}
		}
		return list;
	}, [items, presetListQuery, selectedId, isNew]);

	const selected = useMemo(
		() => items.find((p) => p.id === selectedId) ?? null,
		[items, selectedId]
	);

	const syncFromSelected = useCallback(() => {
		if (!selected) return;
		setDisplayName(selected.display_name);
		setSlugInput('');
		setDraftConfig({
			schema_version: selected.config.schema_version ?? 1,
			extra_plan_tasks: [...(selected.config.extra_plan_tasks ?? [])],
		});
		setLocalValidationError(null);
		setAdvancedJsonError(null);
	}, [selected]);

	useEffect(() => {
		if (isNew) return;
		if (selectedId && selected) {
			syncFromSelected();
		}
	}, [isNew, selectedId, selected, syncFromSelected]);

	const busy =
		createMut.isPending || updateMut.isPending || deleteMut.isPending;

	const parseJsonToConfig = (rawText: string): AmkaPresetConfigV1 | null => {
		try {
			const raw = JSON.parse(rawText) as unknown;
			if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
				setAdvancedJsonError(t('amkaBuilder.presets.jsonObjectExpected'));
				return null;
			}
			const o = raw as Record<string, unknown>;
			const tasks = o.extra_plan_tasks;
			if (tasks !== undefined && !Array.isArray(tasks)) {
				setAdvancedJsonError(t('amkaBuilder.presets.extraTasksArray'));
				return null;
			}
			setAdvancedJsonError(null);
			return {
				schema_version:
					typeof o.schema_version === 'number' ? o.schema_version : 1,
				extra_plan_tasks: (tasks ??
					[]) as AmkaPresetConfigV1['extra_plan_tasks'],
			};
		} catch {
			setAdvancedJsonError(t('amkaBuilder.presets.jsonInvalid'));
			return null;
		}
	};

	const handleAdvancedToggle: React.DOMAttributes<HTMLDetailsElement>['onToggle'] =
		(e) => {
			const el = e.currentTarget;
			if (el.open) {
				setAdvancedJsonText(formatConfigJson(draftConfig));
				setAdvancedJsonError(null);
			}
		};

	const handleApplyAdvancedJson = () => {
		const parsed = parseJsonToConfig(advancedJsonText);
		if (!parsed) return;
		setDraftConfig(parsed);
		setLocalValidationError(null);
		success(t('amkaBuilder.presets.advancedApplied'));
	};

	const mergeTemplateIntoDraft = (tpl: AmkaPresetTemplate) => {
		setDraftConfig({
			schema_version: tpl.config.schema_version ?? 1,
			extra_plan_tasks: structuredClone(tpl.config.extra_plan_tasks ?? []),
		});
		setLocalValidationError(null);
		setAdvancedJsonError(null);
		setDisplayName((prev) => {
			const base = tpl.display_name.trim();
			if (!prev.trim()) return base;
			return prev;
		});
		success(
			t('amkaBuilder.presets.templateApplied', { name: tpl.display_name })
		);
	};

	const startNewFromTemplate = (tpl: AmkaPresetTemplate) => {
		setIsNew(true);
		setSelectedId(null);
		setSlugInput(tpl.slug);
		setDisplayName(tpl.display_name.trim());
		setDraftConfig({
			schema_version: tpl.config.schema_version ?? 1,
			extra_plan_tasks: structuredClone(tpl.config.extra_plan_tasks ?? []),
		});
		setLocalValidationError(null);
		setAdvancedJsonError(null);
		success(
			t('amkaBuilder.presets.templateNewDraftReady', {
				name: tpl.display_name,
			})
		);
	};

	const handleExportConfigJson = () => {
		const body = {
			schema_version: draftConfig.schema_version ?? 1,
			extra_plan_tasks: draftConfig.extra_plan_tasks ?? [],
		};
		const blob = new Blob([JSON.stringify(body, null, 2)], {
			type: 'application/json',
		});
		const slug =
			slugInput.trim() ||
			displayName
				.trim()
				.toLowerCase()
				.replace(/\s+/g, '-')
				.replace(/[^a-z0-9-]/g, '')
				.slice(0, 48) ||
			'draft';
		const url = URL.createObjectURL(blob);
		try {
			const a = document.createElement('a');
			a.href = url;
			a.download = `amka-preset-${slug}.json`;
			a.click();
		} finally {
			URL.revokeObjectURL(url);
		}
		success(t('amkaBuilder.presets.exportConfigSuccess'));
	};

	const handleImportConfigPick = () => {
		importConfigInputRef.current?.click();
	};

	const handleImportConfigFile: React.ChangeEventHandler<HTMLInputElement> = (
		e
	) => {
		const file = e.target.files?.[0];
		e.target.value = '';
		if (!file) return;
		void (async () => {
			try {
				const text = await file.text();
				const parsed = parseJsonToConfig(text);
				if (!parsed) {
					error(t('amkaBuilder.presets.importConfigInvalid'));
					return;
				}
				const v = validatePresetConfigLocal(parsed, t);
				if (v) {
					setLocalValidationError(v);
					error(v);
					return;
				}
				setLocalValidationError(null);
				setDraftConfig(parsed);
				success(t('amkaBuilder.presets.importConfigSuccess'));
			} catch {
				error(t('amkaBuilder.presets.importConfigReadError'));
			}
		})();
	};

	const handleDuplicateSelected = () => {
		if (!selected) return;
		setIsNew(true);
		setSelectedId(null);
		setSlugInput('');
		setDisplayName(
			t('amkaBuilder.presets.duplicateDisplayName', {
				name: selected.display_name,
			})
		);
		setDraftConfig({
			schema_version: selected.config.schema_version ?? 1,
			extra_plan_tasks: structuredClone(selected.config.extra_plan_tasks ?? []),
		});
		setLocalValidationError(null);
		setAdvancedJsonError(null);
		success(t('amkaBuilder.presets.duplicateDraftReady'));
	};

	const handleNew = () => {
		setIsNew(true);
		setSelectedId(null);
		setDisplayName('');
		setSlugInput('');
		setDraftConfig({
			schema_version: 1,
			extra_plan_tasks: [emptyTaskRow()],
		});
		setLocalValidationError(null);
		setAdvancedJsonError(null);
	};

	const updateRow = (
		index: number,
		patch: {
			insert_after_section_key?: string | null;
			section_key?: string;
			execution_mode?: string;
			title?: string;
			ensemble_template_hint?: string;
			ensemble_hero_ids?: string;
		}
	) => {
		setDraftConfig((prev) => {
			const list = [...(prev.extra_plan_tasks ?? [])];
			const cur = list[index];
			if (!cur) return prev;
			const prevTask =
				cur.task && typeof cur.task === 'object' && !Array.isArray(cur.task)
					? (cur.task as Record<string, unknown>)
					: {};
			const task: Record<string, unknown> = { ...prevTask };
			if (patch.section_key !== undefined) task.section_key = patch.section_key;
			if (patch.execution_mode !== undefined) {
				task.execution_mode = patch.execution_mode;
				if (patch.execution_mode !== 'desktop_ensemble') {
					delete task.ensemble_template_hint;
					delete task.ensemble_hero_ids;
				}
			}
			if (patch.title !== undefined) task.title = patch.title;
			if (patch.ensemble_template_hint !== undefined) {
				const hint = patch.ensemble_template_hint.trim();
				if (hint) task.ensemble_template_hint = hint;
				else delete task.ensemble_template_hint;
			}
			if (patch.ensemble_hero_ids !== undefined) {
				const ids = patch.ensemble_hero_ids
					.split(',')
					.map((part) => part.trim())
					.filter(Boolean)
					.slice(0, 3);
				if (ids.length) task.ensemble_hero_ids = ids;
				else delete task.ensemble_hero_ids;
			}
			list[index] = {
				insert_after_section_key:
					patch.insert_after_section_key !== undefined
						? patch.insert_after_section_key
						: cur.insert_after_section_key,
				task,
			};
			return { ...prev, schema_version: 1, extra_plan_tasks: list };
		});
	};

	const handleAddRow = () => {
		setDraftConfig((prev) => ({
			...prev,
			schema_version: 1,
			extra_plan_tasks: [...(prev.extra_plan_tasks ?? []), emptyTaskRow()],
		}));
	};

	const handleRemoveRow = (index: number) => {
		setDraftConfig((prev) => {
			const list = [...(prev.extra_plan_tasks ?? [])];
			list.splice(index, 1);
			return { ...prev, schema_version: 1, extra_plan_tasks: list };
		});
	};

	const handleSave = () => {
		if (!projectId) return;
		const name = displayName.trim();
		if (!name) {
			error(t('amkaBuilder.presets.nameRequired'));
			return;
		}
		const v = validatePresetConfigLocal(draftConfig, t);
		if (v) {
			setLocalValidationError(v);
			error(v);
			return;
		}
		setLocalValidationError(null);
		const cfg: AmkaPresetConfigV1 = {
			schema_version: draftConfig.schema_version ?? 1,
			extra_plan_tasks: draftConfig.extra_plan_tasks ?? [],
		};
		if (isNew) {
			const slug = slugInput.trim();
			createMut.mutate(
				{
					display_name: name,
					slug: slug || undefined,
					config: cfg,
				},
				{
					onSuccess: (res) => {
						setIsNew(false);
						setSelectedId(res.preset.id);
						success(t('amkaBuilder.presets.createSuccess'));
					},
					onError: (err) => {
						error(
							extractApiErrorMessage(err, t('amkaBuilder.presets.saveError'))
						);
					},
				}
			);
			return;
		}
		if (!selectedId) return;
		updateMut.mutate(
			{
				presetId: selectedId,
				body: { display_name: name, config: cfg },
			},
			{
				onSuccess: () => success(t('amkaBuilder.presets.updateSuccess')),
				onError: (err) => {
					error(
						extractApiErrorMessage(err, t('amkaBuilder.presets.saveError'))
					);
				},
			}
		);
	};

	const handleDelete = () => {
		if (!selectedId || isNew) return;
		if (
			typeof globalThis.confirm === 'function' &&
			!globalThis.confirm(t('amkaBuilder.presets.deleteConfirm'))
		) {
			return;
		}
		const id = selectedId;
		deleteMut.mutate(id, {
			onSuccess: () => {
				setSelectedId(null);
				setIsNew(false);
				setDisplayName('');
				setSlugInput('');
				setDraftConfig(DEFAULT_PRESET_CONFIG);
				success(t('amkaBuilder.presets.deleteSuccess'));
			},
			onError: (err) => {
				error(
					extractApiErrorMessage(err, t('amkaBuilder.presets.deleteError'))
				);
			},
		});
	};

	const taskRows = draftConfig.extra_plan_tasks ?? [];

	if (!projectId) {
		return (
			<p
				className={cn(
					'text-sm text-(--desktop-text-secondary)',
					!embedded &&
						'rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 px-3 py-2.5'
				)}
			>
				{t('amkaBuilder.presets.needProject')}
			</p>
		);
	}

	const inner = (
		<>
			<p
				className={cn(
					embedded
						? 'text-sm leading-relaxed text-(--desktop-text-secondary) wrap-pretty max-w-prose'
						: 'text-xs text-(--desktop-text-secondary)',
					embedded ? '' : 'mt-1'
				)}
			>
				{t('amkaBuilder.presets.sectionIntro')}
			</p>
			<div
				className={cn(
					'mt-4',
					embedded
						? 'rounded-lg bg-(--desktop-surface-soft)/40 p-3 sm:p-4'
						: 'rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-panel)/25 p-3'
				)}
			>
				<div
					className={cn(
						'flex items-center gap-2 font-semibold text-(--desktop-text-primary)',
						embedded ? 'text-sm' : 'text-xs'
					)}
				>
					<RectangleStackIcon
						className="size-4 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.85)]"
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					{t('amkaBuilder.presets.templatesTitle')}
				</div>
				<p
					className={cn(
						'mt-1.5 text-(--desktop-text-muted)',
						embedded ? 'text-xs leading-relaxed wrap-pretty' : 'text-[11px]'
					)}
				>
					{t('amkaBuilder.presets.templatesIntro')}
				</p>
				{!templatesQuery.isLoading &&
				!templatesQuery.isError &&
				allPresetTemplates.length > 0 ? (
					<fieldset
						className="mt-2 flex flex-wrap gap-1.5 border-0 p-0"
						aria-label={t('amkaBuilder.presets.templateCategoryFilterAria')}
					>
						<button
							type="button"
							onClick={() => setTemplateCategoryFilter(null)}
							disabled={busy}
							className={cn(
								'rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors',
								DESKTOP_CHROME_FOCUS_VISIBLE,
								templateCategoryFilter === null
									? 'border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[rgb(var(--desktop-accent-rgb)/0.14)] text-(--desktop-text-primary)'
									: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/50 text-(--desktop-text-secondary) hover:border-(--desktop-border-subtle)'
							)}
						>
							{t('amkaBuilder.presets.templateCategoryAll')}
						</button>
						{templateFilterCategories.map((cat) => (
							<button
								key={cat}
								type="button"
								onClick={() => setTemplateCategoryFilter(cat)}
								disabled={busy}
								className={cn(
									'rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors',
									DESKTOP_CHROME_FOCUS_VISIBLE,
									templateCategoryFilter === cat
										? 'border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[rgb(var(--desktop-accent-rgb)/0.14)] text-(--desktop-text-primary)'
										: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/50 text-(--desktop-text-secondary) hover:border-(--desktop-border-subtle)'
								)}
							>
								{t(`amkaBuilder.presets.templateCategory.${cat}`, {
									defaultValue: cat,
								})}
							</button>
						))}
					</fieldset>
				) : null}
				{templatesQuery.isLoading ? (
					<div className="mt-2 flex items-center gap-2 text-xs text-(--desktop-text-muted)">
						<ArrowPathIcon
							className="size-4 motion-safe:animate-spin motion-reduce:animate-none"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						{t('amkaBuilder.presets.templatesLoading')}
					</div>
				) : templatesQuery.isError ? (
					<p className="mt-2 text-xs text-red-300">
						{extractApiErrorMessage(
							templatesQuery.error,
							t('amkaBuilder.presets.templatesLoadError')
						)}
					</p>
				) : allPresetTemplates.length ===
					0 ? null : filteredPresetTemplates.length === 0 ? (
					<p className="mt-2 text-xs text-(--desktop-text-muted)">
						{t('amkaBuilder.presets.templateCategoryEmpty')}
					</p>
				) : (
					<div className="mt-2 flex flex-col gap-2">
						{filteredPresetTemplates.map((tpl) => {
							const cat = (tpl.category ?? 'general').trim() || 'general';
							return (
								<div
									key={tpl.slug}
									className="max-w-full rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/50 px-3 py-2 text-left text-xs"
								>
									<div className="flex flex-wrap items-center gap-2">
										<span className="block font-medium text-(--desktop-text-primary)">
											{tpl.display_name}
										</span>
										<span className="rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-panel)/40 px-1.5 py-0.5 text-[10px] text-(--desktop-text-muted)">
											{t(`amkaBuilder.presets.templateCategory.${cat}`, {
												defaultValue: cat,
											})}
										</span>
									</div>
									{tpl.description ? (
										<span className="mt-0.5 block text-[11px] leading-snug text-(--desktop-text-muted) wrap-pretty">
											{tpl.description}
										</span>
									) : null}
									<div className="mt-2 flex flex-wrap items-center gap-2">
										<DesktopAppButton
											type="button"
											variant="accent"
											size="sm"
											onClick={() => startNewFromTemplate(tpl)}
											disabled={busy}
										>
											{t('amkaBuilder.presets.templateNewDraftButton')}
										</DesktopAppButton>
										<button
											type="button"
											onClick={() => mergeTemplateIntoDraft(tpl)}
											disabled={busy}
											className={cn(
												'text-[11px] font-medium text-(--desktop-text-secondary) underline decoration-(--desktop-border-subtle) underline-offset-2 hover:text-(--desktop-text-primary)',
												DESKTOP_CHROME_FOCUS_VISIBLE
											)}
										>
											{t('amkaBuilder.presets.templateMergeIntoForm')}
										</button>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
			{presetsQuery.isError ? (
				<p className="mt-2 text-sm text-red-300">
					{extractApiErrorMessage(
						presetsQuery.error,
						t('amkaBuilder.presets.loadError')
					)}
				</p>
			) : null}
			<div className="mt-3 flex flex-wrap gap-2">
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					className="gap-1"
					onClick={handleNew}
					disabled={busy}
				>
					<PlusIcon
						className="h-4 w-4"
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					{t('amkaBuilder.presets.newButton')}
				</DesktopAppButton>
				{!isNew && selected ? (
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className="gap-1"
						onClick={handleDuplicateSelected}
						disabled={busy}
					>
						<ClipboardDocumentIcon
							className="h-4 w-4"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						{t('amkaBuilder.presets.duplicateButton')}
					</DesktopAppButton>
				) : null}
				{presetsQuery.isFetching ? (
					<ArrowPathIcon
						className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none text-(--desktop-text-muted)"
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
				) : null}
			</div>
			<label className="mt-2 flex flex-col gap-1">
				<span className="text-[11px] text-(--desktop-text-muted)">
					{t('amkaBuilder.presets.presetListSearchLabel')}
				</span>
				<input
					type="search"
					value={presetListQuery}
					onChange={(e) => setPresetListQuery(e.target.value)}
					placeholder={t('amkaBuilder.presets.presetListSearchPlaceholder')}
					className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1.5 text-xs text-(--desktop-text-primary)"
					autoComplete="off"
				/>
			</label>
			<div
				className={cn(
					'mt-2 flex max-h-44 flex-wrap content-start gap-2 overflow-y-auto p-2',
					embedded
						? 'rounded-lg bg-(--desktop-surface-panel)/25'
						: 'rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/30'
				)}
			>
				{items.length === 0 && !presetsQuery.isFetching ? (
					<p className="w-full px-1 py-2 text-xs text-(--desktop-text-muted)">
						{t('amkaBuilder.presets.emptyList')}
					</p>
				) : null}
				{items.length > 0 &&
				filteredPresetItems.length === 0 &&
				!presetsQuery.isFetching ? (
					<p className="w-full px-1 py-2 text-xs text-(--desktop-text-muted)">
						{t('amkaBuilder.presets.presetListNoMatches')}
					</p>
				) : null}
				{filteredPresetItems.map((p) => {
					const active = p.id === selectedId && !isNew;
					return (
						<button
							key={p.id}
							type="button"
							onClick={() => {
								setIsNew(false);
								setSelectedId(p.id);
							}}
							className={cn(
								'max-w-full rounded-xl border px-3 py-2 text-left text-xs transition-colors',
								DESKTOP_CHROME_FOCUS_VISIBLE,
								active
									? 'border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[rgb(var(--desktop-accent-rgb)/0.14)] text-(--desktop-text-primary)'
									: 'border-(--desktop-border-subtle) bg-(--desktop-surface-panel)/50 text-(--desktop-text-secondary) hover:border-(--desktop-border-subtle) hover:bg-(--desktop-surface-panel)'
							)}
						>
							<span className="block font-medium">
								{t('amkaBuilder.presets.listName', {
									name: p.display_name,
								})}
							</span>
							<span className="mt-0.5 block font-mono text-[10px] text-(--desktop-text-muted)">
								{p.slug}
							</span>
						</button>
					);
				})}
			</div>
			<div
				className={cn(
					'border-t border-(--desktop-border-subtle)',
					embedded ? 'mt-5 space-y-3 pt-4' : 'mt-3 space-y-2 pt-3'
				)}
			>
				<label className="flex flex-col gap-1">
					<span className="text-xs text-(--desktop-text-secondary)">
						{t('amkaBuilder.presets.displayName')}
					</span>
					<input
						type="text"
						value={displayName}
						onChange={(e) => setDisplayName(e.target.value)}
						className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1.5 text-sm text-(--desktop-text-primary)"
						autoComplete="off"
					/>
				</label>
				{isNew ? (
					<label className="flex flex-col gap-1">
						<span className="text-xs text-(--desktop-text-secondary)">
							{t('amkaBuilder.presets.slugOptional')}
						</span>
						<input
							type="text"
							value={slugInput}
							onChange={(e) => setSlugInput(e.target.value)}
							className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1.5 text-sm font-mono text-(--desktop-text-primary)"
							placeholder={t('amkaBuilder.presets.slugPlaceholder')}
							autoComplete="off"
						/>
					</label>
				) : null}

				<div className="space-y-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<span className="text-xs font-semibold text-(--desktop-text-secondary)">
							{t('amkaBuilder.presets.tasksTitle')}
						</span>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							onClick={handleAddRow}
							disabled={busy}
						>
							{t('amkaBuilder.presets.addTaskRow')}
						</DesktopAppButton>
					</div>
					{taskRows.length === 0 ? (
						<p className="text-xs text-(--desktop-text-muted)">
							{t('amkaBuilder.presets.tasksEmpty')}
						</p>
					) : (
						<ul className="space-y-3">
							{taskRows.map((row, index) => {
								const tk =
									row.task &&
									typeof row.task === 'object' &&
									!Array.isArray(row.task)
										? (row.task as Record<string, unknown>)
										: {};
								const sectionKey = String(tk.section_key ?? '');
								const execMode = String(tk.execution_mode ?? '');
								const title = String(tk.title ?? '');
								const ensembleTemplateHint = String(
									tk.ensemble_template_hint ?? ''
								);
								const ensembleHeroIds = Array.isArray(tk.ensemble_hero_ids)
									? tk.ensemble_hero_ids
											.filter(
												(id): id is string =>
													typeof id === 'string' && id.trim().length > 0
											)
											.join(', ')
									: '';
								const rowFingerprint = `${sectionKey}\0${execMode}\0${title}\0${JSON.stringify(row)}`;
								return (
									<li
										key={`preset-task-${rowFingerprint}`}
										className="overflow-hidden rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40"
									>
										<div className="flex items-center justify-between gap-2 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-panel)/35 px-3 py-2">
											<div className="flex min-w-0 items-center gap-2">
												<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--desktop-accent-rgb)/0.15)] text-xs font-bold text-(--desktop-text-primary)">
													{index + 1}
												</span>
												<span className="truncate text-xs font-medium text-(--desktop-text-secondary)">
													{t('amkaBuilder.presets.taskCardLabel', {
														n: index + 1,
													})}
												</span>
											</div>
											<DesktopAppButton
												type="button"
												variant="ghost"
												size="sm"
												className="shrink-0 gap-1 text-red-300 hover:text-red-200"
												onClick={() => handleRemoveRow(index)}
												disabled={busy}
												aria-label={t('amkaBuilder.presets.removeTaskRow')}
											>
												<TrashIcon
													className="h-4 w-4"
													strokeWidth={DESKTOP_LUCIDE.stroke}
													aria-hidden
												/>
											</DesktopAppButton>
										</div>
										<div className="grid gap-2 p-3 sm:grid-cols-2">
											<label className="flex flex-col gap-1">
												<span className="text-[11px] text-(--desktop-text-secondary)">
													{t('amkaBuilder.presets.insertAfterLabel')}
												</span>
												<select
													value={row.insert_after_section_key ?? ''}
													onChange={(e) =>
														updateRow(index, {
															insert_after_section_key:
																e.target.value === '' ? null : e.target.value,
														})
													}
													className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1.5 text-xs text-(--desktop-text-primary)"
												>
													<option value="">
														{t('amkaBuilder.presets.insertEnd')}
													</option>
													{AMKA_PRESET_INSERT_ANCHOR_KEYS.map((k) => (
														<option key={k} value={k}>
															{k}
														</option>
													))}
												</select>
											</label>
											<label className="flex flex-col gap-1">
												<span className="text-[11px] text-(--desktop-text-secondary)">
													{t('amkaBuilder.presets.sectionKeyLabel')}
												</span>
												<select
													value={sectionKey}
													onChange={(e) =>
														updateRow(index, {
															section_key: e.target.value,
														})
													}
													className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1.5 text-xs text-(--desktop-text-primary)"
												>
													{AMKA_PRESET_ACTIONABLE_SECTION_KEYS.map((k) => (
														<option key={k} value={k}>
															{k}
														</option>
													))}
												</select>
											</label>
											<label className="flex flex-col gap-1 sm:col-span-2">
												<span className="text-[11px] text-(--desktop-text-secondary)">
													{t('amkaBuilder.presets.executionModeLabel')}
												</span>
												<select
													value={execMode}
													onChange={(e) =>
														updateRow(index, {
															execution_mode: e.target.value,
														})
													}
													className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1.5 text-xs text-(--desktop-text-primary)"
												>
													{AMKA_PLAN_EXECUTION_MODE_OPTIONS.map((m) => (
														<option
															key={m}
															value={m}
															title={t(`amkaBuilder.presets.modeHint.${m}`)}
														>
															{m}
														</option>
													))}
												</select>
											</label>
											<label className="flex flex-col gap-1 sm:col-span-2">
												<span className="text-[11px] text-(--desktop-text-secondary)">
													{t('amkaBuilder.presets.taskTitleLabel')}
												</span>
												<input
													type="text"
													value={title}
													onChange={(e) =>
														updateRow(index, { title: e.target.value })
													}
													className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1.5 text-sm text-(--desktop-text-primary)"
													autoComplete="off"
												/>
											</label>
											{execMode === 'desktop_ensemble' ? (
												<>
													<label className="flex flex-col gap-1 sm:col-span-2">
														<span className="text-[11px] text-(--desktop-text-secondary)">
															{t(
																'amkaBuilder.presets.ensembleTemplateHintLabel'
															)}
														</span>
														<select
															value={ensembleTemplateHint}
															onChange={(e) =>
																updateRow(index, {
																	ensemble_template_hint: e.target.value,
																})
															}
															className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1.5 text-xs text-(--desktop-text-primary)"
														>
															<option value="">
																{t('amkaBuilder.presets.ensembleTemplateAuto')}
															</option>
															{AMKA_ENSEMBLE_TEMPLATE_HINT_OPTIONS.map(
																(hint) => (
																	<option key={hint} value={hint}>
																		{hint}
																	</option>
																)
															)}
														</select>
													</label>
													<label className="flex flex-col gap-1 sm:col-span-2">
														<span className="text-[11px] text-(--desktop-text-secondary)">
															{t('amkaBuilder.presets.ensembleHeroIdsLabel')}
														</span>
														<input
															type="text"
															value={ensembleHeroIds}
															onChange={(e) =>
																updateRow(index, {
																	ensemble_hero_ids: e.target.value,
																})
															}
															placeholder={t(
																'amkaBuilder.presets.ensembleHeroIdsPlaceholder'
															)}
															className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1.5 text-xs font-mono text-(--desktop-text-primary)"
															autoComplete="off"
														/>
													</label>
												</>
											) : null}
										</div>
									</li>
								);
							})}
						</ul>
					)}
				</div>

				<details
					className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-panel)/30 px-2 py-2"
					onToggle={handleAdvancedToggle}
				>
					<summary className="cursor-pointer text-xs font-semibold text-(--desktop-text-primary) [&::-webkit-details-marker]:hidden">
						{t('amkaBuilder.presets.advancedJson')}
					</summary>
					<p className="mt-1 text-[11px] text-(--desktop-text-muted)">
						{t('amkaBuilder.presets.advancedJsonHint')}
					</p>
					<textarea
						value={advancedJsonText}
						onChange={(e) => setAdvancedJsonText(e.target.value)}
						className={cn(TEXTAREA_CLASS, 'mt-2')}
						rows={10}
						spellCheck={false}
					/>
					{advancedJsonError ? (
						<p className="mt-1 text-xs text-red-300">{advancedJsonError}</p>
					) : null}
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className="mt-2"
						onClick={handleApplyAdvancedJson}
						disabled={busy}
					>
						{t('amkaBuilder.presets.applyJson')}
					</DesktopAppButton>
				</details>

				{localValidationError ? (
					<p className="text-xs text-red-300">{localValidationError}</p>
				) : null}

				<div className="flex flex-wrap items-center gap-2">
					<input
						ref={importConfigInputRef}
						type="file"
						accept="application/json,.json"
						className="sr-only"
						onChange={handleImportConfigFile}
					/>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className="gap-1"
						onClick={handleExportConfigJson}
						disabled={busy}
					>
						<ArrowDownTrayIcon
							className="h-4 w-4"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						{t('amkaBuilder.presets.exportConfigJson')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className="gap-1"
						onClick={handleImportConfigPick}
						disabled={busy}
					>
						<ArrowUpTrayIcon
							className="h-4 w-4"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						{t('amkaBuilder.presets.importConfigJson')}
					</DesktopAppButton>
				</div>

				<div className="flex flex-wrap gap-2">
					<DesktopAppButton
						type="button"
						variant="accent"
						size="sm"
						onClick={handleSave}
						disabled={busy}
					>
						{busy ? (
							<ArrowPathIcon
								className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						) : null}
						{isNew
							? t('amkaBuilder.presets.createAction')
							: t('amkaBuilder.presets.saveAction')}
					</DesktopAppButton>
					{!isNew && selectedId ? (
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							className="gap-1 text-red-300 hover:text-red-200"
							onClick={handleDelete}
							disabled={busy}
						>
							<TrashIcon
								className="h-4 w-4"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
							{t('amkaBuilder.presets.deleteAction')}
						</DesktopAppButton>
					) : null}
				</div>
				<p className="text-[11px] text-(--desktop-text-muted)">
					{t('amkaBuilder.presets.rightsHint')}
				</p>
			</div>
		</>
	);

	if (embedded) {
		return <div className="space-y-4">{inner}</div>;
	}

	return (
		<details
			className="rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) p-3"
			open
		>
			<summary className="cursor-pointer list-none font-medium text-(--desktop-text-primary) [&::-webkit-details-marker]:hidden">
				{t('amkaBuilder.presets.sectionTitle')}
			</summary>
			{inner}
		</details>
	);
}
