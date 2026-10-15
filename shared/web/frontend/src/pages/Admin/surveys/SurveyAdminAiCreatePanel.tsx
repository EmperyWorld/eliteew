/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * AI-assisted survey creation: brief → LLM draft → edit/audience → create draft survey.
 *
 * Related:
 * - SurveysAdminSection.tsx
 * - api/services/surveys/survey_ai_draft_service.py
 */
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
	DesktopAppButton,
	DesktopAppPanel,
	DesktopAppSkeleton,
	DesktopNativeSelect,
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { SH_HERO_PANEL_CLASS } from '@/features/surveys/desktop/surveyHubLayoutTokens';
import type {
	AccessGroupResponse,
	UserAppAccessGroupResponse,
} from '@/pages/Desktop/services/desktopAdminApi';
import {
	adminCreateSurvey,
	adminReplaceSurveyAudience,
	adminReplaceSurveyQuestions,
	adminSurveyAiDraft,
	type SurveyAiDraft,
} from '@/pages/Desktop/services/productDesktopSurveysApi';
import { SurveyAdminGafNotifyPreview } from './SurveyAdminGafNotifyPreview';
import { SurveyAdminPublishChecklist } from './SurveyAdminPublishChecklist';
import { SurveyAdminSortableQuestionsEditor } from './SurveyAdminSortableQuestionsEditor';
import { SurveyAdminAudiencePicker } from './SurveyAdminAudiencePicker';
import {
	editorStateToAiDraft,
	surveyAiQuestionsToDrafts,
} from './surveyAdminAiUtils';
import {
	validateQuestionDrafts,
	type QuestionDraft,
	type QuestionValidationIssue,
} from './surveyAdminEditorUtils';

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

type Props = {
	groups: AccessGroupResponse[];
	users: UserAppAccessGroupResponse[];
	onCreated: (surveyId: string) => void;
};

function toggleId(list: string[], id: string): string[] {
	return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function applyAiDraft(draft: SurveyAiDraft): {
	title: string;
	descriptionUser: string;
	gafNotifyBody: string;
	rewardUgs: string;
	rewardEw: string;
	rewardCoins: string;
	questions: QuestionDraft[];
} {
	return {
		title: draft.title,
		descriptionUser: draft.description_user,
		gafNotifyBody: draft.gaf_notify_body_template ?? '',
		rewardUgs: String(draft.reward?.ugs_credits ?? 0),
		rewardEw: String(draft.reward?.ew_balance ?? 0),
		rewardCoins: String(draft.reward?.web_search_coins ?? 0),
		questions: surveyAiQuestionsToDrafts(draft.questions),
	};
}

export function SurveyAdminAiCreatePanel({
	groups,
	users,
	onCreated,
}: Props): React.ReactElement {
	const { t } = useTranslation('surveys');
	const [brief, setBrief] = React.useState('');
	const [supplement, setSupplement] = React.useState('');
	const [hasDraft, setHasDraft] = React.useState(false);
	const [title, setTitle] = React.useState('');
	const [descriptionUser, setDescriptionUser] = React.useState('');
	const [gafNotifyBody, setGafNotifyBody] = React.useState('');
	const [rewardUgs, setRewardUgs] = React.useState('0');
	const [rewardEw, setRewardEw] = React.useState('0');
	const [rewardCoins, setRewardCoins] = React.useState('0');
	const [questions, setQuestions] = React.useState<QuestionDraft[]>([]);
	const [audienceMode, setAudienceMode] = React.useState('groups_or_users');
	const [groupIds, setGroupIds] = React.useState<string[]>([]);
	const [userIds, setUserIds] = React.useState<string[]>([]);
	const [editorIssues, setEditorIssues] = React.useState<
		QuestionValidationIssue[]
	>([]);

	const generateMut = useMutation({
		mutationFn: () =>
			adminSurveyAiDraft({
				brief: brief.trim(),
				mode: 'create',
			}),
		onSuccess: (draft) => {
			const next = applyAiDraft(draft);
			setTitle(next.title);
			setDescriptionUser(next.descriptionUser);
			setGafNotifyBody(next.gafNotifyBody);
			setRewardUgs(next.rewardUgs);
			setRewardEw(next.rewardEw);
			setRewardCoins(next.rewardCoins);
			setQuestions(next.questions);
			setHasDraft(true);
			setEditorIssues([]);
			toast.success(t('admin.aiCreate.generated'));
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
	});

	const refineMut = useMutation({
		mutationFn: () => {
			const draft = editorStateToAiDraft({
				title,
				descriptionUser,
				gafNotifyBody,
				rewardUgs,
				rewardEw,
				rewardCoins,
				questions,
			});
			const extra = supplement.trim() || brief.trim();
			return adminSurveyAiDraft({
				brief: extra,
				mode: 'refine',
				draft,
				supplement: supplement.trim() || undefined,
			});
		},
		onSuccess: (draft) => {
			const next = applyAiDraft(draft);
			setTitle(next.title);
			setDescriptionUser(next.descriptionUser);
			setGafNotifyBody(next.gafNotifyBody);
			setRewardUgs(next.rewardUgs);
			setRewardEw(next.rewardEw);
			setRewardCoins(next.rewardCoins);
			setQuestions(next.questions);
			setEditorIssues([]);
			toast.success(t('admin.aiCreate.refined'));
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
	});

	const createMut = useMutation({
		mutationFn: async () => {
			if (!title.trim()) {
				throw new Error(t('admin.validation.title'));
			}
			const issues = validateQuestionDrafts(questions);
			if (issues.length) {
				setEditorIssues(issues);
				throw new Error(t('admin.validation.summary'));
			}
			if (!groupIds.length && !userIds.length) {
				throw new Error(t('admin.publishGuard.noAudience'));
			}
			const reward = {
				ugs_credits: Math.max(0, Number.parseInt(rewardUgs, 10) || 0),
				ew_balance: Math.max(0, Number.parseInt(rewardEw, 10) || 0),
				web_search_coins: Math.max(0, Number.parseInt(rewardCoins, 10) || 0),
			};
			const created = await adminCreateSurvey({
				title: title.trim(),
				description_user: descriptionUser,
				audience_mode: audienceMode,
				reward,
				gaf_notify_body_template: gafNotifyBody.trim() || null,
				sort_order: 0,
			});
			await adminReplaceSurveyQuestions(
				created.id,
				editorStateToAiDraft({
					title,
					descriptionUser,
					gafNotifyBody,
					rewardUgs,
					rewardEw,
					rewardCoins,
					questions,
				}).questions ?? []
			);
			await adminReplaceSurveyAudience(created.id, {
				audience_mode: audienceMode,
				access_group_ids: groupIds,
				user_ids: userIds,
			});
			return created;
		},
		onSuccess: (created) => {
			toast.success(t('admin.aiCreate.created'));
			onCreated(created.id);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
	});

	const rewardConfigured =
		(Number.parseInt(rewardUgs, 10) || 0) > 0 ||
		(Number.parseInt(rewardEw, 10) || 0) > 0 ||
		(Number.parseInt(rewardCoins, 10) || 0) > 0;

	const aiBusy = generateMut.isPending || refineMut.isPending;

	return (
		<div className="space-y-4">
			<DesktopAppPanel className={cn(SH_HERO_PANEL_CLASS, 'space-y-3 p-5')}>
				<h2 className={DESKTOP_TYPOGRAPHY.subtitle}>
					{t('admin.aiCreate.heading')}
				</h2>
				<p className={DESKTOP_TYPOGRAPHY.meta}>{t('admin.aiCreate.hint')}</p>
				<label className="block space-y-1">
					<span className={DESKTOP_TYPOGRAPHY.caption}>
						{t('admin.aiCreate.brief')}
					</span>
					<textarea
						className={cn(INPUT_CLASS, 'min-h-32 resize-y')}
						value={brief}
						placeholder={t('admin.aiCreate.briefPlaceholder')}
						onChange={(e) => setBrief(e.target.value)}
					/>
				</label>
				<DesktopAppButton
					type="button"
					variant="accent"
					disabled={brief.trim().length < 10 || aiBusy}
					onClick={() => generateMut.mutate()}
				>
					{generateMut.isPending
						? t('admin.aiCreate.generating')
						: t('admin.aiCreate.generate')}
				</DesktopAppButton>
			</DesktopAppPanel>

			{aiBusy && !hasDraft ? (
				<div className="space-y-3">
					<DesktopAppSkeleton className="h-8 w-64" />
					<DesktopAppSkeleton className="h-48 w-full rounded-(--desktop-radius-lg)" />
				</div>
			) : null}

			{hasDraft ? (
				<>
					<DesktopAppPanel className="space-y-4 p-4">
						<h3 className={DESKTOP_TYPOGRAPHY.subtitle}>
							{t('admin.aiCreate.draftHeading')}
						</h3>
						<label className="block space-y-1">
							<span className={DESKTOP_TYPOGRAPHY.caption}>
								{t('admin.title')}
							</span>
							<input
								className={INPUT_CLASS}
								value={title}
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
								onChange={(e) => setDescriptionUser(e.target.value)}
							/>
						</label>
						<label className="block space-y-1">
							<span className={DESKTOP_TYPOGRAPHY.caption}>
								{t('admin.gafNotifyBody')}
							</span>
							<textarea
								className={cn(INPUT_CLASS, 'min-h-16 resize-y')}
								value={gafNotifyBody}
								maxLength={2000}
								onChange={(e) => setGafNotifyBody(e.target.value)}
							/>
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
										onChange={(e) => setVal(e.target.value)}
									/>
								</label>
							))}
						</div>
						<SurveyAdminSortableQuestionsEditor
							questions={questions}
							onChange={setQuestions}
							isDraft
							editorIssues={editorIssues}
						/>
					</DesktopAppPanel>

					<DesktopAppPanel className="space-y-3 p-4">
						<h3 className={DESKTOP_TYPOGRAPHY.subtitle}>
							{t('admin.aiCreate.refineHeading')}
						</h3>
						<p className={DESKTOP_TYPOGRAPHY.meta}>
							{t('admin.aiCreate.refineHint')}
						</p>
						<textarea
							className={cn(INPUT_CLASS, 'min-h-24 resize-y')}
							value={supplement}
							placeholder={t('admin.aiCreate.refinePlaceholder')}
							onChange={(e) => setSupplement(e.target.value)}
						/>
						<DesktopAppButton
							type="button"
							variant="neutral"
							disabled={
								(supplement.trim().length < 10 && brief.trim().length < 10) ||
								aiBusy
							}
							onClick={() => refineMut.mutate()}
						>
							{refineMut.isPending
								? t('admin.aiCreate.refining')
								: t('admin.aiCreate.refine')}
						</DesktopAppButton>
					</DesktopAppPanel>

					<DesktopAppPanel className="space-y-4 p-4">
						<h3 className={DESKTOP_TYPOGRAPHY.subtitle}>
							{t('admin.tabs.audience')}
						</h3>
						<div className="block space-y-1">
							<span className={DESKTOP_TYPOGRAPHY.caption}>
								{t('admin.audienceMode')}
							</span>
							<DesktopNativeSelect
								value={audienceMode}
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
							onToggleGroup={(id) => setGroupIds((prev) => toggleId(prev, id))}
							onToggleUser={(id) => setUserIds((prev) => toggleId(prev, id))}
						/>
					</DesktopAppPanel>

					<SurveyAdminPublishChecklist
						title={title}
						questionCount={questions.length}
						groupCount={groupIds.length}
						userCount={userIds.length}
						previewCount={null}
						rewardConfigured={rewardConfigured}
					/>

					<DesktopAppButton
						type="button"
						variant="accent"
						disabled={createMut.isPending || aiBusy}
						onClick={() => createMut.mutate()}
					>
						{createMut.isPending
							? t('admin.aiCreate.creating')
							: t('admin.aiCreate.create')}
					</DesktopAppButton>
				</>
			) : null}
		</div>
	);
}
