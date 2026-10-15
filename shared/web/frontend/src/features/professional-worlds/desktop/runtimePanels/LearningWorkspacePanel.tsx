/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Learning workspace: courses for the active vertical and objection role-play coach.
 *
 * Invariants:
 * - Coach SSE is triggered only from explicit user action; stream text renders in AI rail.
 * - Hero surfaces one primary action above the fold; tab bodies stay below progressive disclosure.
 *
 * Related:
 * - components/ProfessionalLearningCoursesPanel.tsx
 */

import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import {
	DesktopAppButton,
	DesktopAppSurface,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';

import { ProfessionalLearningCoursesPanel } from '../components/ProfessionalLearningCoursesPanel';
import {
	ProfessionalWorldsFormField,
	ProfessionalWorldsHeroPanel,
	ProfessionalWorldsInlineHint,
	ProfessionalWorldsProgressRail,
	ProfessionalWorldsTextarea,
	ProfessionalWorldsTrustNote,
	ProfessionalWorldsWorkspacePanel,
	ProfessionalWorldsWorkspaceSection,
	ProfessionalWorldsWorkspaceSubtabs,
} from '../layout';
import { ROLEPLAY_SCENARIOS } from '../realtorLogic';
import type { ProfessionalLearningCourse } from '../types';

export type LearningWorkspacePanelProps = {
	courses: ProfessionalLearningCourse[];
	onCompleteLesson: (lessonId: string) => void | Promise<void>;
	onStartCoach: (
		scenario: (typeof ROLEPLAY_SCENARIOS)[number],
		message: string
	) => void | Promise<void>;
};

export function LearningWorkspacePanel({
	courses,
	onCompleteLesson,
	onStartCoach,
}: LearningWorkspacePanelProps) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const coachFieldIdPrefix = useId();
	const coachScenarioFieldId = `${coachFieldIdPrefix}-scenario`;
	const coachMessageFieldId = `${coachFieldIdPrefix}-message`;
	const [learningWorkspaceTab, setLearningWorkspaceTab] = useState<
		'courses' | 'coach'
	>('courses');
	const [coachScenario, setCoachScenario] = useState<
		(typeof ROLEPLAY_SCENARIOS)[number]
	>('buyer_price_objection');
	const [coachMessage, setCoachMessage] = useState('');

	const learningProgress = useMemo(() => {
		let total = 0;
		let done = 0;
		for (const course of courses) {
			const lessons = course.lessons ?? [];
			total += lessons.length;
			done += lessons.filter((lesson) => lesson.completed).length;
		}
		return { total, done };
	}, [courses]);

	const learningStage = useMemo(() => {
		if (learningProgress.total === 0) return 'empty' as const;
		if (learningProgress.done >= learningProgress.total)
			return 'complete' as const;
		return 'inProgress' as const;
	}, [learningProgress.done, learningProgress.total]);

	const heroCopy = useMemo(() => {
		if (learningStage === 'empty') {
			return {
				title: t('learning.visible.emptyTitle'),
				description: t('learning.visible.emptyDescription'),
			};
		}
		if (learningStage === 'complete') {
			return {
				title: t('learning.visible.completeTitle'),
				description: t('learning.visible.completeDescription'),
			};
		}
		return {
			title: t('learning.visible.inProgressTitle'),
			description: t('learning.visible.inProgressDescription'),
		};
	}, [learningStage, t]);

	const progressItems = useMemo(
		() => [
			{
				id: 'lessons',
				label: t('learning.visible.progressLessons'),
				value:
					learningProgress.total > 0
						? `${learningProgress.done}/${learningProgress.total}`
						: t('learning.visible.progressTodo'),
				complete:
					learningProgress.total > 0 &&
					learningProgress.done >= learningProgress.total,
			},
		],
		[learningProgress.done, learningProgress.total, t]
	);

	const heroPrimaryAction = useMemo(() => {
		if (learningWorkspaceTab === 'coach') {
			return {
				label: t('learning.visible.actions.startCoach'),
				onClick: () => void onStartCoach(coachScenario, coachMessage),
				disabled: !coachMessage.trim(),
			};
		}
		if (learningStage === 'complete') {
			return {
				label: t('learning.visible.actions.openCoach'),
				onClick: () => setLearningWorkspaceTab('coach'),
			};
		}
		if (learningStage === 'inProgress') {
			return {
				label: t('learning.visible.actions.continueLessons'),
				onClick: () => setLearningWorkspaceTab('courses'),
			};
		}
		return undefined;
	}, [
		coachMessage,
		coachScenario,
		learningStage,
		learningWorkspaceTab,
		onStartCoach,
		t,
	]);

	const heroSecondaryAction =
		learningWorkspaceTab === 'courses' &&
		learningStage !== 'empty' &&
		learningStage !== 'complete' ? (
			<DesktopAppButton
				type="button"
				variant="ghost"
				onClick={() => setLearningWorkspaceTab('coach')}
			>
				{t('learning.visible.actions.openCoach')}
			</DesktopAppButton>
		) : learningWorkspaceTab === 'coach' ? (
			<DesktopAppButton
				type="button"
				variant="ghost"
				onClick={() => setLearningWorkspaceTab('courses')}
			>
				{t('learning.tabs.courses')}
			</DesktopAppButton>
		) : undefined;

	return (
		<ProfessionalWorldsWorkspaceSection
			title={t('nav.learning')}
			subtabs={
				<ProfessionalWorldsWorkspaceSubtabs
					active={learningWorkspaceTab}
					ariaLabel={t('learning.workspaceAria')}
					items={[
						{ id: 'courses', label: t('learning.tabs.courses') },
						{ id: 'coach', label: t('learning.tabs.coach') },
					]}
					onSelect={(id) => setLearningWorkspaceTab(id as 'courses' | 'coach')}
				/>
			}
		>
			<ProfessionalWorldsHeroPanel
				eyebrow={t('learning.visible.eyebrow')}
				title={heroCopy.title}
				description={heroCopy.description}
				primaryAction={
					heroPrimaryAction ? (
						<DesktopAppButton
							type="button"
							disabled={heroPrimaryAction.disabled}
							onClick={heroPrimaryAction.onClick}
						>
							{heroPrimaryAction.label}
						</DesktopAppButton>
					) : undefined
				}
				secondaryAction={heroSecondaryAction}
				meta={
					<ProfessionalWorldsProgressRail
						title={t('overview.visible.progress.title')}
						items={progressItems}
					/>
				}
			/>
			<ProfessionalWorldsTrustNote title={t('learning.visible.trustTitle')}>
				{t('learning.visible.trustBody')}
			</ProfessionalWorldsTrustNote>
			{learningWorkspaceTab === 'courses' ? (
				<>
					{learningProgress.total > 0 ? (
						<p className="text-xs text-(--desktop-text-muted)">
							{t('learning.coursesProgressSummary', learningProgress)}
						</p>
					) : null}
					<ProfessionalLearningCoursesPanel
						courses={courses}
						onCompleteLesson={(lessonId) =>
							Promise.resolve(onCompleteLesson(lessonId))
						}
					/>
				</>
			) : null}
			{learningWorkspaceTab === 'coach' ? (
				<ProfessionalWorldsWorkspacePanel
					title={t('coach.title')}
					className="md:max-w-2xl"
				>
					<DesktopAppSurface
						variant="soft"
						padding="md"
						className="text-sm text-(--desktop-text-secondary)"
					>
						{t('coach.intro')}
					</DesktopAppSurface>
					<ProfessionalWorldsFormField
						htmlFor={coachScenarioFieldId}
						label={
							<ProfessionalWorldsInlineHint>
								{t('coach.scenarioLabel')}
							</ProfessionalWorldsInlineHint>
						}
					>
						<DesktopNativeSelect
							id={coachScenarioFieldId}
							value={coachScenario}
							onChange={(event) =>
								setCoachScenario(
									event.target.value as (typeof ROLEPLAY_SCENARIOS)[number]
								)
							}
						>
							{ROLEPLAY_SCENARIOS.map((scenario) => (
								<option key={scenario} value={scenario}>
									{t(`coach.scenarios.${scenario}`)}
								</option>
							))}
						</DesktopNativeSelect>
					</ProfessionalWorldsFormField>
					<ProfessionalWorldsFormField
						htmlFor={coachMessageFieldId}
						label={
							<ProfessionalWorldsInlineHint>
								{t('coach.placeholder')}
							</ProfessionalWorldsInlineHint>
						}
					>
						<ProfessionalWorldsTextarea
							id={coachMessageFieldId}
							value={coachMessage}
							onChange={(event) => setCoachMessage(event.target.value)}
							placeholder={t('coach.placeholder')}
						/>
					</ProfessionalWorldsFormField>
				</ProfessionalWorldsWorkspacePanel>
			) : null}
		</ProfessionalWorldsWorkspaceSection>
	);
}
