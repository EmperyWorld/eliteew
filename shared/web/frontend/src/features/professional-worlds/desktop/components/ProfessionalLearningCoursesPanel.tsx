/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Renders the Professional Worlds «Courses» learning tab: catalog from API, per-lesson materials (markdown), practice hints, and completion.
 *
 * Invariants:
 * - Lesson bodies render through sanitized Markdown; completion is delegated to the parent (`onCompleteLesson`).
 * - Empty catalog shows a single empty state, not a blank panel.
 *
 * Related:
 * - ProfessionalWorldsApp.tsx
 * - api.ts (`loadProfessionalWorldsSnapshot`, `completeLearningLesson`)
 */
import { useCallback, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { sanitizeMarkdownHref } from '@/utils/markdownSecurity';

import { ProfessionalWorldsWorkspacePanel } from '../layout';
import { formatLearningExercise } from '../learningExerciseDisplay';
import { SupportDetailsPanel } from './SupportDetailsPanel';
import type {
	ProfessionalLearningCourse,
	ProfessionalLearningLesson,
} from '../types';

const LESSON_MD_ROOT = cn(
	'prose prose-sm max-w-none min-w-0 break-words [word-break:break-word]',
	DESKTOP_TYPOGRAPHY.body,
	'text-(--desktop-text-secondary)',
	'prose-headings:text-(--desktop-text-primary) prose-headings:font-semibold',
	'prose-p:my-2 prose-p:first:mt-0 prose-p:last:mb-0',
	'prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5',
	'prose-strong:text-(--desktop-text-primary)',
	'prose-code:text-(--desktop-text-primary) prose-code:before:content-none prose-code:after:content-none'
);

function lessonMarkdownSource(lesson: ProfessionalLearningLesson): string {
	const body = lesson.content_md?.trim() ?? '';
	if (body) return body;
	return lesson.summary?.trim() ?? '';
}

function exerciseHasPayload(
	exercise: Record<string, unknown> | undefined
): boolean {
	if (!exercise) {
		return false;
	}
	return Object.keys(exercise).length > 0;
}

export type ProfessionalLearningCoursesPanelProps = {
	courses: ProfessionalLearningCourse[];
	onCompleteLesson: (lessonId: string) => Promise<void>;
};

export function ProfessionalLearningCoursesPanel({
	courses,
	onCompleteLesson,
}: ProfessionalLearningCoursesPanelProps) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const [openLessonId, setOpenLessonId] = useState<string | null>(null);
	const [busyLessonId, setBusyLessonId] = useState<string | null>(null);

	const sortedCourses = useMemo(
		() =>
			[...courses]
				.sort((a, b) => a.sort_order - b.sort_order)
				.map((course) => ({
					...course,
					lessons: [...(course.lessons ?? [])].sort(
						(a, b) => a.sort_order - b.sort_order
					),
				})),
		[courses]
	);

	const levelLabel = useCallback(
		(level: string) => {
			const key = `learning.level.${level}`;
			const translated = t(key);
			return translated === key
				? t('learning.level.other', { level })
				: translated;
		},
		[t]
	);

	const handleComplete = useCallback(
		async (lessonId: string) => {
			setBusyLessonId(lessonId);
			try {
				await onCompleteLesson(lessonId);
			} finally {
				setBusyLessonId(null);
			}
		},
		[onCompleteLesson]
	);

	if (sortedCourses.length === 0) {
		return (
			<ProfessionalWorldsWorkspacePanel title={t('learning.title')}>
				<DesktopAppEmptyState
					description={t('learning.emptyBody')}
					title={t('learning.emptyTitle')}
				/>
			</ProfessionalWorldsWorkspacePanel>
		);
	}

	return (
		<ProfessionalWorldsWorkspacePanel
			title={t('learning.title')}
			className="grid gap-4 p-4"
		>
			<p className="text-xs text-(--desktop-text-muted)">
				{t('learning.subtitle')}
			</p>
			{sortedCourses.map((course) => {
				const total = course.lessons.length;
				const done = course.lessons.filter((l) => l.completed).length;
				return (
					<DesktopAppSurface
						key={course.id}
						variant="soft"
						padding="md"
						className="grid gap-3 shadow-(--desktop-shadow-soft)"
					>
						<div className="flex flex-wrap items-start justify-between gap-2">
							<div className="min-w-0">
								<strong className="text-base text-(--desktop-text-primary)">
									{course.title}
								</strong>
								{course.description ? (
									<p className="mt-1 text-sm text-(--desktop-text-secondary)">
										{course.description}
									</p>
								) : null}
							</div>
							<span className="shrink-0 rounded-(--desktop-radius-sm) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-0.5 text-[11px] uppercase tracking-wide text-(--desktop-text-muted)">
								{levelLabel(course.level)}
							</span>
						</div>
						<p className="text-xs text-(--desktop-text-muted)">
							{t('learning.progress', { done, total })}
						</p>
						<ul className="grid gap-2">
							{course.lessons.map((lesson) => {
								const open = openLessonId === lesson.id;
								const md = lessonMarkdownSource(lesson);
								const showExercise = exerciseHasPayload(lesson.exercise);
								return (
									<li
										key={lesson.id}
										className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40"
									>
										<button
											type="button"
											className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-(--desktop-surface-soft-hover)"
											aria-expanded={open}
											onClick={() =>
												setOpenLessonId((current) =>
													current === lesson.id ? null : lesson.id
												)
											}
										>
											<span className="min-w-0 text-sm font-medium text-(--desktop-text-primary)">
												{lesson.completed ? (
													<span
														className="mr-1.5 text-[rgb(var(--desktop-accent-rgb))]"
														aria-hidden
													>
														✓
													</span>
												) : null}
												<span className="align-middle">{lesson.title}</span>
											</span>
											<span className="shrink-0 text-[11px] text-(--desktop-text-muted)">
												{open
													? t('learning.toggleHide')
													: t('learning.toggleShow')}
											</span>
										</button>
										{open ? (
											<div className="grid gap-3 border-t border-(--desktop-border-subtle) px-3 py-3">
												{lesson.summary ? (
													<p className="text-sm text-(--desktop-text-secondary)">
														{lesson.summary}
													</p>
												) : null}
												{md ? (
													<div>
														<p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-(--desktop-text-muted)">
															{t('learning.materialsHeading')}
														</p>
														<div className={LESSON_MD_ROOT}>
															<ReactMarkdown
																remarkPlugins={[remarkGfm]}
																rehypePlugins={[rehypeSanitize]}
																components={{
																	a: ({ href, children, ...rest }) => {
																		const h = sanitizeMarkdownHref(href);
																		if (!h)
																			return <span {...rest}>{children}</span>;
																		return (
																			<a
																				href={h}
																				target="_blank"
																				rel="noopener noreferrer"
																				{...rest}
																			>
																				{children}
																			</a>
																		);
																	},
																	img: ({ alt }) => (
																		<span className="text-xs text-(--desktop-text-muted)">
																			[{alt?.trim() || 'image'}]
																		</span>
																	),
																}}
															>
																{md}
															</ReactMarkdown>
														</div>
													</div>
												) : null}
												{showExercise ? (
													<div>
														<p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-(--desktop-text-muted)">
															{t('learning.exerciseHeading')}
														</p>
														{(() => {
															const exercise = formatLearningExercise(
																lesson.exercise
															);
															if (exercise.primary) {
																return (
																	<p className="whitespace-pre-wrap text-xs text-(--desktop-text-secondary)">
																		{exercise.primary}
																	</p>
																);
															}
															if (!exercise.raw) {
																return null;
															}
															return (
																<SupportDetailsPanel>
																	<pre className="max-h-48 overflow-auto rounded-(--desktop-radius-sm) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-2 text-xs text-(--desktop-text-secondary)">
																		{JSON.stringify(exercise.raw, null, 2)}
																	</pre>
																</SupportDetailsPanel>
															);
														})()}
													</div>
												) : null}
												<div className="flex flex-wrap justify-end gap-2">
													<DesktopAppButton
														disabled={
															lesson.completed || busyLessonId === lesson.id
														}
														size="sm"
														onClick={() => void handleComplete(lesson.id)}
													>
														{busyLessonId === lesson.id
															? t('learning.completing')
															: t('learning.markComplete')}
													</DesktopAppButton>
												</div>
											</div>
										) : null}
									</li>
								);
							})}
						</ul>
					</DesktopAppSurface>
				);
			})}
		</ProfessionalWorldsWorkspacePanel>
	);
}
