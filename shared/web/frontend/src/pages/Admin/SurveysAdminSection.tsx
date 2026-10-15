/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified Admin section for Survey Hub MVP: catalog, editor, audience, results.
 *
 * Invariants:
 * - Publish is draft-only; server enforces questions + audience before publish.
 * - Editor and audience mutations apply only while survey status is draft.
 *
 * Related:
 * - `pages/Admin/shell/AdminSectionFrame.tsx`
 * - `pages/Desktop/services/productDesktopSurveysApi.ts`
 * - `documentation/product/SURVEY-HUB.md`
 */
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
	DesktopAppButton,
	DesktopAppPanel,
	DesktopNativeSelect,
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
} from '../Desktop/components/DesktopAppChrome';
import { DESKTOP_INTERACTIVE, DESKTOP_TYPOGRAPHY } from '../Desktop/constants';
import {
	adminArchiveSurvey,
	adminCreateSurvey,
	adminGetSurvey,
	adminListSurveys,
	adminPatchSurvey,
	adminPreviewSurveyAudience,
	adminPublishSurvey,
	adminQueueSurveyGafNotify,
	adminReplaceSurveyAudience,
	adminReplaceSurveyQuestions,
	type SurveyAdmin,
} from '../Desktop/services/productDesktopSurveysApi';
import { getAccessGroups, getUsers } from '../Desktop/services/desktopAdminApi';
import { AdminSectionFrame } from './shell/AdminSectionFrame';
import { SurveysAdminResultsPanel } from './surveys/SurveysAdminResultsPanel';
import { SurveyAdminPublishChecklist } from './surveys/SurveyAdminPublishChecklist';
import { SurveyAdminSortableQuestionsEditor } from './surveys/SurveyAdminSortableQuestionsEditor';
import { SurveyAdminGafNotifyPreview } from './surveys/SurveyAdminGafNotifyPreview';
import { SurveyAdminAiCreatePanel } from './surveys/SurveyAdminAiCreatePanel';
import { SurveyAdminCatalogPanel } from './surveys/SurveyAdminCatalogPanel';
import { SurveyAdminWorkflowStrip } from './surveys/SurveyAdminWorkflowStrip';
import {
	filterAdminCatalogSurveys,
	summarizeAdminCatalog,
} from './surveys/surveyAdminCatalogUtils';
import { SurveyAdminAudiencePicker } from './surveys/SurveyAdminAudiencePicker';
import { SurveyAdminDraftActionBar } from './surveys/SurveyAdminDraftActionBar';
import { SurveyAdminUserPreviewDialog } from './surveys/SurveyAdminUserPreviewDialog';
import { buildAdminUserPreviewDetail } from './surveys/surveyAdminUserPreview';
import { computePublishReadiness } from './surveys/surveyAdminPublishReadiness';
import {
	surveyDatetimeLocalValueToIso,
	surveyIsoToDatetimeLocalValue,
} from './surveys/surveyAdminDateTimeUtils';
import { SurveyAdminPublishedToolbar } from './surveys/SurveyAdminPublishedToolbar';
import { duplicateSurveyAsDraft } from './surveys/surveyAdminDuplicateDraft';
import { formatSurveyDateLabel } from '@/features/surveys/desktop/surveyHubUserUtils';
import { buildSurveyUserLookup } from './surveys/surveyAdminUserLookup';
import {
	draftToApiQuestions,
	emptyQuestionDraft,
	questionToDraft,
	validateQuestionDrafts,
	type QuestionDraft,
	type QuestionValidationIssue,
} from './surveys/surveyAdminEditorUtils';

type AdminTab = 'catalog' | 'ai-create' | 'editor' | 'audience' | 'results';

const AUDIENCE_MODES = [
	'groups_only',
	'users_only',
	'groups_or_users',
	'groups_and_users',
] as const;

const INPUT_CLASS = cn(
	'w-full rounded-(--desktop-radius) border border-(--desktop-border-subtle)',
	'bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary)',
	'placeholder:text-(--desktop-text-dim)',
	'focus:border-[rgb(var(--desktop-accent-rgb)/0.45)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--desktop-accent-rgb)/0.2)]'
);

function toastErr(e: unknown): void {
	toast.error(e instanceof Error ? e.message : String(e));
}

export function SurveysAdminSection(): React.ReactElement {
	const { t } = useTranslation('surveys');
	const qc = useQueryClient();
	const [tab, setTab] = React.useState<AdminTab>('catalog');
	const [selectedId, setSelectedId] = React.useState<string | null>(null);
	const [statusFilter, setStatusFilter] = React.useState('');
	const [catalogQuery, setCatalogQuery] = React.useState('');
	const [title, setTitle] = React.useState('');
	const [descriptionUser, setDescriptionUser] = React.useState('');
	const [rewardUgs, setRewardUgs] = React.useState('0');
	const [rewardEw, setRewardEw] = React.useState('0');
	const [rewardCoins, setRewardCoins] = React.useState('0');
	const [gafNotifyBody, setGafNotifyBody] = React.useState('');
	const [questions, setQuestions] = React.useState<QuestionDraft[]>([]);
	const [audienceMode, setAudienceMode] = React.useState('groups_or_users');
	const [groupIds, setGroupIds] = React.useState<string[]>([]);
	const [userIds, setUserIds] = React.useState<string[]>([]);
	const [previewCount, setPreviewCount] = React.useState<number | null>(null);
	const [editorIssues, setEditorIssues] = React.useState<
		QuestionValidationIssue[]
	>([]);
	const [userPreviewOpen, setUserPreviewOpen] = React.useState(false);
	const [closesAtLocal, setClosesAtLocal] = React.useState('');

	const listQ = useQuery({
		queryKey: ['admin-surveys', 'list', statusFilter],
		queryFn: () => adminListSurveys(statusFilter || undefined),
	});

	const detailQ = useQuery({
		queryKey: ['admin-surveys', 'detail', selectedId],
		queryFn: () => adminGetSurvey(selectedId ?? ''),
		enabled: Boolean(selectedId),
	});

	const groupsQ = useQuery({
		queryKey: ['admin-surveys', 'access-groups'],
		queryFn: getAccessGroups,
	});

	const usersQ = useQuery({
		queryKey: ['admin-surveys', 'users'],
		queryFn: getUsers,
	});

	const survey = detailQ.data;
	const isDraft = survey?.status === 'draft';

	React.useEffect(() => {
		if (!survey) return;
		setTitle(survey.title);
		setDescriptionUser(survey.description_user);
		setRewardUgs(String(survey.reward.ugs_credits));
		setRewardEw(String(survey.reward.ew_balance));
		setRewardCoins(String(survey.reward.web_search_coins));
		setGafNotifyBody(survey.gaf_notify_body_template ?? '');
		setQuestions(
			(survey.questions ?? []).length
				? (survey.questions ?? []).map(questionToDraft)
				: [emptyQuestionDraft('new-0')]
		);
		setEditorIssues([]);
		setAudienceMode(survey.audience_mode);
		setGroupIds(survey.access_group_ids ?? []);
		setUserIds(survey.user_ids ?? []);
		setPreviewCount(survey.eligible_count ?? null);
		setClosesAtLocal(surveyIsoToDatetimeLocalValue(survey.closes_at));
	}, [survey]);

	const invalidate = React.useCallback(async () => {
		await qc.invalidateQueries({ queryKey: ['admin-surveys'] });
	}, [qc]);

	const createMut = useMutation({
		mutationFn: () =>
			adminCreateSurvey({
				title: t('admin.defaultTitle'),
				description_user: '',
				audience_mode: 'groups_or_users',
				sort_order: 0,
			}),
		onSuccess: async (created: SurveyAdmin) => {
			toast.success(t('admin.created'));
			setSelectedId(created.id);
			setTab('editor');
			await invalidate();
		},
		onError: toastErr,
	});

	const duplicateMut = useMutation({
		mutationFn: (surveyId: string) =>
			duplicateSurveyAsDraft(surveyId, t('admin.duplicateSuffix')),
		onSuccess: async (created: SurveyAdmin) => {
			toast.success(t('admin.duplicated'));
			setSelectedId(created.id);
			setTab('editor');
			await invalidate();
		},
		onError: toastErr,
	});

	const saveEditorMut = useMutation({
		mutationFn: async () => {
			if (!selectedId) throw new Error(t('admin.noSurveySelected'));
			if (!title.trim()) {
				throw new Error(t('admin.validation.title'));
			}
			const issues = validateQuestionDrafts(questions);
			if (issues.length) {
				setEditorIssues(issues);
				throw new Error(t('admin.validation.summary'));
			}
			setEditorIssues([]);
			const reward = {
				ugs_credits: Math.max(0, Number.parseInt(rewardUgs, 10) || 0),
				ew_balance: Math.max(0, Number.parseInt(rewardEw, 10) || 0),
				web_search_coins: Math.max(0, Number.parseInt(rewardCoins, 10) || 0),
			};
			await adminPatchSurvey(selectedId, {
				title: title.trim(),
				description_user: descriptionUser,
				reward,
				gaf_notify_body_template: gafNotifyBody.trim() || null,
				closes_at: surveyDatetimeLocalValueToIso(closesAtLocal),
			});
			return adminReplaceSurveyQuestions(
				selectedId,
				draftToApiQuestions(questions)
			);
		},
		onSuccess: async () => {
			toast.success(t('admin.saved'));
			await invalidate();
		},
		onError: toastErr,
	});

	const saveAudienceMut = useMutation({
		mutationFn: async () => {
			if (!selectedId) throw new Error(t('admin.noSurveySelected'));
			return adminReplaceSurveyAudience(selectedId, {
				audience_mode: audienceMode,
				access_group_ids: groupIds,
				user_ids: userIds,
			});
		},
		onSuccess: async (data) => {
			toast.success(t('admin.audienceSaved'));
			setPreviewCount(data.eligible_count ?? null);
			await invalidate();
		},
		onError: toastErr,
	});

	const previewMut = useMutation({
		mutationFn: () => {
			if (!selectedId) throw new Error(t('admin.noSurveySelected'));
			return adminPreviewSurveyAudience(selectedId);
		},
		onSuccess: (data) => {
			setPreviewCount(data.eligible_count ?? null);
			toast.success(t('admin.previewCount', { count: data.eligible_count }));
		},
		onError: toastErr,
	});

	const publishMut = useMutation({
		mutationFn: () => {
			if (!selectedId) throw new Error(t('admin.noSurveySelected'));
			return adminPublishSurvey(selectedId);
		},
		onSuccess: async () => {
			toast.success(t('admin.published'));
			await invalidate();
		},
		onError: toastErr,
	});

	const archiveMut = useMutation({
		mutationFn: () => {
			if (!selectedId) throw new Error(t('admin.noSurveySelected'));
			return adminArchiveSurvey(selectedId);
		},
		onSuccess: async () => {
			toast.success(t('admin.archived'));
			await invalidate();
		},
		onError: toastErr,
	});

	const savePublishedDeadlineMut = useMutation({
		mutationFn: (closesAtIso: string | null) => {
			if (!selectedId) throw new Error(t('admin.noSurveySelected'));
			return adminPatchSurvey(selectedId, { closes_at: closesAtIso });
		},
		onSuccess: async () => {
			toast.success(t('admin.publishedToolbar.deadlineSaved'));
			await invalidate();
		},
		onError: toastErr,
	});

	const gafUndeliveredMut = useMutation({
		mutationFn: () => {
			if (!selectedId) throw new Error(t('admin.noSurveySelected'));
			return adminQueueSurveyGafNotify(selectedId, 'undelivered');
		},
		onSuccess: () => toast.success(t('admin.gafQueuedUndelivered')),
		onError: toastErr,
	});

	const gafRemindMut = useMutation({
		mutationFn: () => {
			if (!selectedId) throw new Error(t('admin.noSurveySelected'));
			return adminQueueSurveyGafNotify(selectedId, 'incomplete');
		},
		onSuccess: () => toast.success(t('admin.gafQueuedRemind')),
		onError: toastErr,
	});

	const toggleId = (list: string[], id: string): string[] =>
		list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

	const tabLabels: Record<AdminTab, string> = {
		catalog: t('admin.tabs.catalog'),
		'ai-create': t('admin.tabs.aiCreate'),
		editor: t('admin.tabs.editor'),
		audience: t('admin.tabs.audience'),
		results: t('admin.tabs.results'),
	};

	const publishBlockedReason =
		!survey || !isDraft
			? t('admin.publishGuard.notDraft')
			: !(survey.questions ?? []).length
				? t('admin.publishGuard.noQuestions')
				: !groupIds.length && !userIds.length
					? t('admin.publishGuard.noAudience')
					: null;

	const rewardConfigured =
		(Number.parseInt(rewardUgs, 10) || 0) > 0 ||
		(Number.parseInt(rewardEw, 10) || 0) > 0 ||
		(Number.parseInt(rewardCoins, 10) || 0) > 0;

	const checklist = (
		<SurveyAdminPublishChecklist
			title={title}
			questionCount={questions.length}
			groupCount={groupIds.length}
			userCount={userIds.length}
			previewCount={previewCount}
			rewardConfigured={rewardConfigured}
		/>
	);

	const publishReadiness = React.useMemo(
		() =>
			computePublishReadiness({
				title,
				questionCount: questions.length,
				groupCount: groupIds.length,
				userCount: userIds.length,
				previewCount,
				rewardConfigured,
			}),
		[
			title,
			questions.length,
			groupIds.length,
			userIds.length,
			previewCount,
			rewardConfigured,
		]
	);

	const userPreviewSurvey = React.useMemo(() => {
		if (!selectedId) return null;
		const preview = buildAdminUserPreviewDetail({
			surveyId: selectedId,
			title,
			descriptionUser,
			rewardUgs,
			rewardEw,
			rewardCoins,
			questions,
		});
		if (!preview) return null;
		return {
			...preview,
			closes_at: surveyDatetimeLocalValueToIso(closesAtLocal),
		};
	}, [
		selectedId,
		title,
		descriptionUser,
		rewardUgs,
		rewardEw,
		rewardCoins,
		questions,
		closesAtLocal,
	]);

	const publishedCompletionRate =
		survey?.status === 'published' &&
		(survey.eligible_count ?? null) !== null &&
		(survey.eligible_count ?? 0) > 0
			? (survey.completed_count ?? 0) / (survey.eligible_count ?? 1)
			: null;

	const showDraftActionBar =
		Boolean(selectedId && survey && isDraft) &&
		(tab === 'editor' || tab === 'audience');

	const items = listQ.data?.items ?? [];
	const catalogSummary = React.useMemo(
		() => summarizeAdminCatalog(items),
		[items]
	);
	const visibleCatalogItems = React.useMemo(
		() =>
			filterAdminCatalogSurveys(items, {
				query: catalogQuery,
				statusFilter: '',
			}),
		[items, catalogQuery]
	);
	const groups = groupsQ.data ?? [];
	const users = usersQ.data ?? [];
	const userLookup = React.useMemo(() => buildSurveyUserLookup(users), [users]);

	const needsSurveySelection =
		(tab === 'editor' || tab === 'audience' || tab === 'results') &&
		!selectedId;

	const workflowTab =
		tab === 'editor' || tab === 'audience' || tab === 'results' ? tab : null;

	return (
		<AdminSectionFrame variant="full" className="flex flex-col gap-4">
			<nav className="flex flex-wrap gap-2" aria-label={t('admin.tabsAria')}>
				{(Object.keys(tabLabels) as AdminTab[]).map((id) => (
					<button
						key={id}
						type="button"
						className={cn(
							DESKTOP_INTERACTIVE.btnRounded,
							'px-3 py-1.5 text-sm',
							tab === id
								? 'bg-violet-600/30 text-white ring-1 ring-violet-400/40'
								: 'bg-white/4 text-slate-300 hover:bg-white/8'
						)}
						onClick={() => setTab(id)}
					>
						{tabLabels[id]}
					</button>
				))}
			</nav>

			{tab === 'catalog' ? (
				<SurveyAdminCatalogPanel
					summary={catalogSummary}
					query={catalogQuery}
					statusFilter={statusFilter}
					onQueryChange={setCatalogQuery}
					onStatusChange={setStatusFilter}
					isLoading={listQ.isLoading}
					isError={listQ.isError}
					isRefreshing={listQ.isFetching}
					onRefresh={() => void listQ.refetch()}
					allItems={items}
					visibleItems={visibleCatalogItems}
					selectedId={selectedId}
					createPending={createMut.isPending}
					duplicatePending={duplicateMut.isPending}
					onCreate={() => createMut.mutate()}
					onOpenAiCreate={() => setTab('ai-create')}
					onOpenSurvey={(surveyId) => {
						setSelectedId(surveyId);
						setTab('editor');
					}}
					onDuplicate={(surveyId) => duplicateMut.mutate(surveyId)}
				/>
			) : null}

			{tab === 'ai-create' ? (
				<SurveyAdminAiCreatePanel
					groups={groups}
					users={users}
					onCreated={(surveyId) => {
						void qc.invalidateQueries({ queryKey: ['admin-surveys'] });
						setSelectedId(surveyId);
						setTab('editor');
					}}
				/>
			) : null}

			{needsSurveySelection ? (
				<DesktopAppPanel className="p-4">
					<p className={DESKTOP_TYPOGRAPHY.meta}>{t('admin.selectSurvey')}</p>
					<div className="mt-3 flex flex-wrap gap-2">
						<DesktopAppButton
							type="button"
							size="sm"
							variant="neutral"
							onClick={() => setTab('catalog')}
						>
							{t('admin.tabs.catalog')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							size="sm"
							variant="accent"
							onClick={() => setTab('ai-create')}
						>
							{t('admin.aiCreate.tabButton')}
						</DesktopAppButton>
					</div>
				</DesktopAppPanel>
			) : null}

			{selectedId && survey && workflowTab ? (
				<SurveyAdminWorkflowStrip
					active={workflowTab}
					surveyTitle={survey.title}
					status={survey.status}
					questionCount={questions.length}
					eligibleCount={previewCount ?? survey.eligible_count}
					readinessReady={publishReadiness.readyCount}
					readinessTotal={publishReadiness.totalCount}
					completedCount={survey.completed_count ?? 0}
					completionRate={
						survey.status === 'draft'
							? publishReadiness.completionRate
							: publishedCompletionRate
					}
					onSelect={(next) => setTab(next)}
				/>
			) : null}

			{selectedId && survey?.status === 'published' ? (
				<SurveyAdminPublishedToolbar
					closesAt={survey.closes_at}
					savePending={savePublishedDeadlineMut.isPending}
					archivePending={archiveMut.isPending}
					gafUndeliveredPending={gafUndeliveredMut.isPending}
					gafRemindPending={gafRemindMut.isPending}
					onSaveDeadline={(closesAtIso) =>
						savePublishedDeadlineMut.mutate(closesAtIso)
					}
					onGafUndelivered={() => gafUndeliveredMut.mutate()}
					onGafRemind={() => gafRemindMut.mutate()}
					onArchive={() => archiveMut.mutate()}
				/>
			) : null}

			{selectedId && tab === 'editor' ? (
				<DesktopAppPanel className="space-y-4 p-4">
					{!isDraft ? (
						<p className={DESKTOP_TYPOGRAPHY.meta}>
							{t('admin.publishGuard.notDraft')}
						</p>
					) : null}
					<label className="block space-y-1">
						<span className={DESKTOP_TYPOGRAPHY.caption}>
							{t('admin.title')}
						</span>
						<input
							className={INPUT_CLASS}
							value={title}
							disabled={!isDraft}
							onChange={(e) => setTitle(e.target.value)}
						/>
					</label>
					<label className="block space-y-1">
						<span className={DESKTOP_TYPOGRAPHY.caption}>
							{t('admin.descriptionUser')}
						</span>
						<textarea
							className={cn(INPUT_CLASS, 'min-h-20 resize-y')}
							value={descriptionUser}
							disabled={!isDraft}
							onChange={(e) => setDescriptionUser(e.target.value)}
						/>
					</label>
					<label className="block space-y-1">
						<span className={DESKTOP_TYPOGRAPHY.caption}>
							{t('admin.closesAt')}
						</span>
						<input
							type="datetime-local"
							className={INPUT_CLASS}
							value={closesAtLocal}
							disabled={!isDraft}
							onChange={(e) => setClosesAtLocal(e.target.value)}
						/>
						<p className={DESKTOP_TYPOGRAPHY.caption}>
							{closesAtLocal
								? t('admin.closesAtSet', {
										date:
											formatSurveyDateLabel(
												surveyDatetimeLocalValueToIso(closesAtLocal)
											) ?? closesAtLocal,
									})
								: t('admin.closesAtHint')}
						</p>
					</label>
					<label className="block space-y-1">
						<span className={DESKTOP_TYPOGRAPHY.caption}>
							{t('admin.gafNotifyBody')}
						</span>
						<textarea
							className={cn(INPUT_CLASS, 'min-h-20 resize-y')}
							value={gafNotifyBody}
							disabled={!isDraft}
							maxLength={2000}
							placeholder={t('admin.gafNotifyBodyPlaceholder')}
							onChange={(e) => setGafNotifyBody(e.target.value)}
						/>
						<p className={DESKTOP_TYPOGRAPHY.caption}>
							{t('admin.gafNotifyBodyHint')}
						</p>
					</label>
					<SurveyAdminGafNotifyPreview
						surveyTitle={title}
						template={gafNotifyBody}
					/>
					<div className="grid gap-3 sm:grid-cols-3">
						{(
							[
								{
									key: 'ugs',
									label: t('admin.reward.ugs'),
									val: rewardUgs,
									setVal: setRewardUgs,
								},
								{
									key: 'ew',
									label: t('admin.reward.ew'),
									val: rewardEw,
									setVal: setRewardEw,
								},
								{
									key: 'coins',
									label: t('admin.reward.coins'),
									val: rewardCoins,
									setVal: setRewardCoins,
								},
							] as const
						).map(({ key, label, val, setVal }) => (
							<label key={key} className="block space-y-1">
								<span className={DESKTOP_TYPOGRAPHY.caption}>{label}</span>
								<input
									type="number"
									min={0}
									className={INPUT_CLASS}
									value={val}
									disabled={!isDraft}
									onChange={(e) => setVal(e.target.value)}
								/>
							</label>
						))}
					</div>
					<SurveyAdminSortableQuestionsEditor
						questions={questions}
						onChange={setQuestions}
						isDraft={isDraft}
						editorIssues={editorIssues}
					/>
					{isDraft ? checklist : null}
					<DesktopAppButton
						type="button"
						variant="accent"
						disabled={!isDraft || saveEditorMut.isPending}
						onClick={() => saveEditorMut.mutate()}
					>
						{t('admin.saveEditor')}
					</DesktopAppButton>
					{isDraft ? (
						<DesktopAppButton
							type="button"
							variant="neutral"
							onClick={() => setTab('audience')}
						>
							{t('admin.continueToAudience')}
						</DesktopAppButton>
					) : null}
					{isDraft ? (
						<DesktopAppButton
							type="button"
							variant="ghost"
							disabled={!userPreviewSurvey}
							onClick={() => setUserPreviewOpen(true)}
						>
							{t('admin.draftBar.preview')}
						</DesktopAppButton>
					) : null}
				</DesktopAppPanel>
			) : null}

			{selectedId && tab === 'audience' ? (
				<div className="space-y-4">
					{isDraft ? checklist : null}
					<DesktopAppPanel className="space-y-4 p-4">
						{!isDraft ? (
							<p className={DESKTOP_TYPOGRAPHY.meta}>
								{t('admin.publishGuard.notDraft')}
							</p>
						) : null}
						<div className="block space-y-1">
							<span className={DESKTOP_TYPOGRAPHY.caption}>
								{t('admin.audienceMode')}
							</span>
							<DesktopNativeSelect
								value={audienceMode}
								disabled={!isDraft}
								onChange={(e) => setAudienceMode(e.target.value)}
								className="text-sm"
							>
								{AUDIENCE_MODES.map((mode) => (
									<option
										key={mode}
										value={mode}
										className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
									>
										{t(`admin.audienceModes.${mode}`)}
									</option>
								))}
							</DesktopNativeSelect>
						</div>
						<SurveyAdminAudiencePicker
							groups={groups}
							users={users}
							groupIds={groupIds}
							userIds={userIds}
							disabled={!isDraft}
							onToggleGroup={(id) => setGroupIds((prev) => toggleId(prev, id))}
							onToggleUser={(id) => setUserIds((prev) => toggleId(prev, id))}
						/>
						<div className="flex flex-wrap items-center gap-2">
							<DesktopAppButton
								type="button"
								variant="neutral"
								disabled={!isDraft || saveAudienceMut.isPending}
								onClick={() => saveAudienceMut.mutate()}
							>
								{t('admin.saveAudience')}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="ghost"
								disabled={previewMut.isPending}
								onClick={() => previewMut.mutate()}
							>
								{t('admin.previewAudience')}
							</DesktopAppButton>
							{previewCount !== null ? (
								<span className={DESKTOP_TYPOGRAPHY.meta}>
									{t('admin.previewCount', { count: previewCount })}
								</span>
							) : null}
						</div>
					</DesktopAppPanel>
				</div>
			) : null}

			{selectedId && tab === 'results' ? (
				<DesktopAppPanel className="p-4">
					<SurveysAdminResultsPanel
						surveyId={selectedId}
						surveyTitle={survey?.title ?? ''}
						questions={survey?.questions ?? []}
						userLookup={userLookup}
					/>
				</DesktopAppPanel>
			) : null}

			{showDraftActionBar ? (
				<SurveyAdminDraftActionBar
					readiness={publishReadiness}
					publishBlockedReason={publishBlockedReason}
					publishPending={publishMut.isPending}
					previewDisabled={!userPreviewSurvey}
					onPreview={() => setUserPreviewOpen(true)}
					onPublish={() => publishMut.mutate()}
				/>
			) : null}

			<SurveyAdminUserPreviewDialog
				open={userPreviewOpen}
				survey={userPreviewSurvey}
				onClose={() => setUserPreviewOpen(false)}
			/>
		</AdminSectionFrame>
	);
}
