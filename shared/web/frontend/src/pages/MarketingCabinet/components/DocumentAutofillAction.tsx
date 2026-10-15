/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Modal «Из документа» — выбор контента, preview/apply autofill по разделу MC.
 *
 * Invariants:
 * - Локальный fetch контента только при открытой модалке и без shared content source.
 * - `listProjects` для scope — тот же query key, что foundation (`marketingCabinetFoundationProjectsQueryKey`).
 * - Query key контента включает MARKETING_CONTENT_LIST_FETCH_LIMIT (кэш согласован с Evidence).
 *
 * Related:
 * - MarketingCabinetContentPickList.tsx, useMarketingContentSource.tsx
 */
import { VirtualVariableList } from '@/components/shared/VirtualList';
import { Portal } from '@/components/ui/Portal';
import i18n from 'i18next';
import { contentApi } from '@/services/contentApi';
import { cn } from '@/utils/cn';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	ArrowPathIcon,
	ArrowUpTrayIcon,
	ClipboardDocumentCheckIcon,
	SparklesIcon,
	StopIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_LUCIDE,
	DESKTOP_OVERLAY,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppErrorState,
	DesktopAppSectionLabel,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import {
	INPUT_STACK_CLASS,
	MARKETING_AUTOFILL_DRAFT_ROW_ESTIMATE_PX,
	MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD,
	TEXTAREA_CLASS,
} from '../constants';
import {
	marketingCabinetAiRunDetailPollIntervalMs,
	marketingCabinetAiRunDetailQueryOptions,
	marketingCabinetAiRunsInvalidationQueryKey,
	marketingCabinetContentInvalidationQueryKey,
	marketingCabinetContentQueryOptions,
	marketingCabinetDashboardLayoutInvalidationQueryKey,
	marketingCabinetFoundationProjectsQueryOptions,
	marketingCabinetProjectDashboardInvalidationQueryKey,
} from '../marketingCabinetQueryOptions';
import { useMarketingDialogFocusTrap } from '../hooks/useMarketingDialogFocusTrap';
import { useMarketingContentSource } from '../hooks/useMarketingContentSource';
import { getMarketingCabinetPortalRoot } from '../utils/getMarketingCabinetPortalRoot';
import { localizeStatus } from '../locales';
import {
	MARKETING_LONG_TIMEOUT_MS,
	coerceMarketingAutofillResult,
	marketingCabinetApi,
	type MarketingDocumentAutofillPreviewItem,
	type MarketingDocumentAutofillTarget,
} from '../marketingCabinetApi';
import { extractApiErrorMessage, requireDefined } from '../utils';
import { MarketingCabinetContentPickList } from './MarketingCabinetContentPickList';
import { FieldLabel } from './FieldLabel';
import { LoadingGrid } from './LoadingGrid';
import { SectionPanel } from './SectionPanel';

interface DocumentAutofillActionProps {
	projectId: string | null;
	companyId?: string | null;
	targetSection: MarketingDocumentAutofillTarget;
	targetLabel: string;
	buttonLabel?: string;
	buttonVariant?: 'neutral' | 'accent' | 'danger' | 'ghost';
	buttonSize?: 'sm' | 'md' | 'icon';
	invalidateQueryKeys?: readonly (readonly unknown[])[];
}

function formatPayloadValue(value: unknown): string {
	if (value == null)
		return i18n.t('documentAutofill.payloadNull', { ns: 'marketing' });
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean')
		return String(value);
	if (Array.isArray(value)) {
		return value
			.map((item) => {
				if (typeof item === 'object' && item != null) {
					return JSON.stringify(item);
				}
				return String(item);
			})
			.join(', ');
	}
	return JSON.stringify(value);
}

function renderPayloadHighlights(
	payload: Record<string, unknown>
): Array<[string, string]> {
	return Object.entries(payload)
		.filter(([, value]) => {
			if (value == null) return false;
			if (typeof value === 'string') return value.trim().length > 0;
			if (Array.isArray(value)) return value.length > 0;
			return true;
		})
		.slice(0, 6)
		.map(([key, value]) => [key.replace(/_/g, ' '), formatPayloadValue(value)]);
}

export function DocumentAutofillAction({
	projectId,
	companyId = null,
	targetSection,
	targetLabel,
	buttonLabel,
	buttonVariant = 'ghost',
	buttonSize = 'sm',
	invalidateQueryKeys = [],
}: DocumentAutofillActionProps) {
	const { t } = useTranslation('marketing');
	const baseId = useId().replace(/:/g, '');
	const titleId = `${baseId}-title`;
	const subtitleId = `${baseId}-subtitle`;
	const kbdHintId = `${baseId}-kbd-hint`;
	const queryClient = useQueryClient();
	const resolvedButtonLabel =
		buttonLabel ?? t('documentAutofill.defaultButton');
	const sharedContentSource = useMarketingContentSource();
	const canUseSharedContentSource = Boolean(
		sharedContentSource &&
			sharedContentSource.selectedProjectId === projectId &&
			(!companyId || sharedContentSource.selectedCompanyId === companyId)
	);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const triggerAnchorRef = useRef<HTMLSpanElement>(null);
	const modalRef = useRef<HTMLDivElement>(null);
	const [isOpen, setIsOpen] = useState(false);
	useMarketingDialogFocusTrap(modalRef, isOpen);

	useEffect(() => {
		if (isOpen) {
			sharedContentSource?.engageToolbarContent?.();
		}
	}, [isOpen, sharedContentSource]);
	const [localSelectedContentId, setLocalSelectedContentId] = useState<
		string | null
	>(null);
	const [userInstruction, setUserInstruction] = useState('');
	const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
	const [previewItems, setPreviewItems] = useState<
		MarketingDocumentAutofillPreviewItem[]
	>([]);
	const [summary, setSummary] = useState<string | null>(null);
	const [warnings, setWarnings] = useState<string[]>([]);
	const [localError, setLocalError] = useState<string | null>(null);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [previewRunId, setPreviewRunId] = useState<string | null>(null);
	const selectedContentId = canUseSharedContentSource
		? (sharedContentSource?.selectedContentId ?? null)
		: localSelectedContentId;
	const setSelectedContentId = useCallback(
		(next: string | null) => {
			if (canUseSharedContentSource) {
				sharedContentSource?.setSelectedContentId(next);
				return;
			}
			setLocalSelectedContentId(next);
		},
		[canUseSharedContentSource, sharedContentSource]
	);

	useEffect(() => {
		if (!isOpen) {
			setLocalError(null);
			setWarnings([]);
			setSummary(null);
			setPreviewItems([]);
			setSelectedDraftIds([]);
			setUploadProgress(0);
			setPreviewRunId(null);
			return;
		}
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	}, [isOpen]);

	const projectsForContentScopeQuery = useQuery({
		...marketingCabinetFoundationProjectsQueryOptions(companyId),
		enabled:
			Boolean(companyId) &&
			!canUseSharedContentSource &&
			isOpen &&
			Boolean(projectId),
	});
	const projectInContentScope = useMemo(() => {
		if (!projectId || !projectsForContentScopeQuery.data?.length) {
			return null;
		}
		return (
			projectsForContentScopeQuery.data.find((p) => p.id === projectId) ?? null
		);
	}, [projectsForContentScopeQuery.data, projectId]);

	const localContentQuery = useQuery({
		...marketingCabinetContentQueryOptions(projectId, companyId),
		enabled:
			!canUseSharedContentSource &&
			isOpen &&
			Boolean(projectId) &&
			(!companyId ||
				Boolean(
					projectInContentScope &&
						projectInContentScope.company_id === companyId
				)),
	});
	const contentQuery =
		canUseSharedContentSource && sharedContentSource
			? sharedContentSource.contentQuery
			: localContentQuery;
	const contentItems = contentQuery.data?.items ?? [];
	const previewRunQuery = useQuery({
		...marketingCabinetAiRunDetailQueryOptions(previewRunId),
		enabled: Boolean(previewRunId),
		refetchInterval: (query) =>
			marketingCabinetAiRunDetailPollIntervalMs(query.state.data),
	});

	useEffect(() => {
		if (!isOpen) return;
		if (!selectedContentId && contentItems.length) {
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
	}, [contentItems, isOpen, selectedContentId, setSelectedContentId]);

	useEffect(() => {
		if (!previewRunId || !previewRunQuery.data) return;
		const detail = previewRunQuery.data;
		const runStatus = detail.run.status;
		if (runStatus === 'completed') {
			const result = coerceMarketingAutofillResult(detail);
			setSummary(result?.summary || t('documentAutofill.summaryPreviewReady'));
			setWarnings(result?.warnings ?? []);
			setPreviewItems(result?.preview_items ?? []);
			setSelectedDraftIds(
				(result?.preview_items ?? []).map((item) => item.draft_id)
			);
			setLocalError(null);
			setPreviewRunId(null);
			void queryClient.invalidateQueries({
				queryKey: marketingCabinetAiRunsInvalidationQueryKey(),
			});
			return;
		}
		if (runStatus === 'failed' || runStatus === 'cancelled') {
			setLocalError(detail.error || t('documentAutofill.errPreviewBuild'));
			setPreviewRunId(null);
		}
	}, [previewRunId, previewRunQuery.data, queryClient, t]);

	useEffect(() => {
		if (!previewRunQuery.isError) return;
		setLocalError(
			extractApiErrorMessage(
				previewRunQuery.error,
				t('documentAutofill.errPreviewStatus')
			)
		);
		setPreviewRunId(null);
	}, [previewRunQuery.error, previewRunQuery.isError, t]);

	const uploadMutation = useMutation({
		mutationFn: async (file: File) =>
			contentApi.uploadContent(
				file,
				{
					name: file.name,
					...(projectId ? { project_id: projectId } : {}),
					...(companyId ? { company_id: companyId } : {}),
				},
				{ onProgress: setUploadProgress, timeout: MARKETING_LONG_TIMEOUT_MS }
			),
		onSuccess: async (uploaded) => {
			setSelectedContentId(uploaded.id);
			setSummary(t('documentAutofill.summaryAfterUpload'));
			await queryClient.invalidateQueries({
				queryKey: marketingCabinetContentInvalidationQueryKey(
					projectId,
					companyId
				),
			});
			await contentQuery.refetch();
		},
		onError: (error) => {
			setLocalError(
				extractApiErrorMessage(error, t('documentAutofill.errUpload'))
			);
		},
	});

	const previewMutation = useMutation({
		mutationFn: async () => {
			if (!projectId || !selectedContentId) {
				throw new Error(t('documentAutofill.errPickDocumentPreview'));
			}
			return marketingCabinetApi.documentAutofillAsync({
				project_id: projectId,
				content_id: selectedContentId,
				target_section: targetSection,
				mode: 'preview',
				user_instruction: userInstruction.trim() || null,
			});
		},
		onSuccess: (response) => {
			setPreviewItems([]);
			setSelectedDraftIds([]);
			setWarnings([]);
			setPreviewRunId(response.run.id);
			setLocalError(null);
			setSummary(
				response.queue?.status === 'queued'
					? t('documentAutofill.summaryQueued')
					: t('documentAutofill.summaryAnalyzing')
			);
			void queryClient.invalidateQueries({
				queryKey: marketingCabinetAiRunsInvalidationQueryKey(),
			});
		},
		onError: (error) => {
			setLocalError(
				extractApiErrorMessage(error, t('documentAutofill.errPreviewBuild'))
			);
		},
	});

	const applyMutation = useMutation({
		mutationFn: async () => {
			if (!projectId || !selectedContentId) {
				throw new Error(t('documentAutofill.errPickDocumentApply'));
			}
			if (previewItems.length === 0) {
				throw new Error(t('documentAutofill.errBuildPreviewFirst'));
			}
			return marketingCabinetApi.documentAutofill({
				project_id: projectId,
				content_id: selectedContentId,
				target_section: targetSection,
				mode: 'apply',
				user_instruction: userInstruction.trim() || null,
				draft_items: previewItems,
				selected_item_ids: selectedDraftIds,
			});
		},
		onSuccess: async (response) => {
			setSummary(
				response.summary ||
					t('documentAutofill.appliedCount', {
						count: (response.applied_items ?? []).length,
					})
			);
			setWarnings(response.warnings ?? []);
			setLocalError(null);
			const pid = requireDefined(projectId, 'projectId');
			const baseKeys: Array<readonly unknown[]> = [
				marketingCabinetProjectDashboardInvalidationQueryKey(pid),
				marketingCabinetDashboardLayoutInvalidationQueryKey(pid),
				marketingCabinetAiRunsInvalidationQueryKey(),
				marketingCabinetContentInvalidationQueryKey(pid, companyId),
			];
			await Promise.all(
				[...baseKeys, ...invalidateQueryKeys].map((queryKey) =>
					queryClient.invalidateQueries({ queryKey })
				)
			);
		},
		onError: (error) => {
			setLocalError(
				extractApiErrorMessage(error, t('documentAutofill.errApply'))
			);
		},
	});

	const selectedContent = useMemo(
		() => contentItems.find((item) => item.id === selectedContentId) ?? null,
		[contentItems, selectedContentId]
	);

	const previewQueue = previewRunQuery.data?.queue ?? null;
	const isPreviewRunning = previewMutation.isPending || Boolean(previewRunId);
	const allSelected =
		previewItems.length > 0 && selectedDraftIds.length === previewItems.length;
	const scopedModalContainer = getMarketingCabinetPortalRoot(
		triggerAnchorRef.current
	);
	const isScopedToMarketingShell = scopedModalContainer !== document.body;

	function toggleDraft(draftId: string) {
		setSelectedDraftIds((prev) =>
			prev.includes(draftId)
				? prev.filter((item) => item !== draftId)
				: [...prev, draftId]
		);
	}

	function toggleAllDrafts() {
		setSelectedDraftIds((prev) =>
			prev.length === previewItems.length
				? []
				: previewItems.map((item) => item.draft_id)
		);
	}

	function renderPreviewDraftCard(item: MarketingDocumentAutofillPreviewItem) {
		const checked = selectedDraftIds.includes(item.draft_id);
		return (
			<DesktopAppSurface
				variant="soft"
				className={cn(
					'space-y-3 p-4 transition-colors',
					checked ? 'ring-1 ring-(--mc-accent-40)' : ''
				)}
			>
				<div className="flex items-start justify-between gap-3">
					<button
						type="button"
						onClick={() => toggleDraft(item.draft_id)}
						className="flex min-w-0 flex-1 items-start gap-3 text-left"
					>
						{checked ? (
							<ClipboardDocumentCheckIcon
								className="mt-0.5 h-4 w-4 shrink-0 text-(--mc-accent)"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						) : (
							<StopIcon
								className={cn(
									'mt-0.5 h-4 w-4 shrink-0',
									DESKTOP_TYPOGRAPHY.meta
								)}
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						)}
						<div className="min-w-0 flex-1">
							<div className="text-sm font-medium text-(--desktop-text-primary)">
								{item.title}
							</div>
							{item.description ? (
								<div className="mt-1 text-xs leading-5 text-(--desktop-text-secondary)">
									{item.description}
								</div>
							) : null}
						</div>
					</button>
				</div>

				<div className={INPUT_STACK_CLASS}>
					{renderPayloadHighlights(item.payload ?? {}).map(([label, value]) => (
						<div
							key={`${item.draft_id}-${label}`}
							className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) px-3 py-2"
						>
							<div className={DESKTOP_APP_STYLE_CONTRACT.sectionLabel}>
								{label}
							</div>
							<div className="mt-1 text-xs leading-5 text-(--desktop-text-secondary)">
								{value}
							</div>
						</div>
					))}
				</div>

				{(item.evidence ?? []).length > 0 ? (
					<div className="space-y-2">
						<DesktopAppSectionLabel>
							{t('documentAutofill.evidenceLabel')}
						</DesktopAppSectionLabel>
						<div className="space-y-2">
							{(item.evidence ?? []).map((evidence) => (
								<div
									key={`${item.draft_id}-${evidence}`}
									className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) px-3 py-2 text-xs leading-5 text-(--desktop-text-secondary)"
								>
									{evidence}
								</div>
							))}
						</div>
					</div>
				) : null}
			</DesktopAppSurface>
		);
	}

	function handleOpen() {
		if (!projectId) return;
		setIsOpen(true);
	}

	function handleUploadClick() {
		fileInputRef.current?.click();
	}

	async function handleFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		if (!file) return;
		await uploadMutation.mutateAsync(file);
		if (fileInputRef.current) fileInputRef.current.value = '';
	}

	return (
		<>
			<span ref={triggerAnchorRef} className="inline-flex">
				<DesktopAppButton
					type="button"
					variant={buttonVariant}
					size={buttonSize}
					onClick={handleOpen}
					disabled={!projectId}
				>
					<SparklesIcon
						className="h-4 w-4"
						strokeWidth={DESKTOP_LUCIDE.stroke}
					/>
					{resolvedButtonLabel}
				</DesktopAppButton>
			</span>

			{isOpen ? (
				<Portal container={scopedModalContainer}>
					<div
						className={cn(
							'flex items-center justify-center p-4 sm:p-6',
							DESKTOP_OVERLAY.backdrop,
							isScopedToMarketingShell
								? 'absolute inset-0 z-90'
								: 'fixed inset-0 z-90'
						)}
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						aria-describedby={`${subtitleId} ${kbdHintId}`}
						onClick={(event) => {
							if (event.target === event.currentTarget) setIsOpen(false);
						}}
						onKeyDown={(e) => {
							if (e.key === 'Escape') setIsOpen(false);
						}}
					>
						<div
							ref={modalRef}
							className={cn(
								'flex w-full max-w-6xl flex-col overflow-hidden rounded-(--desktop-radius-lg) border border-(--desktop-border-strong) bg-(--desktop-surface-panel-strong) shadow-(--desktop-shadow-panel)',
								isScopedToMarketingShell
									? 'max-h-[calc(100%-2rem)]'
									: 'max-h-[min(92vh,58rem)]'
							)}
						>
							<header className="flex items-start justify-between gap-3 border-b border-(--desktop-border-subtle) px-5 py-4 sm:px-6">
								<div className="min-w-0 flex-1">
									<h2
										id={titleId}
										className="text-lg font-medium text-(--desktop-text-primary)"
									>
										{t('documentAutofill.modalTitle')}
									</h2>
									<p
										id={subtitleId}
										className="mt-1 text-sm text-(--desktop-text-muted) antialiased"
									>
										{t('documentAutofill.modalSubtitle', {
											section: targetLabel,
										})}
									</p>
									<p id={kbdHintId} className="sr-only">
										{t('modalKeyboardHint')}
									</p>
								</div>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="icon"
									onClick={() => setIsOpen(false)}
									aria-label={t('documentAutofill.closeModalAria')}
								>
									<XMarkIcon
										className="h-4 w-4"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								</DesktopAppButton>
							</header>

							<div className="grid min-h-0 flex-1 gap-4 overflow-hidden px-5 py-4 sm:grid-cols-[0.95fr_1.05fr] sm:px-6 sm:py-5">
								<div className="min-h-0 space-y-4 overflow-y-auto pr-1">
									<SectionPanel
										title={t('documentAutofill.sourceTitle')}
										description={t('documentAutofill.sourceDescription')}
										actions={
											<div className="flex items-center gap-2">
												<DesktopAppButton
													type="button"
													variant="ghost"
													size="sm"
													onClick={handleUploadClick}
												>
													<ArrowUpTrayIcon
														className="h-4 w-4"
														strokeWidth={DESKTOP_LUCIDE.stroke}
													/>
													{t('documentAutofill.upload')}
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
										}
									>
										<input
											ref={fileInputRef}
											type="file"
											className="hidden"
											onChange={handleFilePicked}
										/>
										{uploadMutation.isPending ? (
											<DesktopAppSurface
												variant="soft"
												className="space-y-2 p-3"
											>
												<div className="flex items-center gap-2 text-sm text-(--desktop-text-secondary)">
													<ArrowPathIcon
														className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
														strokeWidth={DESKTOP_LUCIDE.stroke}
													/>
													{t('documentAutofill.uploadingDoc')}
												</div>
												<div className="h-2 rounded-full bg-(--desktop-surface-panel-strong)">
													<div
														className="h-2 rounded-full bg-(--mc-accent)"
														style={{ width: `${Math.max(4, uploadProgress)}%` }}
													/>
												</div>
											</DesktopAppSurface>
										) : null}

										{contentQuery.isLoading ? (
											<LoadingGrid />
										) : contentQuery.isError ? (
											<DesktopAppErrorState
												message={extractApiErrorMessage(
													contentQuery.error,
													t('documentAutofill.loadDocumentsError')
												)}
												onAction={() => void contentQuery.refetch()}
											/>
										) : contentItems.length > 0 ? (
											<MarketingCabinetContentPickList
												items={contentItems}
												total={contentQuery.data?.total}
												selectedContentId={selectedContentId}
												onSelectContentId={setSelectedContentId}
											/>
										) : (
											<DesktopAppEmptyState
												title={t('documentAutofill.emptyDocsTitle')}
												description={t('documentAutofill.emptyDocsDescription')}
											/>
										)}
									</SectionPanel>

									<SectionPanel
										title={t('documentAutofill.instructionTitle')}
										description={t('documentAutofill.instructionDescription')}
									>
										<FieldLabel label={t('documentAutofill.fieldExtractLabel')}>
											<textarea
												className={TEXTAREA_CLASS}
												value={userInstruction}
												onChange={(event) =>
													setUserInstruction(event.target.value)
												}
												placeholder={t(
													'documentAutofill.instructionPlaceholder',
													{ section: targetLabel }
												)}
											/>
										</FieldLabel>
										{selectedContent ? (
											<DesktopAppSurface
												variant="soft"
												className="space-y-1 p-3"
											>
												<div
													className={DESKTOP_APP_STYLE_CONTRACT.sectionLabel}
												>
													{t('aiStudioView.selectedDocumentLabel')}
												</div>
												<div className="text-sm font-medium text-(--desktop-text-primary)">
													{selectedContent.name}
												</div>
												<div className="text-xs text-(--desktop-text-secondary)">
													{selectedContent.processing_status ||
														t('aiStudioView.processingUnknown')}{' '}
													·{' '}
													{selectedContent.mime_type ||
														selectedContent.content_type ||
														t('aiStudioView.contentTypeDocument')}
												</div>
											</DesktopAppSurface>
										) : null}
									</SectionPanel>
								</div>

								<div className="min-h-0 space-y-4 overflow-y-auto pl-1">
									<SectionPanel
										title={t('documentAutofill.previewTitle')}
										description={t('documentAutofill.previewDescription')}
										actions={
											<div className="flex items-center gap-2">
												<DesktopAppButton
													type="button"
													variant="accent"
													size="sm"
													onClick={() => void previewMutation.mutateAsync()}
													disabled={!selectedContentId || isPreviewRunning}
												>
													{isPreviewRunning ? (
														<ArrowPathIcon
															className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
															strokeWidth={DESKTOP_LUCIDE.stroke}
														/>
													) : (
														<SparklesIcon
															className="h-4 w-4"
															strokeWidth={DESKTOP_LUCIDE.stroke}
														/>
													)}
													{isPreviewRunning
														? t('documentAutofill.analyzing')
														: t('documentAutofill.analyze')}
												</DesktopAppButton>
												<DesktopAppButton
													type="button"
													variant="ghost"
													size="sm"
													onClick={() => void applyMutation.mutateAsync()}
													disabled={
														previewItems.length === 0 ||
														selectedDraftIds.length === 0 ||
														applyMutation.isPending ||
														isPreviewRunning
													}
												>
													{applyMutation.isPending ? (
														<ArrowPathIcon
															className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
															strokeWidth={DESKTOP_LUCIDE.stroke}
														/>
													) : (
														<ClipboardDocumentCheckIcon
															className="h-4 w-4"
															strokeWidth={DESKTOP_LUCIDE.stroke}
														/>
													)}
													{t('documentAutofill.apply')}
												</DesktopAppButton>
											</div>
										}
									>
										{localError ? (
											<DesktopAppErrorState message={localError} />
										) : null}

										{summary ? (
											<DesktopAppSurface
												variant="soft"
												className="space-y-2 p-3"
											>
												<div
													className={DESKTOP_APP_STYLE_CONTRACT.sectionLabel}
												>
													{t('documentAutofill.summaryLabel')}
												</div>
												<div className="text-sm text-(--desktop-text-secondary)">
													{summary}
												</div>
												{warnings.length > 0 ? (
													<div className="space-y-2 rounded-(--desktop-radius) border border-(--mc-border-accent-soft) bg-(--mc-readonly-banner-bg) p-3">
														<DesktopAppSectionLabel>
															{t('documentAutofill.warningsLabel')}
														</DesktopAppSectionLabel>
														<ul className="space-y-1.5 text-xs leading-5 text-(--desktop-text-secondary)">
															{warnings.map((warning) => (
																<li key={warning} className="pl-0.5">
																	{warning}
																</li>
															))}
														</ul>
													</div>
												) : null}
											</DesktopAppSurface>
										) : null}

										{isPreviewRunning ? (
											<DesktopAppSurface
												variant="soft"
												className="space-y-2 p-3"
											>
												<div className="flex items-center gap-2 text-sm text-(--desktop-text-secondary)">
													<ArrowPathIcon
														className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
														strokeWidth={DESKTOP_LUCIDE.stroke}
													/>
													<span>
														{t('documentAutofill.statusLine', {
															status: localizeStatus(
																previewQueue?.status ||
																	previewRunQuery.data?.run.status ||
																	'processing'
															),
														})}
													</span>
												</div>
												{previewQueue?.waiting_count != null ? (
													<div className={DESKTOP_TYPOGRAPHY.meta}>
														{t('documentAutofill.queueCounts', {
															waiting: previewQueue.waiting_count,
															processing: previewQueue.processing_count ?? 0,
														})}
													</div>
												) : (
													<div className={DESKTOP_TYPOGRAPHY.meta}>
														{t('documentAutofill.waitingUgs')}
													</div>
												)}
											</DesktopAppSurface>
										) : null}

										{previewItems.length > 0 ? (
											<div className="space-y-3">
												<div className="flex items-center justify-between gap-3">
													<div className={DESKTOP_TYPOGRAPHY.meta}>
														{t('documentAutofill.draftCounts', {
															total: previewItems.length,
															selected: selectedDraftIds.length,
														})}
													</div>
													<DesktopAppButton
														type="button"
														variant="ghost"
														size="sm"
														onClick={toggleAllDrafts}
													>
														{allSelected ? (
															<StopIcon
																className="h-4 w-4"
																strokeWidth={DESKTOP_LUCIDE.stroke}
															/>
														) : (
															<ClipboardDocumentCheckIcon
																className="h-4 w-4"
																strokeWidth={DESKTOP_LUCIDE.stroke}
															/>
														)}
														{allSelected
															? t('documentAutofill.deselectAll')
															: t('documentAutofill.selectAll')}
													</DesktopAppButton>
												</div>
												{previewItems.length >
												MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD ? (
													<VirtualVariableList
														items={previewItems}
														estimateSize={() =>
															MARKETING_AUTOFILL_DRAFT_ROW_ESTIMATE_PX
														}
														getItemKey={(index) =>
															previewItems[index]?.draft_id ??
															`autofill-draft-${index}`
														}
														height={400}
														overscanCount={5}
														className="rounded-(--desktop-radius)"
														renderItem={(item) => (
															<div className="pb-3">
																{renderPreviewDraftCard(item)}
															</div>
														)}
													/>
												) : (
													previewItems.map((item) => (
														<div key={item.draft_id}>
															{renderPreviewDraftCard(item)}
														</div>
													))
												)}
											</div>
										) : (
											<DesktopAppEmptyState
												title={t('documentAutofill.previewEmptyTitle')}
												description={t(
													'documentAutofill.previewEmptyDescription'
												)}
											/>
										)}
									</SectionPanel>
								</div>
							</div>
						</div>
					</div>
				</Portal>
			) : null}
		</>
	);
}
