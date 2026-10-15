/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Marketing Cabinet AI Studio — tool presets, streaming assist, run history panel.
 *
 * Invariants:
 * - Project scope uses `projectsForCompany` from page foundation (no duplicate listProjects).
 * - Document list prefers shared MarketingContentSource when project/company match.
 *
 * Related:
 * - hooks/useMarketingContentSource.tsx
 */
import { contentApi } from '@/services/contentApi';
import { VirtualVariableList } from '@/components/shared/VirtualList';
import { cn } from '@/utils/cn';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	ArrowPathIcon,
	ArrowUpTrayIcon,
	ChevronDownIcon,
	ClockIcon,
	CpuChipIcon,
	DocumentTextIcon,
	FolderOpenIcon,
	SparklesIcon,
	WrenchIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppErrorState,
	DesktopAppSurface,
} from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { EmptyProjectState } from '../components/EmptyProjectState';
import { LoadingGrid } from '../components/LoadingGrid';
import { SectionPanel } from '../components/SectionPanel';
import { MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD } from '../constants';
import {
	marketingCabinetAiRunsPanelQueryOptions,
	marketingCabinetAiRunsProjectInvalidationQueryKey,
	marketingCabinetContentInvalidationQueryKey,
	marketingCabinetContentQueryOptions,
	marketingCabinetProjectDashboardInvalidationQueryKey,
} from '../marketingCabinetQueryOptions';
import { useMarketingShellClasses } from '../hooks/useMarketingShellClasses';
import { useMarketingContentSource } from '../hooks/useMarketingContentSource';
import {
	formatDateTime,
	localizeMarketingAiTool,
	localizeStatus,
} from '../locales';
import {
	MARKETING_LONG_TIMEOUT_MS,
	marketingCabinetApi,
	streamMarketingAiAssist,
	type MarketingAiRun,
	type MarketingAiStreamEvent,
	type MarketingProject,
	type MarketingToolAgentResponse,
} from '../marketingCabinetApi';
import {
	marketingWebSearchApiFields,
	readStoredMarketingWebSearchQuality,
} from '../marketingWebSearchQuality';
import { extractApiErrorMessage } from '../utils';

const AI_STUDIO_TOOL_KEYS = [
	'overview_gap_analysis',
	'next_best_action',
	'segment_suggestion',
	'campaign_draft',
	'competitor_watch',
] as const;

type AiStudioToolKey = (typeof AI_STUDIO_TOOL_KEYS)[number];

interface ToolPreset {
	tool_key: AiStudioToolKey;
	title: string;
	description: string;
	placeholder: string;
}

export function AIStudioView({
	selectedProjectId,
	selectedCompanyId,
	projectsForCompany = [],
	focusedEntityId = null,
}: {
	selectedProjectId: string | null;
	selectedCompanyId: string | null;
	/** Foundation projects list — avoids duplicate `listProjects` without limit. */
	projectsForCompany?: MarketingProject[];
	focusedEntityId?: string | null;
}) {
	const { t } = useTranslation('marketing');
	const { nestedInset, insetIconTile, contentPanel } =
		useMarketingShellClasses();
	const queryClient = useQueryClient();
	const sharedContentSource = useMarketingContentSource();
	const canUseSharedContentSource = Boolean(
		sharedContentSource &&
			sharedContentSource.selectedProjectId === selectedProjectId &&
			sharedContentSource.selectedCompanyId === selectedCompanyId
	);

	const toolPresets: ToolPreset[] = useMemo(
		() =>
			AI_STUDIO_TOOL_KEYS.map((tool_key) => ({
				tool_key,
				title: t(`aiStudioView.tools.${tool_key}.title`),
				description: t(`aiStudioView.tools.${tool_key}.description`),
				placeholder: t(`aiStudioView.tools.${tool_key}.placeholder`),
			})),
		[t]
	);

	const [activeToolKey, setActiveToolKey] = useState<AiStudioToolKey>(
		AI_STUDIO_TOOL_KEYS[0]
	);
	const activePreset = useMemo(
		() =>
			toolPresets.find((item) => item.tool_key === activeToolKey) ??
			toolPresets[0],
		[toolPresets, activeToolKey]
	);

	const [prompt, setPrompt] = useState('');
	useLayoutEffect(() => {
		setPrompt(activePreset.placeholder);
	}, [activePreset.placeholder]);

	const [streamOutput, setStreamOutput] = useState('');
	const [streamError, setStreamError] = useState<string | null>(null);
	const [isStreaming, setIsStreaming] = useState(false);
	const [lastRun, setLastRun] = useState<MarketingAiRun | null>(null);
	const [toolAgentLoading, setToolAgentLoading] = useState(false);
	const [toolAgentError, setToolAgentError] = useState<string | null>(null);
	const [toolAgentOutput, setToolAgentOutput] = useState<string | null>(null);
	const [toolAgentMeta, setToolAgentMeta] = useState<Pick<
		MarketingToolAgentResponse,
		'router_model' | 'planned_tools' | 'tool_traces'
	> | null>(null);
	const [localSelectedContentId, setLocalSelectedContentId] = useState<
		string | null
	>(null);
	const [uploadProgress, setUploadProgress] = useState(0);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const selectedContentId = canUseSharedContentSource
		? (sharedContentSource?.selectedContentId ?? null)
		: localSelectedContentId;
	const setSelectedContentId = canUseSharedContentSource
		? (sharedContentSource?.setSelectedContentId ?? (() => {}))
		: setLocalSelectedContentId;

	const aiRunsQuery = useQuery({
		...marketingCabinetAiRunsPanelQueryOptions(
			selectedProjectId,
			selectedCompanyId
		),
		enabled: Boolean(selectedProjectId || selectedCompanyId),
	});

	const projectInContentScope = useMemo(() => {
		if (!selectedProjectId || !projectsForCompany.length) {
			return null;
		}
		return projectsForCompany.find((p) => p.id === selectedProjectId) ?? null;
	}, [projectsForCompany, selectedProjectId]);

	const localContentQuery = useQuery({
		...marketingCabinetContentQueryOptions(
			selectedProjectId,
			selectedCompanyId
		),
		enabled:
			!canUseSharedContentSource &&
			Boolean(selectedProjectId) &&
			(!selectedCompanyId ||
				Boolean(
					projectInContentScope &&
						projectInContentScope.company_id === selectedCompanyId
				)),
	});
	const contentQuery =
		canUseSharedContentSource && sharedContentSource
			? sharedContentSource.contentQuery
			: localContentQuery;
	const contentItems = contentQuery.data?.items ?? [];

	useEffect(() => {
		if (!selectedProjectId) {
			setSelectedContentId(null);
			return;
		}
		if (!selectedContentId && contentItems.length > 0) {
			setSelectedContentId(contentItems[0]?.id ?? null);
			return;
		}
		if (
			selectedContentId &&
			contentItems.length > 0 &&
			!contentItems.some((item) => item.id === selectedContentId)
		) {
			setSelectedContentId(contentItems[0]?.id ?? null);
		}
	}, [
		contentItems,
		selectedContentId,
		selectedProjectId,
		setSelectedContentId,
	]);

	const uploadMutation = useMutation({
		mutationFn: async (file: File) =>
			contentApi.uploadContent(
				file,
				{
					name: file.name,
					...(selectedProjectId ? { project_id: selectedProjectId } : {}),
					...(selectedCompanyId ? { company_id: selectedCompanyId } : {}),
				},
				{ onProgress: setUploadProgress, timeout: MARKETING_LONG_TIMEOUT_MS }
			),
		onSuccess: async (uploaded) => {
			setSelectedContentId(uploaded.id);
			await queryClient.invalidateQueries({
				queryKey: marketingCabinetContentInvalidationQueryKey(
					selectedProjectId,
					selectedCompanyId
				),
			});
			await contentQuery.refetch();
		},
		onError: (error) => {
			setStreamError(
				extractApiErrorMessage(error, t('aiStudioView.uploadError'))
			);
		},
	});

	useEffect(() => {
		if (!focusedEntityId) return;
		const element = document.querySelector(
			`[data-marketing-entity-id="${focusedEntityId}"]`
		);
		if (element instanceof HTMLElement) {
			element.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}, [focusedEntityId]);

	async function runStream() {
		if (!selectedProjectId && !selectedCompanyId) return;
		setIsStreaming(true);
		setStreamOutput('');
		setStreamError(null);
		setLastRun(null);
		try {
			await streamMarketingAiAssist(
				{
					tool_key: activeToolKey,
					prompt: prompt.trim() || activePreset.placeholder,
					project_id: selectedProjectId,
					company_id: selectedProjectId ? null : selectedCompanyId,
					content_id: selectedContentId,
					idempotency_key: crypto.randomUUID(),
					...marketingWebSearchApiFields(readStoredMarketingWebSearchQuality()),
				},
				(event: MarketingAiStreamEvent) => {
					if (event.event === 'result') {
						setStreamOutput(String(event.data.text || ''));
						setLastRun((event.data.run as MarketingAiRun | undefined) ?? null);
						if (selectedProjectId) {
							void queryClient.invalidateQueries({
								queryKey:
									marketingCabinetAiRunsProjectInvalidationQueryKey(
										selectedProjectId
									),
							});
							void queryClient.invalidateQueries({
								queryKey:
									marketingCabinetProjectDashboardInvalidationQueryKey(
										selectedProjectId
									),
							});
						}
						return;
					}
					if (event.event === 'error') {
						setStreamError(
							String(event.data.error || t('aiStudioView.streamUnknownError'))
						);
					}
				}
			);
		} catch (error) {
			setStreamError(
				error instanceof Error ? error.message : t('aiStudioView.streamFailed')
			);
		} finally {
			setIsStreaming(false);
		}
	}

	async function runToolAgent() {
		if (!selectedProjectId) return;
		setToolAgentLoading(true);
		setToolAgentError(null);
		setToolAgentOutput(null);
		setToolAgentMeta(null);
		try {
			const res = await marketingCabinetApi.runToolAgent({
				prompt: prompt.trim() || activePreset.placeholder,
				project_id: selectedProjectId,
				source: 'ai_studio',
			});
			setToolAgentOutput(res.output_text);
			setToolAgentMeta({
				router_model: res.router_model,
				planned_tools: res.planned_tools,
				tool_traces: res.tool_traces,
			});
			void queryClient.invalidateQueries({
				queryKey:
					marketingCabinetAiRunsProjectInvalidationQueryKey(selectedProjectId),
			});
		} catch (error) {
			setToolAgentError(
				extractApiErrorMessage(error, t('aiStudioView.toolAgentError'))
			);
		} finally {
			setToolAgentLoading(false);
		}
	}

	if (!selectedProjectId && !selectedCompanyId) {
		return (
			<EmptyProjectState
				title={t('aiStudioView.emptyTitle')}
				description={t('aiStudioView.emptyDescription')}
			/>
		);
	}

	const aiRunHistoryItems = aiRunsQuery.data?.items ?? [];

	function renderAiRunHistoryCard(run: MarketingAiRun) {
		return (
			<DesktopAppSurface
				variant="soft"
				data-marketing-entity-id={run.id}
				className={cn(
					nestedInset,
					'space-y-3 p-4 transition-shadow',
					focusedEntityId === run.id &&
						'ring-2 ring-(--mc-accent-50) ring-offset-2 ring-offset-(--desktop-surface-app)'
				)}
			>
				<div className="flex items-start justify-between gap-3 border-b border-(--desktop-border-subtle)/50 pb-2">
					<div className="min-w-0 text-sm font-semibold tracking-tight text-(--desktop-text-primary)">
						{localizeMarketingAiTool(run.tool_key)}
					</div>
					<div
						className={cn(
							nestedInset,
							'shrink-0 rounded-md px-2 py-0.5 font-medium',
							DESKTOP_TYPOGRAPHY.caption
						)}
					>
						{localizeStatus(run.status)}
					</div>
				</div>
				{run.prompt_excerpt ? (
					<div
						className={cn(
							DESKTOP_TYPOGRAPHY.meta,
							'leading-relaxed wrap-anywhere'
						)}
					>
						{run.prompt_excerpt}
					</div>
				) : null}
				{run.result_excerpt ? (
					<div className="line-clamp-4 text-[13px] leading-[1.6] text-(--desktop-text-secondary) wrap-anywhere">
						{run.result_excerpt}
					</div>
				) : null}
				<div className={cn(DESKTOP_TYPOGRAPHY.caption, 'tabular-nums')}>
					{formatDateTime(run.started_at)}
				</div>
			</DesktopAppSurface>
		);
	}

	const selectedContent =
		contentItems.find((item) => item.id === selectedContentId) ?? null;

	async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		if (!file) return;
		await uploadMutation.mutateAsync(file);
		if (fileInputRef.current) fileInputRef.current.value = '';
	}

	const uploadPct = Math.round(Math.min(100, Math.max(0, uploadProgress)));

	return (
		<div className="grid gap-4 lg:gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] xl:items-start">
			<SectionPanel
				title={t('aiStudioView.panelTitle')}
				description={t('aiStudioView.panelDescription')}
				className="min-h-0 xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto"
			>
				<div className="grid gap-2">
					{toolPresets.map((preset) => (
						<button
							key={preset.tool_key}
							type="button"
							className={cn(
								'px-3.5 py-3.5 text-left transition-[color,background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--mc-accent-40) focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-panel)',
								activeToolKey === preset.tool_key
									? 'rounded-(--desktop-radius) border border-(--mc-accent-50) bg-(--desktop-surface-accent) text-white shadow-sm'
									: cn(
											nestedInset,
											'text-(--desktop-text-secondary) hover:border-[rgb(var(--desktop-accent-rgb)/0.28)]'
										)
							)}
							onClick={() => {
								setActiveToolKey(preset.tool_key);
								setPrompt(preset.placeholder);
							}}
						>
							<div className="mb-1 text-sm font-semibold tracking-tight">
								{preset.title}
							</div>
							<div
								className={cn(
									DESKTOP_TYPOGRAPHY.meta,
									'leading-relaxed',
									activeToolKey === preset.tool_key && 'text-white/90'
								)}
							>
								{preset.description}
							</div>
						</button>
					))}
				</div>
				<div className="mt-5 space-y-4 border-t border-(--desktop-border-subtle)/50 pt-5">
					<div className="space-y-2">
						<div className="text-xs font-medium text-(--desktop-text-secondary)">
							{t('aiStudioView.promptSectionTitle')}
						</div>
						<p
							className={cn(
								DESKTOP_APP_STYLE_CONTRACT.helperText,
								'leading-relaxed'
							)}
						>
							{t('aiStudioView.promptSectionHint')}
						</p>
					</div>
					<textarea
						className={cn(
							nestedInset,
							'min-h-[200px] w-full resize-y px-3.5 py-3 text-sm leading-relaxed text-(--desktop-text-primary) placeholder:text-(--desktop-text-muted) outline-none transition-[border-color,box-shadow] focus:border-[rgb(var(--desktop-accent-rgb)/0.35)] focus:ring-2 focus:ring-(--mc-accent-25)'
						)}
						value={prompt}
						onChange={(event) => setPrompt(event.target.value)}
						placeholder={activePreset.placeholder}
						aria-label={activePreset.title}
					/>
					<div className="flex flex-wrap items-center justify-end gap-2">
						<DesktopAppButton
							type="button"
							variant="accent"
							onClick={() => void runStream()}
							disabled={isStreaming || uploadMutation.isPending}
							aria-busy={isStreaming}
						>
							{isStreaming ? (
								<ArrowPathIcon
									className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							) : (
								<SparklesIcon
									className="h-4 w-4"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							)}
							{t('aiStudioView.runAi')}
						</DesktopAppButton>
					</div>
				</div>
				<div className="mt-5 space-y-4 border-t border-(--desktop-border-subtle)/50 pt-5">
					<input
						ref={fileInputRef}
						type="file"
						className="hidden"
						onChange={handleFileChange}
					/>
					<DesktopAppSurface variant="soft" className="space-y-3 p-4">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<div>
								<div className="text-sm font-medium text-(--desktop-text-primary)">
									{t('aiStudioView.contextDocTitle')}
								</div>
								<div
									className={cn(DESKTOP_APP_STYLE_CONTRACT.helperText, 'mt-1')}
								>
									{t('aiStudioView.contextDocHint')}
								</div>
							</div>
							{selectedProjectId ? (
								<div className="flex items-center gap-2">
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => fileInputRef.current?.click()}
									>
										<ArrowUpTrayIcon
											className="h-4 w-4"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
										{t('aiStudioView.upload')}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => void contentQuery.refetch()}
									>
										<ArrowPathIcon
											className="h-4 w-4"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
										{t('toolbar.refresh')}
									</DesktopAppButton>
								</div>
							) : null}
						</div>

						{selectedProjectId ? (
							uploadMutation.isPending ? (
								<div className={cn(nestedInset, 'space-y-3 px-3 py-3')}>
									<div className="flex items-center justify-between gap-3">
										<div className="flex min-w-0 items-center gap-2 text-xs font-medium text-(--desktop-text-secondary)">
											<ArrowPathIcon
												className="h-3.5 w-3.5 shrink-0 motion-safe:animate-spin motion-reduce:animate-none text-(--mc-accent)"
												strokeWidth={DESKTOP_LUCIDE.stroke}
												aria-hidden
											/>
											<span className="truncate">
												{t('aiStudioView.uploading')}
											</span>
										</div>
										<span
											className={cn(
												DESKTOP_TYPOGRAPHY.caption,
												'tabular-nums font-medium'
											)}
										>
											{uploadPct}%
										</span>
									</div>
									<div
										className="h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)]"
										role="progressbar"
										aria-valuenow={uploadPct}
										aria-valuemin={0}
										aria-valuemax={100}
										aria-label={t('aiStudioView.uploading')}
									>
										<div
											className="h-full rounded-full bg-(--mc-accent) transition-[width] duration-200 ease-out"
											style={{ width: `${Math.max(2, uploadProgress)}%` }}
										/>
									</div>
								</div>
							) : contentQuery.isLoading ? (
								<LoadingGrid />
							) : contentQuery.isError ? (
								<DesktopAppErrorState
									message={extractApiErrorMessage(
										contentQuery.error,
										t('aiStudioView.loadDocumentsError')
									)}
									onAction={() => void contentQuery.refetch()}
								/>
							) : contentItems.length > 0 ? (
								<div className="grid gap-2">
									{contentItems.slice(0, 6).map((item) => {
										const active = item.id === selectedContentId;
										return (
											<button
												key={item.id}
												type="button"
												onClick={() => setSelectedContentId(item.id)}
												className={cn(
													'p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--mc-accent-40)',
													active
														? 'rounded-(--desktop-radius) border border-(--mc-accent-45) bg-(--desktop-surface-accent)'
														: cn(
																nestedInset,
																'hover:border-[rgb(var(--desktop-accent-rgb)/0.32)]'
															)
												)}
											>
												<div className="flex items-start justify-between gap-3">
													<div className="min-w-0 flex-1">
														<div className="truncate text-sm font-medium text-(--desktop-text-primary)">
															{item.name}
														</div>
														<div
															className={cn(DESKTOP_TYPOGRAPHY.meta, 'mt-1')}
														>
															{item.content_type ||
																t('aiStudioView.contentTypeDocument')}{' '}
															·{' '}
															{item.processing_status ||
																t('aiStudioView.processingUnknown')}
														</div>
													</div>
													<DocumentTextIcon
														className="mt-0.5 h-4 w-4 shrink-0 text-(--desktop-text-muted)"
														strokeWidth={DESKTOP_LUCIDE.stroke}
													/>
												</div>
											</button>
										);
									})}
								</div>
							) : (
								<DesktopAppEmptyState
									className="rounded-(--desktop-radius) border border-dashed border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 py-10"
									icon={
										<FolderOpenIcon
											className="h-8 w-8 text-(--desktop-text-muted)"
											strokeWidth={1.25}
											aria-hidden
										/>
									}
									title={t('aiStudioView.emptyDocumentsTitle')}
									description={t('aiStudioView.emptyDocumentsDescription')}
								/>
							)
						) : (
							<div className={DESKTOP_TYPOGRAPHY.meta}>
								{t('aiStudioView.companyModeDocHint')}
							</div>
						)}

						{selectedContent ? (
							<div
								className={cn(
									nestedInset,
									'border-(--mc-accent-25)/50 px-3 py-2.5'
								)}
							>
								<div
									className={cn(
										DESKTOP_APP_STYLE_CONTRACT.sectionLabel,
										'font-medium'
									)}
								>
									{t('aiStudioView.selectedDocumentLabel')}
								</div>
								<div className="mt-1 truncate text-sm font-medium leading-snug text-(--desktop-text-primary)">
									{selectedContent.name}
								</div>
							</div>
						) : null}
					</DesktopAppSurface>

					{selectedProjectId ? (
						<DesktopAppSurface variant="soft" className="space-y-3 p-4">
							<div className="flex items-start gap-3">
								<div className={cn(insetIconTile, 'text-(--mc-accent)')}>
									<WrenchIcon
										className="h-4 w-4"
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
								</div>
								<div className="min-w-0 flex-1 space-y-1">
									<div className="text-sm font-medium text-(--desktop-text-primary)">
										{t('aiStudioView.toolAgentTitle')}
									</div>
									<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'leading-relaxed')}>
										{t('aiStudioView.toolAgentDescription')}
									</p>
								</div>
							</div>
							<div className="flex justify-end">
								<DesktopAppButton
									type="button"
									variant="neutral"
									onClick={() => void runToolAgent()}
									disabled={
										toolAgentLoading || isStreaming || uploadMutation.isPending
									}
									aria-busy={toolAgentLoading}
								>
									{toolAgentLoading ? (
										<ArrowPathIcon
											className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
									) : (
										<WrenchIcon
											className="h-4 w-4"
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
									)}
									{t('aiStudioView.toolAgentRun')}
								</DesktopAppButton>
							</div>
							{toolAgentError ? (
								<DesktopAppErrorState message={toolAgentError} />
							) : null}
							{toolAgentMeta ? (
								<details className={cn(nestedInset, 'px-3 py-2 text-xs')}>
									<summary className="cursor-pointer font-medium text-(--desktop-text-secondary)">
										{t('aiStudioView.toolAgentTraceTitle')}
									</summary>
									<div className="mt-2 space-y-2">
										<div className={DESKTOP_TYPOGRAPHY.meta}>
											<span className="font-medium text-(--desktop-text-secondary)">
												{t('aiStudioView.toolAgentRouterModel')}:{' '}
											</span>
											{toolAgentMeta.router_model}
										</div>
										<pre className="max-h-40 overflow-auto whitespace-pre-wrap wrap-break-word rounded-md bg-(--desktop-surface-soft) p-2 font-mono text-[11px] leading-relaxed text-(--desktop-text-primary)">
											{JSON.stringify(
												{
													planned: toolAgentMeta.planned_tools,
													traces: toolAgentMeta.tool_traces,
												},
												null,
												2
											)}
										</pre>
									</div>
								</details>
							) : null}
							{toolAgentOutput ? (
								<div className={cn(nestedInset, 'px-3 py-2.5')}>
									<div
										className={cn(
											DESKTOP_APP_STYLE_CONTRACT.sectionLabel,
											'font-medium'
										)}
									>
										{t('aiStudioView.toolAgentOutputLabel')}
									</div>
									<p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-(--desktop-text-primary)">
										{toolAgentOutput}
									</p>
								</div>
							) : null}
						</DesktopAppSurface>
					) : null}
				</div>
			</SectionPanel>

			<div className="grid min-h-0 gap-4 lg:gap-5">
				<SectionPanel
					title={t('aiStudioView.responsePanelTitle')}
					description={t('aiStudioView.responsePanelDescription')}
				>
					{streamError ? (
						<DesktopAppErrorState message={streamError} />
					) : streamOutput ? (
						<DesktopAppSurface variant="soft" className="overflow-hidden p-0">
							{isStreaming ? (
								<div
									className="h-1 w-full overflow-hidden bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)]"
									role="status"
									aria-live="polite"
									aria-label={t('aiStudioView.runAi')}
								>
									<div className="h-full w-full motion-safe:animate-pulse motion-reduce:animate-none bg-linear-to-r from-transparent via-(--mc-accent)/90 to-transparent" />
								</div>
							) : null}
							<div className="space-y-4 p-4 sm:p-5">
								<div className="flex items-center gap-2.5 border-b border-(--desktop-border-subtle)/60 pb-3">
									<div className={cn(insetIconTile, 'text-(--mc-accent)')}>
										<CpuChipIcon
											className="h-4 w-4"
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
									</div>
									<div className="min-w-0">
										<div className="text-sm font-semibold tracking-tight text-(--desktop-text-primary)">
											{activePreset.title}
										</div>
										<div
											className={cn(
												DESKTOP_TYPOGRAPHY.caption,
												'mt-0.5 line-clamp-2 leading-snug'
											)}
										>
											{activePreset.description}
										</div>
									</div>
								</div>
								<div
									className={cn(
										DESKTOP_TYPOGRAPHY.body,
										'max-h-[min(55vh,28rem)] overflow-y-auto whitespace-pre-wrap leading-[1.65] tracking-[-0.01em] wrap-anywhere'
									)}
								>
									{streamOutput}
								</div>
								{lastRun ? (
									<div
										className={cn(
											nestedInset,
											'px-3 py-2.5 leading-snug',
											DESKTOP_TYPOGRAPHY.caption
										)}
									>
										{t('aiStudioView.runFooter', {
											tool: localizeMarketingAiTool(lastRun.tool_key),
											status: localizeStatus(lastRun.status),
											time: formatDateTime(lastRun.started_at),
										})}
									</div>
								) : null}
							</div>
						</DesktopAppSurface>
					) : isStreaming ? (
						<DesktopAppSurface
							variant="soft"
							className="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center"
							role="status"
							aria-live="polite"
							aria-busy
						>
							<div className="relative flex h-12 w-12 items-center justify-center">
								<span className="absolute inset-0 rounded-full border-2 border-(--desktop-border-subtle) border-t-(--mc-accent) motion-safe:animate-spin motion-reduce:animate-none" />
								<SparklesIcon
									className="relative h-5 w-5 text-(--mc-accent)"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							</div>
							<div className="space-y-1">
								<div className="text-sm font-medium text-(--desktop-text-secondary)">
									{activePreset.title}
								</div>
								<div
									className={cn(
										DESKTOP_TYPOGRAPHY.meta,
										'max-w-sm leading-relaxed'
									)}
								>
									{activePreset.description}
								</div>
							</div>
							<div className="h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)]">
								<div className="h-full w-full motion-safe:animate-pulse motion-reduce:animate-none rounded-full bg-(--mc-accent)/85" />
							</div>
						</DesktopAppSurface>
					) : (
						<DesktopAppEmptyState
							className="rounded-(--desktop-radius) border border-dashed border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/30 py-12"
							icon={
								<SparklesIcon
									className="h-8 w-8 text-(--desktop-text-muted)"
									strokeWidth={1.25}
									aria-hidden
								/>
							}
							title={t('aiStudioView.responseEmptyTitle')}
							description={t('aiStudioView.responseEmptyDescription')}
						/>
					)}
				</SectionPanel>

				<details
					className={cn(
						contentPanel,
						'group min-h-0 shadow-(--mc-section-panel-shadow)'
					)}
				>
					<summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold tracking-tight text-(--desktop-text-primary) [&::-webkit-details-marker]:hidden">
						<span className="flex min-w-0 flex-col gap-0.5 text-left sm:flex-row sm:items-baseline sm:gap-2">
							<span>{t('aiStudioView.historyTitle')}</span>
							<span className={cn(DESKTOP_TYPOGRAPHY.meta, 'font-normal')}>
								{t('aiStudioView.historySummaryHint')}
							</span>
						</span>
						<ChevronDownIcon
							className="h-4 w-4 shrink-0 text-(--desktop-text-muted) transition-transform duration-200 group-open:rotate-180"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					</summary>
					<div className="border-t border-(--desktop-border-subtle)/60 px-4 pb-4 pt-3">
						<p
							className={cn(
								DESKTOP_APP_STYLE_CONTRACT.helperText,
								'mb-3 leading-relaxed'
							)}
						>
							{t('aiStudioView.historyDescription')}
						</p>
						{aiRunsQuery.isLoading ? (
							<LoadingGrid />
						) : aiRunsQuery.isError ? (
							<DesktopAppErrorState
								message={extractApiErrorMessage(
									aiRunsQuery.error,
									t('aiStudioView.historyLoadError')
								)}
								onAction={() => void aiRunsQuery.refetch()}
							/>
						) : aiRunHistoryItems.length > 0 ? (
							aiRunHistoryItems.length >
							MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD ? (
								<VirtualVariableList
									items={aiRunHistoryItems}
									estimateSize={() => 140}
									getItemKey={(index) =>
										aiRunHistoryItems[index]?.id ?? `ai-run-${index}`
									}
									height={448}
									overscanCount={5}
									className="rounded-(--desktop-radius) pr-1"
									renderItem={(run) => (
										<div className="pb-3">{renderAiRunHistoryCard(run)}</div>
									)}
								/>
							) : (
								<div className="max-h-[min(55vh,28rem)] space-y-3 overflow-y-auto pr-1">
									{aiRunHistoryItems.map((run) => renderAiRunHistoryCard(run))}
								</div>
							)
						) : (
							<DesktopAppEmptyState
								className="rounded-(--desktop-radius) border border-dashed border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/30 py-12"
								icon={
									<ClockIcon
										className="h-8 w-8 text-(--desktop-text-muted)"
										strokeWidth={1.25}
										aria-hidden
									/>
								}
								title={t('aiStudioView.historyEmptyTitle')}
								description={t('aiStudioView.historyEmptyDescription')}
							/>
						)}
					</div>
				</details>
			</div>
		</div>
	);
}
