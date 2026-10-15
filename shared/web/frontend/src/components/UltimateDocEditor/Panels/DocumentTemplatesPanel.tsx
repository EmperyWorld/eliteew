import { useDesktopShellTheme } from '@/hooks/useDesktopShellTheme';
import { DESKTOP_OVERLAY } from '@/pages/Desktop/constants';
import { useNotifications } from '@/notifications';
import { cn } from '@/utils/cn';
import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useEffect, useId, useMemo, useState } from 'react';
import { getDocumentTemplateCardProseClassName } from '../utils/tiptapProseThemeClass';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppInput,
	DesktopAppModalFrame,
	DesktopAppPanel,
	DesktopAppStatusBadge,
	DesktopNativeSelect,
} from '../../../pages/Desktop/components/DesktopAppChrome';
import { useEmbeddedPortaledModalZIndex } from '../../../pages/Desktop/context/DesktopWindowPortalStackContext';
import {
	fetchDocEditorTemplates,
	preflightDocEditorTemplateApply,
} from '../api/docEditorTemplatesApi';
import { useEditorStoreShallow } from '../store/editorStoreContext';
import { selectDocumentTemplatesPanelSlice } from '../store/editorStoreSelectors';
import {
	AcademicCapIcon,
	BriefcaseIcon,
	ClockIcon,
	DocumentTextIcon,
	EyeIcon,
	ListBulletIcon,
	MagnifyingGlassIcon,
	PencilIcon,
	PlusIcon,
	ScaleIcon,
	Squares2X2Icon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

import type {
	DocumentTemplate,
	DocumentTemplatesPanelProps,
} from '../types/editor.types';

const TEMPLATE_CATEGORY_ITEMS = [
	{ id: 'business' as const, icon: BriefcaseIcon },
	{ id: 'academic' as const, icon: AcademicCapIcon },
	{ id: 'creative' as const, icon: PencilIcon },
	{ id: 'legal' as const, icon: ScaleIcon },
] as const;

/** Category chrome uses shell accent + surfaces (theme-safe). */
const CATEGORY_STYLES: Record<
	string,
	{ iconWrap: string; icon: string; pillActive: string }
> = {
	business: {
		iconWrap:
			'border-[rgb(var(--desktop-accent-rgb))]/30 bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_14%,var(--desktop-surface-soft))]',
		icon: 'text-[rgb(var(--desktop-accent-rgb))]',
		pillActive:
			'border-[rgb(var(--desktop-accent-rgb))]/35 bg-(--desktop-surface-accent) text-(--desktop-text-primary)',
	},
	academic: {
		iconWrap:
			'border-[rgb(var(--desktop-accent-rgb))]/28 bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_10%,var(--desktop-surface-soft))]',
		icon: 'text-[var(--desktop-text-secondary)]',
		pillActive:
			'border-[rgb(var(--desktop-accent-rgb))]/35 bg-(--desktop-surface-accent) text-(--desktop-text-primary)',
	},
	creative: {
		iconWrap:
			'border-[var(--desktop-border-strong)] bg-[var(--desktop-surface-panel)]',
		icon: 'text-[var(--desktop-text-secondary)]',
		pillActive:
			'border-[rgb(var(--desktop-accent-rgb))]/35 bg-(--desktop-surface-accent) text-(--desktop-text-primary)',
	},
	legal: {
		iconWrap:
			'border-[var(--desktop-border-subtle)] bg-[color-mix(in_srgb,var(--desktop-surface-panel)_88%,rgb(var(--desktop-accent-rgb))_12%)]',
		icon: 'text-(--desktop-text-primary)',
		pillActive:
			'border-[rgb(var(--desktop-accent-rgb))]/35 bg-(--desktop-surface-accent) text-(--desktop-text-primary)',
	},
};

const DIFFICULTY_CLASSNAMES: Record<DocumentTemplate['difficulty'], string> = {
	easy: 'border-[rgb(var(--desktop-accent-rgb))]/30 bg-[color-mix(in_srgb,var(--desktop-surface-accent)_55%,transparent)] text-(--desktop-text-primary)',
	medium:
		'border-[var(--desktop-border-strong)] bg-[var(--desktop-surface-soft)] text-[var(--desktop-text-secondary)]',
	hard: 'border-red-400/35 bg-red-500/15 text-red-200',
};

type SortMode = 'name' | 'category' | 'difficulty';
type ViewMode = 'grid' | 'list';

const getCategoryStyle = (categoryId: string) => {
	return (
		CATEGORY_STYLES[categoryId] ?? {
			iconWrap: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft)',
			icon: 'text-(--desktop-text-secondary)',
			pillActive:
				'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-primary)',
		}
	);
};

const getDifficultyOrder = (
	difficulty: DocumentTemplate['difficulty']
): number => {
	switch (difficulty) {
		case 'easy':
			return 1;
		case 'medium':
			return 2;
		case 'hard':
			return 3;
		default:
			return 99;
	}
};

async function convertMarkdownToHtml(value: string): Promise<string> {
	const source = value.trim();
	if (!source) {
		return '<p></p>';
	}

	const { renderMarkdownToHTML } = await import(
		'../utils/renderMarkdownToHtml'
	);
	return renderMarkdownToHTML(source);
}

const TemplatePreviewModal: React.FC<{
	template: DocumentTemplate | null;
	onClose: () => void;
}> = ({ template, onClose }) => {
	const { t } = useTranslation('docEditorPanels');
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const shellTheme = useDesktopShellTheme();
	const templatePreviewProseClass = useMemo(
		() => getDocumentTemplateCardProseClassName(shellTheme),
		[shellTheme]
	);
	const [previewHtml, setPreviewHtml] = useState('');
	const [previewState, setPreviewState] = useState<
		'loading' | 'ready' | 'error'
	>('loading');

	const difficultyMeta = useMemo(() => {
		if (!template) {
			return {
				label: '',
				className: DIFFICULTY_CLASSNAMES.easy,
			};
		}
		const d = template.difficulty;
		return {
			label: t(`panels.templates.difficulty.${d}`),
			className: DIFFICULTY_CLASSNAMES[d],
		};
	}, [t, template]);

	const categoryLabel = useMemo(() => {
		if (!template) {
			return '';
		}
		const id = template.category;
		if (
			id === 'business' ||
			id === 'academic' ||
			id === 'creative' ||
			id === 'legal'
		) {
			return t(`panels.templates.categories.${id}`);
		}
		return t('panels.templates.categoryFallback');
	}, [t, template]);

	useEffect(() => {
		if (!template) {
			setPreviewHtml('');
			setPreviewState('loading');
			return;
		}

		let isCancelled = false;
		setPreviewState('loading');
		setPreviewHtml('');

		void convertMarkdownToHtml(template.content)
			.then((html) => {
				if (!isCancelled) {
					setPreviewHtml(html);
					setPreviewState('ready');
				}
			})
			.catch(() => {
				if (!isCancelled) {
					setPreviewState('error');
				}
			});

		return () => {
			isCancelled = true;
		};
	}, [template]);

	if (!template) {
		return null;
	}

	return (
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				className={cn(
					'fixed inset-0 flex items-center justify-center p-4',
					DESKTOP_OVERLAY.backdrop
				)}
				style={{ zIndex: embeddedModalZ.backdrop }}
				onClick={onClose}
			>
				<motion.div
					initial={{ opacity: 0, scale: 0.96, y: 16 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					exit={{ opacity: 0, scale: 0.96, y: 16 }}
					transition={{ duration: 0.18 }}
					className="w-full max-w-6xl"
					style={{ zIndex: embeddedModalZ.content }}
					onClick={(event) => event.stopPropagation()}
				>
					<DesktopAppModalFrame
						onClose={onClose}
						title={
							<div className="flex min-w-0 items-center gap-3">
								<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--desktop-accent-rgb))]/30 bg-(--desktop-surface-accent) text-white shadow-(--desktop-shadow-panel)">
									<EyeIcon width={18} height={18} />
								</span>
								<div className="min-w-0">
									<div className="truncate text-base font-semibold text-(--desktop-text-primary)">
										{template.name}
									</div>
									<div className="truncate text-xs text-(--desktop-text-dim)">
										{template.description}
									</div>
								</div>
							</div>
						}
						className="max-h-[88vh] max-w-none"
					>
						<div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
							<div className="border-b border-(--desktop-border-subtle) bg-(--desktop-surface-app) p-6 lg:border-b-0 lg:border-r">
								<div className="mb-4 flex flex-wrap items-center gap-2">
									<DesktopAppStatusBadge className={difficultyMeta.className}>
										{difficultyMeta.label}
									</DesktopAppStatusBadge>
									<DesktopAppStatusBadge className="border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-secondary)">
										{categoryLabel}
									</DesktopAppStatusBadge>
									<DesktopAppStatusBadge className="border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-secondary)">
										{template.estimatedTime}
									</DesktopAppStatusBadge>
								</div>
								<DesktopAppPanel className="min-h-[520px] overflow-y-auto border-(--desktop-border-subtle) bg-(--desktop-surface-panel) p-6">
									{previewState === 'loading' ? (
										<div className={templatePreviewProseClass}>
											<p className="not-prose">
												<em>{t('panels.templates.preview.loading')}</em>
											</p>
										</div>
									) : previewState === 'error' ? (
										<div className={templatePreviewProseClass}>
											<p className="not-prose">
												<em>{t('panels.templates.preview.error')}</em>
											</p>
										</div>
									) : (
										<div
											className={templatePreviewProseClass}
											// biome-ignore lint/security/noDangerouslySetInnerHtml: Template preview HTML from curated markdown source
											dangerouslySetInnerHTML={{ __html: previewHtml }}
										/>
									)}
								</DesktopAppPanel>
							</div>
							<div className="flex min-h-0 flex-col bg-(--desktop-surface-panel)">
								<div className="border-b border-(--desktop-border-subtle) px-6 py-4">
									<h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-(--desktop-text-dim)">
										{t('panels.templates.previewModal.sourceTitle')}
									</h3>
									<p className="mt-1 text-sm text-(--desktop-text-muted) antialiased">
										{t('panels.templates.previewModal.sourceHint')}
									</p>
								</div>
								<div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
									<pre className="whitespace-pre-wrap rounded-2xl border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_84%,transparent)] p-4 font-mono text-[12px] font-medium leading-6 text-(--desktop-text-primary)">
										{template.content}
									</pre>
								</div>
							</div>
						</div>
					</DesktopAppModalFrame>
				</motion.div>
			</motion.div>
		</AnimatePresence>
	);
};

export const DocumentTemplatesPanel: React.FC<DocumentTemplatesPanelProps> = ({
	isOpen,
	onClose,
	onCreateFromTemplate,
}) => {
	const { t, i18n } = useTranslation('docEditorPanels');
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const difficultySelectId = useId();
	const { createDocument } = useEditorStoreShallow(
		selectDocumentTemplatesPanelSlice
	);
	const { success, error: showError } = useNotifications();

	const sortLocale = i18n.language?.toLowerCase().startsWith('ru')
		? 'ru'
		: 'en';

	const difficultyMetaByKey = useMemo(
		() => ({
			easy: {
				label: t('panels.templates.difficulty.easy'),
				className: DIFFICULTY_CLASSNAMES.easy,
			},
			medium: {
				label: t('panels.templates.difficulty.medium'),
				className: DIFFICULTY_CLASSNAMES.medium,
			},
			hard: {
				label: t('panels.templates.difficulty.hard'),
				className: DIFFICULTY_CLASSNAMES.hard,
			},
		}),
		[t]
	);

	const templateCategories = useMemo(
		() =>
			TEMPLATE_CATEGORY_ITEMS.map((c) => ({
				...c,
				name: t(`panels.templates.categories.${c.id}`),
			})),
		[t]
	);

	const getCategoryMeta = (categoryId: string) => {
		return templateCategories.find((category) => category.id === categoryId);
	};

	const [selectedCategory, setSelectedCategory] = useState('all');
	const [searchQuery, setSearchQuery] = useState('');
	const [sortBy, setSortBy] = useState<SortMode>('name');
	const [viewMode, setViewMode] = useState<ViewMode>('grid');
	const [previewTemplate, setPreviewTemplate] =
		useState<DocumentTemplate | null>(null);
	const [applyMode, setApplyMode] = useState<'replace' | 'insert' | 'append'>(
		'replace'
	);
	const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
	const [templatesLoading, setTemplatesLoading] = useState(false);
	const [templatesError, setTemplatesError] = useState<string | null>(null);
	const [templatesSource, setTemplatesSource] = useState<'db' | 'fallback'>(
		'db'
	);
	const [difficultyFilter, setDifficultyFilter] = useState<
		'all' | DocumentTemplate['difficulty']
	>('all');

	const filteredTemplates = useMemo(() => {
		const query = searchQuery.trim().toLowerCase();
		let templatesList = [...templates];

		if (selectedCategory !== 'all') {
			templatesList = templatesList.filter(
				(template) => template.category === selectedCategory
			);
		}

		if (difficultyFilter !== 'all') {
			templatesList = templatesList.filter(
				(template) => template.difficulty === difficultyFilter
			);
		}

		if (query) {
			templatesList = templatesList.filter(
				(template) =>
					template.name.toLowerCase().includes(query) ||
					template.description.toLowerCase().includes(query) ||
					template.tags.some((tag) => tag.toLowerCase().includes(query)) ||
					template.content.toLowerCase().includes(query)
			);
		}

		templatesList.sort((left, right) => {
			switch (sortBy) {
				case 'category':
					return left.category.localeCompare(right.category, sortLocale);
				case 'difficulty':
					return (
						getDifficultyOrder(left.difficulty) -
						getDifficultyOrder(right.difficulty)
					);
				default:
					return left.name.localeCompare(right.name, sortLocale);
			}
		});

		return templatesList;
	}, [
		searchQuery,
		selectedCategory,
		sortBy,
		templates,
		difficultyFilter,
		sortLocale,
	]);

	useEffect(() => {
		let isCancelled = false;
		setTemplatesLoading(true);
		setTemplatesError(null);
		void fetchDocEditorTemplates()
			.then((result) => {
				if (isCancelled) {
					return;
				}
				setTemplates(Array.isArray(result.templates) ? result.templates : []);
				setTemplatesSource(result.source);
				if (result.degradedReason) {
					setTemplatesError(
						t('panels.templates.errors.degradedCatalog', {
							reason: result.degradedReason,
						})
					);
				}
			})
			.catch(() => {
				if (!isCancelled) {
					setTemplates([]);
					setTemplatesError(t('panels.templates.errors.loadCatalog'));
				}
			})
			.finally(() => {
				if (!isCancelled) {
					setTemplatesLoading(false);
				}
			});
		return () => {
			isCancelled = true;
		};
	}, [t]);

	const handleCreateFromTemplate = async (
		template: DocumentTemplate
	): Promise<void> => {
		try {
			const preflight = await preflightDocEditorTemplateApply(
				template.content,
				applyMode
			);
			if (preflight.warnings.length > 0) {
				success(
					t('panels.templates.toasts.preflightTitle'),
					preflight.warnings.join(' • ')
				);
			}
			if (!preflight.safeToApply) {
				showError(
					t('panels.templates.errors.notAppliedTitle'),
					t('panels.templates.errors.notAppliedPreflight')
				);
				return;
			}
			const modeLabel = t(`panels.templates.applyModeLabels.${applyMode}`);
			if (onCreateFromTemplate) {
				await onCreateFromTemplate(template, applyMode);
				success(
					t('panels.templates.toasts.appliedTitle'),
					t('panels.templates.toasts.appliedBody', {
						name: template.name,
						mode: modeLabel,
					})
				);
			} else {
				const htmlContent = await convertMarkdownToHtml(template.content);
				await createDocument(template.name, htmlContent);
				success(
					t('panels.templates.toasts.appliedTitle'),
					t('panels.templates.toasts.createdBody', { name: template.name })
				);
			}
			onClose();
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error
					? error.message
					: t('panels.templates.errors.createFailed');
			showError(t('panels.templates.errors.notAppliedTitle'), errorMessage);
		}
	};

	if (!isOpen) {
		return null;
	}

	return (
		<>
			<motion.div
				initial={{ opacity: 0, scale: 0.95 }}
				animate={{ opacity: 1, scale: 1 }}
				exit={{ opacity: 0, scale: 0.95 }}
				transition={{ duration: 0.2 }}
				className="fixed inset-4 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) shadow-(--desktop-shadow-panel)"
				style={{ zIndex: embeddedModalZ.content }}
			>
				<div className="flex shrink-0 items-center justify-between border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-5 py-4">
					<div className="flex min-w-0 items-center gap-3">
						<div className="rounded-xl border border-[rgb(var(--desktop-accent-rgb))]/30 bg-(--desktop-surface-accent) p-2.5">
							<DocumentTextIcon
								className="text-[rgb(var(--desktop-accent-rgb))]"
								width={20}
								height={20}
							/>
						</div>
						<div className="min-w-0">
							<h2 className="truncate text-lg font-semibold text-(--desktop-text-primary)">
								{t('panels.templates.header.title')}
							</h2>
							<p className="text-sm text-(--desktop-text-muted) antialiased">
								{t('panels.templates.header.subtitle')}
								{templatesSource === 'fallback'
									? t('panels.templates.header.subtitleFallbackSuffix')
									: null}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						{templatesError ? (
							<DesktopAppStatusBadge
								className="border-amber-400/30 bg-amber-500/10 text-amber-200"
								title={templatesError}
							>
								{t('panels.templates.limitedMode')}
							</DesktopAppStatusBadge>
						) : null}
						<DesktopAppButton
							onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
							variant="ghost"
							size="icon"
							title={
								viewMode === 'grid'
									? t('panels.templates.viewList')
									: t('panels.templates.viewGrid')
							}
						>
							{viewMode === 'grid' ? (
								<ListBulletIcon width={16} height={16} />
							) : (
								<Squares2X2Icon width={16} height={16} />
							)}
						</DesktopAppButton>
						<DesktopAppButton
							onClick={onClose}
							variant="ghost"
							size="icon"
							title={t('panels.templates.close')}
						>
							<XMarkIcon width={16} height={16} />
						</DesktopAppButton>
					</div>
				</div>

				<div className="shrink-0 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-5 py-4">
					<div className="flex flex-wrap items-center gap-3">
						<div className="relative min-w-[260px] flex-1">
							<MagnifyingGlassIcon
								width={16}
								height={16}
								className="absolute left-3 top-1/2 -translate-y-1/2 text-(--desktop-text-dim)"
							/>
							<DesktopAppInput
								type="text"
								placeholder={t('panels.templates.searchPlaceholder')}
								value={searchQuery}
								onChange={(event) => setSearchQuery(event.target.value)}
								className="w-full pl-10"
							/>
						</div>

						<DesktopNativeSelect
							value={applyMode}
							onChange={(event) => {
								const value = event.target.value;
								if (
									value === 'replace' ||
									value === 'insert' ||
									value === 'append'
								) {
									setApplyMode(value);
								}
							}}
							className="text-sm"
							aria-label={t('panels.templates.applyModeAria')}
						>
							<option
								value="replace"
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							>
								{t('panels.templates.applyOptionReplace')}
							</option>
							<option
								value="insert"
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							>
								{t('panels.templates.applyOptionInsert')}
							</option>
							<option
								value="append"
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							>
								{t('panels.templates.applyOptionAppend')}
							</option>
						</DesktopNativeSelect>

						<DesktopNativeSelect
							value={selectedCategory}
							onChange={(event) => setSelectedCategory(event.target.value)}
							className="text-sm"
							aria-label={t('panels.templates.categoryAria')}
						>
							<option
								value="all"
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							>
								{t('panels.templates.allCategories')}
							</option>
							{templateCategories.map((category) => (
								<option
									key={category.id}
									value={category.id}
									className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
								>
									{category.name}
								</option>
							))}
						</DesktopNativeSelect>

						<DesktopNativeSelect
							value={sortBy}
							onChange={(event) => {
								const value = event.target.value;
								if (
									value === 'name' ||
									value === 'category' ||
									value === 'difficulty'
								) {
									setSortBy(value);
								}
							}}
							className="text-sm"
							aria-label={t('panels.templates.sortAria')}
						>
							<option
								value="name"
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							>
								{t('panels.templates.sortName')}
							</option>
							<option
								value="category"
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							>
								{t('panels.templates.sortCategory')}
							</option>
							<option
								value="difficulty"
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							>
								{t('panels.templates.sortDifficulty')}
							</option>
						</DesktopNativeSelect>

						<label
							className="flex min-w-[200px] flex-col gap-1 text-xs text-(--desktop-text-muted)"
							htmlFor={difficultySelectId}
						>
							<span>{t('panels.templates.filterDifficulty')}</span>
							<DesktopNativeSelect
								id={difficultySelectId}
								value={difficultyFilter}
								onChange={(event) => {
									const v = event.target.value;
									if (
										v === 'all' ||
										v === 'easy' ||
										v === 'medium' ||
										v === 'hard'
									) {
										setDifficultyFilter(v);
									}
								}}
								className="text-sm"
								aria-label={t('panels.templates.filterDifficulty')}
							>
								<option
									value="all"
									className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
								>
									{t('panels.templates.difficultyAll')}
								</option>
								<option
									value="easy"
									className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
								>
									{difficultyMetaByKey.easy.label}
								</option>
								<option
									value="medium"
									className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
								>
									{difficultyMetaByKey.medium.label}
								</option>
								<option
									value="hard"
									className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
								>
									{difficultyMetaByKey.hard.label}
								</option>
							</DesktopNativeSelect>
						</label>
					</div>

					<div className="mt-3 flex flex-wrap gap-2">
						<button
							type="button"
							onClick={() => setSelectedCategory('all')}
							className={`rounded-full border px-3 py-1 text-sm transition-colors ${
								selectedCategory === 'all'
									? 'border-[rgb(var(--desktop-accent-rgb))]/35 bg-(--desktop-surface-accent) text-(--desktop-text-primary)'
									: 'border-(--desktop-border-subtle) bg-(--desktop-surface-app) text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft-hover)'
							}`}
						>
							{t('panels.templates.pillAll', { count: templates.length })}
						</button>
						{templateCategories.map((category) => {
							const Icon = category.icon;
							const count = templates.filter(
								(template) => template.category === category.id
							).length;
							const categoryStyle = getCategoryStyle(category.id);

							return (
								<button
									key={category.id}
									type="button"
									onClick={() => setSelectedCategory(category.id)}
									className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors ${
										selectedCategory === category.id
											? categoryStyle.pillActive
											: 'border-(--desktop-border-subtle) bg-(--desktop-surface-app) text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft-hover)'
									}`}
								>
									<Icon width={14} height={14} />
									{category.name} ({count})
								</button>
							);
						})}
					</div>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto bg-(--desktop-surface-app) p-5">
					{templatesLoading && templates.length === 0 ? (
						<DesktopAppPanel className="border-dashed bg-transparent">
							<DesktopAppEmptyState
								icon={
									<DocumentTextIcon
										width={46}
										height={46}
										className="mx-auto animate-pulse text-(--desktop-text-dim)"
									/>
								}
								title={t('panels.templates.loadingTitle')}
								description={t('panels.templates.loadingDesc')}
								className="py-12"
							/>
						</DesktopAppPanel>
					) : filteredTemplates.length === 0 ? (
						<DesktopAppPanel className="border-dashed bg-transparent">
							<DesktopAppEmptyState
								icon={
									<DocumentTextIcon
										width={46}
										height={46}
										className="mx-auto text-(--desktop-text-dim)"
									/>
								}
								title={t('panels.templates.emptyTitle')}
								description={t('panels.templates.emptyDesc')}
								className="py-12"
							/>
						</DesktopAppPanel>
					) : (
						<div
							className={cn(
								viewMode === 'grid'
									? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
									: 'space-y-3'
							)}
						>
							{filteredTemplates.map((template) => {
								const Icon =
									getCategoryMeta(template.category)?.icon ?? DocumentTextIcon;
								const categoryMeta = getCategoryMeta(template.category);
								const categoryStyle = getCategoryStyle(template.category);
								const difficultyMeta = difficultyMetaByKey[template.difficulty];

								return (
									<motion.div
										key={template.id}
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										className={`overflow-hidden rounded-2xl border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) transition-all hover:border-[rgb(var(--desktop-accent-rgb))]/28 hover:shadow-(--desktop-shadow-soft) ${
											viewMode === 'list' ? 'flex items-stretch' : ''
										}`}
									>
										<div className={viewMode === 'list' ? 'flex-1 p-4' : 'p-4'}>
											{viewMode === 'grid' ? (
												<div
													className="relative mb-3 aspect-4/3 w-full overflow-hidden rounded-xl border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_88%,transparent)]"
													aria-hidden
												>
													<div className="absolute inset-0 bg-linear-to-br from-[rgb(var(--desktop-accent-rgb))]/12 via-transparent to-transparent" />
													<div className="absolute right-2 top-2 z-1">
														<DesktopAppStatusBadge
															className={difficultyMeta.className}
														>
															{difficultyMeta.label}
														</DesktopAppStatusBadge>
													</div>
													<div className="flex h-full flex-col justify-between p-3">
														<div
															className={cn(
																'size-10 rounded-lg border p-2',
																categoryStyle.iconWrap
															)}
														>
															<Icon
																className={categoryStyle.icon}
																width={18}
																height={18}
															/>
														</div>
														<p className="line-clamp-3 pr-1 text-left text-[11px] leading-snug text-(--desktop-text-muted)">
															{template.description}
														</p>
													</div>
												</div>
											) : (
												<div className="mb-3 flex items-start justify-between gap-3">
													<div
														className={cn(
															'rounded-xl border p-2.5',
															categoryStyle.iconWrap
														)}
													>
														<Icon
															className={categoryStyle.icon}
															width={18}
															height={18}
														/>
													</div>
													<DesktopAppStatusBadge
														className={difficultyMeta.className}
													>
														{difficultyMeta.label}
													</DesktopAppStatusBadge>
												</div>
											)}

											<h3 className="mb-2 truncate text-base font-semibold text-(--desktop-text-primary)">
												{template.name}
											</h3>

											<p
												className={cn(
													'mb-3 text-sm leading-6 text-(--desktop-text-muted)',
													viewMode === 'list'
														? 'line-clamp-3'
														: 'line-clamp-2 sm:line-clamp-3'
												)}
											>
												{template.description}
											</p>

											<div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-(--desktop-text-dim)">
												<span className="inline-flex items-center gap-1.5 rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1">
													<ClockIcon width={12} height={12} />
													{template.estimatedTime}
												</span>
												<span className="inline-flex items-center gap-1.5 rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1">
													{categoryMeta?.name ??
														t('panels.templates.categoryFallback')}
												</span>
												<span className="inline-flex items-center gap-1.5 rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1">
													{template.lifecycleState ?? 'published'}
												</span>
												<span className="inline-flex items-center gap-1.5 rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1">
													r{template.releaseVersion ?? 1} •{' '}
													{template.releaseChannel ?? 'stable'}
												</span>
											</div>

											<div className="flex flex-wrap gap-1.5">
												{template.tags.slice(0, 4).map((tag) => (
													<DesktopAppStatusBadge
														key={tag}
														className="border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-secondary)"
													>
														{tag}
													</DesktopAppStatusBadge>
												))}
											</div>
										</div>

										<div
											className={`flex gap-2 border-(--desktop-border-subtle) p-4 ${viewMode === 'list' ? 'flex-col border-l' : 'border-t'}`}
										>
											<DesktopAppButton
												onClick={() => setPreviewTemplate(template)}
												variant="neutral"
												className="gap-2"
											>
												<EyeIcon width={14} height={14} />
												{t('panels.templates.preview')}
											</DesktopAppButton>
											<DesktopAppButton
												onClick={() => void handleCreateFromTemplate(template)}
												variant="accent"
												className="gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-panel)"
											>
												<PlusIcon width={14} height={14} />
												{t('panels.templates.use')}
											</DesktopAppButton>
										</div>
									</motion.div>
								);
							})}
						</div>
					)}
				</div>

				<div className="shrink-0 border-t border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-5 py-4">
					<div className="flex flex-wrap items-center justify-between gap-3 text-sm text-(--desktop-text-muted) antialiased">
						<span>
							{t('panels.templates.footerFound', {
								count: filteredTemplates.length,
							})}
						</span>
						<span>
							{templatesLoading
								? t('panels.templates.footerLoading')
								: templatesError
									? templatesError
									: templatesSource === 'fallback'
										? t('panels.templates.footerFallbackCatalog')
										: t('panels.templates.footerPreflightOk')}
						</span>
					</div>
				</div>
			</motion.div>

			<TemplatePreviewModal
				template={previewTemplate}
				onClose={() => setPreviewTemplate(null)}
			/>
		</>
	);
};

export default DocumentTemplatesPanel;
