import * as React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppInput,
	DesktopAppSectionLabel,
	DesktopAppStatusBadge,
	DESKTOP_APP_STYLE_CONTRACT,
} from '../../Desktop/components/DesktopAppChrome';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_TYPOGRAPHY,
} from '../../Desktop/constants';
import { useEmbeddedPortaledModalZIndex } from '../../Desktop/context/DesktopWindowPortalStackContext';
import { MarketingCabinetSelect } from './MarketingCabinetSelect';
import { cn } from '@/utils/cn';
import { INPUT_STACK_CLASS, TEXTAREA_CLASS } from '../constants';
import { useMarketingDialogFocusTrap } from '../hooks/useMarketingDialogFocusTrap';
import {
	getJtbdScoreSelectOptions,
	localizeJobCategory,
	localizePriority,
} from '../locales';
import type { MarketingJobStory } from '../marketingCabinetApi';

const TITLE_MAX = 240;
const NARRATIVE_MIN = 2;
const NARRATIVE_MAX = 8000;
const MAX_TAGS = 40;
const MAX_TAG_LEN = 64;

function jobScoreToSelectValue(n: number | null | undefined): string {
	if (n == null || !Number.isFinite(Number(n))) return '';
	const r = Math.round(Number(n));
	if (r < 0 || r > 10) return '';
	return String(r);
}

function parseTags(raw: string): string[] {
	return raw
		.split(/[\n,;]+/)
		.map((t) => t.trim())
		.filter(Boolean);
}

/** Graphite “settings table” shell for job editor sections */
const jobSettingsTableWrap =
	'overflow-x-auto overflow-y-hidden rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel)/55 shadow-(--desktop-shadow-soft) backdrop-blur-sm';

const jobSettingsTableTh =
	'w-[min(38%,12.5rem)] max-w-[40%] align-top bg-(--desktop-surface-soft)/50 px-4 py-3 text-left';

const jobSettingsTableTd = 'align-top px-4 py-3';

const jobSettingsRow =
	'border-b border-(--desktop-border-subtle) last:border-b-0';

const jobSettingsTableClass =
	'min-w-[min(100%,18rem)] w-full border-collapse text-sm';

interface EditJobStoryModalProps {
	isOpen: boolean;
	job: MarketingJobStory | null;
	onSave: (payload: {
		title?: string;
		situation?: string;
		motivation?: string;
		expected_outcome?: string;
		category?: string;
		priority?: string;
		importance_score?: number | null;
		satisfaction_score?: number | null;
		tags?: string[];
	}) => void;
	onCancel: () => void;
	isLoading?: boolean;
}

export function EditJobStoryModal({
	isOpen,
	job,
	onSave,
	onCancel,
	isLoading = false,
}: EditJobStoryModalProps) {
	const { t } = useTranslation('marketing');
	const formRef = useRef<HTMLFormElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const summaryErrorRef = useRef<HTMLParagraphElement>(null);
	const baseId = useId().replace(/:/g, '');
	const titleId = `${baseId}-title`;
	const subtitleId = `${baseId}-subtitle`;
	const kbdHintId = `${baseId}-kbd-hint`;
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	useMarketingDialogFocusTrap(panelRef, isOpen && Boolean(job));
	const [jobCategory, setJobCategory] = useState('functional');
	const [jobPriority, setJobPriority] = useState('low');
	const [jobImportance, setJobImportance] = useState('');
	const [jobSatisfaction, setJobSatisfaction] = useState('');
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

	useEffect(() => {
		if (job) {
			setJobCategory(job.category ?? 'functional');
			setJobPriority(job.priority ?? 'low');
			setJobImportance(jobScoreToSelectValue(job.importance_score));
			setJobSatisfaction(jobScoreToSelectValue(job.satisfaction_score));
		}
	}, [
		job?.id,
		job?.category,
		job?.priority,
		job?.importance_score,
		job?.satisfaction_score,
		job,
	]);

	useEffect(() => {
		setFieldErrors({});
	}, []);

	useEffect(() => {
		if (!isOpen) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	}, [isOpen]);

	useEffect(() => {
		if (isOpen && job) {
			const el = formRef.current?.querySelector<HTMLInputElement>(
				'input[name="title"]'
			);
			el?.focus();
		}
	}, [isOpen, job?.id, job]);

	if (!isOpen || !job) return null;

	const validate = (): Record<string, string> => {
		const form = formRef.current;
		const errors: Record<string, string> = {};
		if (!form) return errors;

		const title = (
			(form.elements.namedItem('title') as HTMLInputElement)?.value ?? ''
		).trim();
		if (!title) {
			errors.title = t('editJobStoryModal.validation.titleRequired');
		} else if (title.length > TITLE_MAX) {
			errors.title = t('editJobStoryModal.validation.titleMax', {
				max: TITLE_MAX,
			});
		}

		const checkNarrative = (
			name: 'situation' | 'motivation' | 'outcome',
			labelKey: string
		) => {
			const el = form.elements.namedItem(name) as HTMLTextAreaElement;
			const v = (el?.value ?? '').trim();
			const fieldLabel = t(labelKey);
			if (v.length < NARRATIVE_MIN) {
				errors[name] = t('editJobStoryModal.validation.narrativeMin', {
					field: fieldLabel,
					min: NARRATIVE_MIN,
				});
			} else if (v.length > NARRATIVE_MAX) {
				errors[name] = t('editJobStoryModal.validation.narrativeMax', {
					field: fieldLabel,
					max: NARRATIVE_MAX,
				});
			}
		};

		checkNarrative('situation', 'editJobStoryModal.fieldSituation');
		checkNarrative('motivation', 'editJobStoryModal.fieldMotivation');
		checkNarrative('outcome', 'editJobStoryModal.fieldOutcome');

		const checkScore = (
			value: string,
			key: 'importance_score' | 'satisfaction_score'
		) => {
			if (value === '') return;
			const n = Number(value);
			if (!Number.isInteger(n) || n < 0 || n > 10) {
				errors[key] = t('editJobStoryModal.validation.scoreRange');
			}
		};
		checkScore(jobImportance, 'importance_score');
		checkScore(jobSatisfaction, 'satisfaction_score');

		const tagsRaw =
			(form.elements.namedItem('tags') as HTMLTextAreaElement)?.value ?? '';
		const tags = parseTags(tagsRaw);
		if (tags.length > MAX_TAGS) {
			errors.tags = t('editJobStoryModal.validation.tagsMax', {
				max: MAX_TAGS,
			});
		} else if (tags.some((tag) => tag.length > MAX_TAG_LEN)) {
			errors.tags = t('editJobStoryModal.validation.tagTooLong', {
				max: MAX_TAG_LEN,
			});
		}

		return errors;
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (isLoading) return;
		const form = formRef.current;
		if (!form) return;

		const nextErrors = validate();
		if (Object.keys(nextErrors).length > 0) {
			setFieldErrors(nextErrors);
			requestAnimationFrame(() => {
				summaryErrorRef.current?.scrollIntoView({
					behavior: 'smooth',
					block: 'nearest',
				});
			});
			return;
		}
		setFieldErrors({});

		const fd = new FormData(form);
		onSave({
			title: (fd.get('title') as string)?.trim() || undefined,
			situation: (fd.get('situation') as string)?.trim() || undefined,
			motivation: (fd.get('motivation') as string)?.trim() || undefined,
			expected_outcome: (fd.get('outcome') as string)?.trim() || undefined,
			category: (fd.get('category') as string) || undefined,
			priority: (fd.get('priority') as string) || undefined,
			importance_score: jobImportance === '' ? null : Number(jobImportance),
			satisfaction_score:
				jobSatisfaction === '' ? null : Number(jobSatisfaction),
			tags: parseTags((fd.get('tags') as string) ?? ''),
		});
	};

	const inputErrorRing = (key: string) =>
		fieldErrors[key]
			? 'border-red-500/35 ring-1 ring-red-500/25 focus:border-red-500/45'
			: '';

	return (
		<div
			className={cn(DESKTOP_APP_STYLE_CONTRACT.modalBackdrop, 'p-4')}
			style={{ zIndex: embeddedModalZ.backdrop }}
			role="dialog"
			aria-modal="true"
			aria-labelledby={titleId}
			aria-describedby={`${subtitleId} ${kbdHintId}`}
			onClick={(e) => {
				if (e.target === e.currentTarget) onCancel();
			}}
			onKeyDown={(e) => {
				if (e.key === 'Escape') onCancel();
			}}
		>
			<div
				ref={panelRef}
				className="flex max-h-[min(90vh,44rem)] w-full max-w-lg flex-col overflow-hidden rounded-(--desktop-radius-xl) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) shadow-(--desktop-shadow-panel) backdrop-blur-2xl outline-none focus:outline-none"
				style={{ zIndex: embeddedModalZ.content }}
				tabIndex={-1}
			>
				<header className="flex shrink-0 items-start justify-between gap-3 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 px-5 py-4 sm:px-6">
					<div className="min-w-0 flex-1">
						<h2
							id={titleId}
							className="text-lg font-semibold tracking-tight text-(--desktop-text-primary)"
						>
							{t('editJobStoryModal.title')}
						</h2>
						<p
							id={subtitleId}
							className={cn(DESKTOP_TYPOGRAPHY.meta, 'mt-1 line-clamp-2')}
							title={job.title}
						>
							{job.title}
						</p>
						<p id={kbdHintId} className="sr-only">
							{t('modalKeyboardHint')}
						</p>
					</div>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="icon"
						className={cn('shrink-0', DESKTOP_INTERACTIVE.focusRing)}
						onClick={onCancel}
						disabled={isLoading}
						aria-label={t('editJobStoryModal.closeAria')}
					>
						<XMarkIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					</DesktopAppButton>
				</header>

				<form
					ref={formRef}
					key={job.id}
					onSubmit={handleSubmit}
					noValidate
					className="flex min-h-0 flex-1 flex-col"
				>
					<div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-y-contain px-5 py-4 sm:px-6 sm:py-5">
						<DesktopAppStatusBadge className="w-full justify-start border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-left text-xs font-normal leading-snug text-(--desktop-text-secondary)">
							{t('editJobStoryModal.serverSaveHint')}
						</DesktopAppStatusBadge>

						{Object.keys(fieldErrors).length > 0 ? (
							<p
								ref={summaryErrorRef}
								role="alert"
								className="rounded-xl border border-red-500/25 bg-red-950/30 px-3 py-2 text-sm text-red-200/95"
							>
								{t('editJobStoryModal.validation.fixForm')}
							</p>
						) : null}

						<div className="space-y-2">
							<DesktopAppSectionLabel>
								{t('editJobStoryModal.sectionPrimary')}
							</DesktopAppSectionLabel>
							<div className={jobSettingsTableWrap}>
								<table className={jobSettingsTableClass}>
									<tbody>
										<tr className={jobSettingsRow}>
											<th scope="row" className={jobSettingsTableTh}>
												<span
													className={cn(
														DESKTOP_TYPOGRAPHY.caption,
														'font-semibold text-(--desktop-text-secondary)'
													)}
												>
													{t('editJobStoryModal.fieldTitle')}
												</span>
											</th>
											<td className={jobSettingsTableTd}>
												<DesktopAppInput
													name="title"
													defaultValue={job.title}
													placeholder={t('editJobStoryModal.phTitle')}
													className={cn(
														INPUT_STACK_CLASS,
														inputErrorRing('title'),
														DESKTOP_INTERACTIVE.inputFocus
													)}
													disabled={isLoading}
													aria-invalid={Boolean(fieldErrors.title)}
													aria-describedby={
														fieldErrors.title ? 'edit-job-err-title' : undefined
													}
												/>
												{fieldErrors.title ? (
													<span
														id="edit-job-err-title"
														className="mt-1.5 block text-xs text-red-300/90"
													>
														{fieldErrors.title}
													</span>
												) : null}
											</td>
										</tr>
									</tbody>
								</table>
							</div>
						</div>

						<div className="space-y-2">
							<DesktopAppSectionLabel>
								{t('editJobStoryModal.sectionNarrative')}
							</DesktopAppSectionLabel>
							<div className={jobSettingsTableWrap}>
								<table className={jobSettingsTableClass}>
									<tbody>
										<tr className={jobSettingsRow}>
											<th scope="row" className={jobSettingsTableTh}>
												<span
													className={cn(
														DESKTOP_TYPOGRAPHY.caption,
														'font-semibold text-(--desktop-text-secondary)'
													)}
												>
													{t('editJobStoryModal.fieldSituation')}
												</span>
											</th>
											<td className={jobSettingsTableTd}>
												<textarea
													name="situation"
													defaultValue={job.situation}
													rows={3}
													className={cn(
														TEXTAREA_CLASS,
														inputErrorRing('situation'),
														DESKTOP_INTERACTIVE.inputFocus
													)}
													required
													disabled={isLoading}
													aria-invalid={Boolean(fieldErrors.situation)}
												/>
												{fieldErrors.situation ? (
													<span className="mt-1.5 block text-xs text-red-300/90">
														{fieldErrors.situation}
													</span>
												) : null}
											</td>
										</tr>
										<tr className={jobSettingsRow}>
											<th scope="row" className={jobSettingsTableTh}>
												<span
													className={cn(
														DESKTOP_TYPOGRAPHY.caption,
														'font-semibold text-(--desktop-text-secondary)'
													)}
												>
													{t('editJobStoryModal.fieldMotivation')}
												</span>
											</th>
											<td className={jobSettingsTableTd}>
												<textarea
													name="motivation"
													defaultValue={job.motivation}
													rows={3}
													className={cn(
														TEXTAREA_CLASS,
														inputErrorRing('motivation'),
														DESKTOP_INTERACTIVE.inputFocus
													)}
													required
													disabled={isLoading}
													aria-invalid={Boolean(fieldErrors.motivation)}
												/>
												{fieldErrors.motivation ? (
													<span className="mt-1.5 block text-xs text-red-300/90">
														{fieldErrors.motivation}
													</span>
												) : null}
											</td>
										</tr>
										<tr className={jobSettingsRow}>
											<th scope="row" className={jobSettingsTableTh}>
												<span
													className={cn(
														DESKTOP_TYPOGRAPHY.caption,
														'font-semibold text-(--desktop-text-secondary)'
													)}
												>
													{t('editJobStoryModal.fieldOutcome')}
												</span>
											</th>
											<td className={jobSettingsTableTd}>
												<textarea
													name="outcome"
													defaultValue={job.outcome}
													rows={3}
													className={cn(
														TEXTAREA_CLASS,
														inputErrorRing('outcome'),
														DESKTOP_INTERACTIVE.inputFocus
													)}
													required
													disabled={isLoading}
													aria-invalid={Boolean(fieldErrors.outcome)}
												/>
												{fieldErrors.outcome ? (
													<span className="mt-1.5 block text-xs text-red-300/90">
														{fieldErrors.outcome}
													</span>
												) : null}
											</td>
										</tr>
									</tbody>
								</table>
							</div>
						</div>

						<div className="space-y-2">
							<DesktopAppSectionLabel>
								{t('editJobStoryModal.sectionMetrics')}
							</DesktopAppSectionLabel>
							<div className={jobSettingsTableWrap}>
								<table className={jobSettingsTableClass}>
									<tbody>
										<tr className={jobSettingsRow}>
											<th scope="row" className={jobSettingsTableTh}>
												<span
													className={cn(
														DESKTOP_TYPOGRAPHY.caption,
														'font-semibold text-(--desktop-text-secondary)'
													)}
												>
													{t('editJobStoryModal.fieldCategory')}
												</span>
											</th>
											<td className={jobSettingsTableTd}>
												<MarketingCabinetSelect
													name="category"
													value={jobCategory}
													onChange={setJobCategory}
													disabled={isLoading}
													options={[
														{
															value: 'functional',
															label: localizeJobCategory('functional'),
														},
														{
															value: 'emotional',
															label: localizeJobCategory('emotional'),
														},
														{
															value: 'social',
															label: localizeJobCategory('social'),
														},
														{
															value: 'hybrid',
															label: localizeJobCategory('hybrid'),
														},
													]}
												/>
											</td>
										</tr>
										<tr className={jobSettingsRow}>
											<th scope="row" className={jobSettingsTableTh}>
												<span
													className={cn(
														DESKTOP_TYPOGRAPHY.caption,
														'font-semibold text-(--desktop-text-secondary)'
													)}
												>
													{t('editJobStoryModal.fieldPriority')}
												</span>
											</th>
											<td className={jobSettingsTableTd}>
												<MarketingCabinetSelect
													name="priority"
													value={jobPriority}
													onChange={setJobPriority}
													disabled={isLoading}
													options={[
														{ value: 'low', label: localizePriority('low') },
														{
															value: 'medium',
															label: localizePriority('medium'),
														},
														{ value: 'high', label: localizePriority('high') },
														{
															value: 'critical',
															label: localizePriority('critical'),
														},
													]}
												/>
											</td>
										</tr>
										<tr className={jobSettingsRow}>
											<th scope="row" className={jobSettingsTableTh}>
												<span
													className={cn(
														DESKTOP_TYPOGRAPHY.caption,
														'font-semibold text-(--desktop-text-secondary)'
													)}
												>
													{t('editJobStoryModal.fieldImportance')}
												</span>
											</th>
											<td className={jobSettingsTableTd}>
												<div
													className={cn(
														fieldErrors.importance_score &&
															'rounded-(--desktop-radius) ring-1 ring-red-500/30'
													)}
												>
													<MarketingCabinetSelect
														value={jobImportance}
														onChange={setJobImportance}
														disabled={isLoading}
														options={getJtbdScoreSelectOptions()}
													/>
												</div>
												{fieldErrors.importance_score ? (
													<span className="mt-1.5 block text-xs text-red-300/90">
														{fieldErrors.importance_score}
													</span>
												) : null}
											</td>
										</tr>
										<tr className={jobSettingsRow}>
											<th scope="row" className={jobSettingsTableTh}>
												<span
													className={cn(
														DESKTOP_TYPOGRAPHY.caption,
														'font-semibold text-(--desktop-text-secondary)'
													)}
												>
													{t('editJobStoryModal.fieldSatisfaction')}
												</span>
											</th>
											<td className={jobSettingsTableTd}>
												<div
													className={cn(
														fieldErrors.satisfaction_score &&
															'rounded-(--desktop-radius) ring-1 ring-red-500/30'
													)}
												>
													<MarketingCabinetSelect
														value={jobSatisfaction}
														onChange={setJobSatisfaction}
														disabled={isLoading}
														options={getJtbdScoreSelectOptions()}
													/>
												</div>
												{fieldErrors.satisfaction_score ? (
													<span className="mt-1.5 block text-xs text-red-300/90">
														{fieldErrors.satisfaction_score}
													</span>
												) : null}
											</td>
										</tr>
									</tbody>
								</table>
							</div>
						</div>

						<div className="space-y-2">
							<DesktopAppSectionLabel>
								{t('editJobStoryModal.sectionTags')}
							</DesktopAppSectionLabel>
							<div className={jobSettingsTableWrap}>
								<table className={jobSettingsTableClass}>
									<tbody>
										<tr className={jobSettingsRow}>
											<th scope="row" className={jobSettingsTableTh}>
												<span
													className={cn(
														DESKTOP_TYPOGRAPHY.caption,
														'font-semibold text-(--desktop-text-secondary)'
													)}
												>
													{t('editJobStoryModal.fieldTags')}
												</span>
												<p
													className={cn(
														DESKTOP_TYPOGRAPHY.small,
														'mt-1.5 font-normal normal-case tracking-normal text-(--desktop-text-dim)'
													)}
												>
													{t('editJobStoryModal.hintTags')}
												</p>
											</th>
											<td className={jobSettingsTableTd}>
												<textarea
													name="tags"
													defaultValue={(job.tags ?? []).join('\n')}
													rows={3}
													className={cn(
														TEXTAREA_CLASS,
														inputErrorRing('tags'),
														DESKTOP_INTERACTIVE.inputFocus
													)}
													placeholder={t('editJobStoryModal.phTags')}
													disabled={isLoading}
													aria-invalid={Boolean(fieldErrors.tags)}
												/>
												{fieldErrors.tags ? (
													<span className="mt-1.5 block text-xs text-red-300/90">
														{fieldErrors.tags}
													</span>
												) : null}
											</td>
										</tr>
									</tbody>
								</table>
							</div>
						</div>
					</div>

					<footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 px-5 py-3.5 sm:px-6">
						<span
							className={cn(
								'mr-auto hidden sm:inline',
								DESKTOP_APP_STYLE_CONTRACT.helperText
							)}
						>
							{t('editJobStoryModal.escapeHint')}
						</span>
						<DesktopAppButton
							type="button"
							variant="ghost"
							onClick={onCancel}
							disabled={isLoading}
						>
							{t('common.cancel')}
						</DesktopAppButton>
						<DesktopAppButton
							type="submit"
							variant="accent"
							disabled={isLoading}
						>
							{isLoading ? (
								<>
									<ArrowPathIcon
										className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden="true"
									/>
									{t('editJobStoryModal.saving')}
								</>
							) : (
								t('editJobStoryModal.save')
							)}
						</DesktopAppButton>
					</footer>
				</form>
			</div>
		</div>
	);
}
