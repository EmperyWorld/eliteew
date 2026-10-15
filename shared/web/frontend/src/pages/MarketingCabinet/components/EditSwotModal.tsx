import * as React from 'react';
import { useEffect, useId, useRef } from 'react';
import { ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppInput,
	DesktopAppSectionLabel,
	DESKTOP_APP_STYLE_CONTRACT,
} from '../../Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_TYPOGRAPHY,
} from '../../Desktop/constants';
import { useEmbeddedPortaledModalZIndex } from '../../Desktop/context/DesktopWindowPortalStackContext';
import { FieldLabel } from './FieldLabel';
import { TEXTAREA_CLASS } from '../constants';
import type {
	MarketingSwot,
	MarketingSwotFactor,
	SwotFactorInput,
	UpdateSwotPayload,
} from '../marketingCabinetApi';
import { useMarketingDialogFocusTrap } from '../hooks/useMarketingDialogFocusTrap';
import { parseMultilineList } from '../utils';

function swotFactorsToMultiline(factors: MarketingSwotFactor[]): string {
	return factors
		.map((f) => f.factor_text)
		.filter(Boolean)
		.join('\n');
}

function buildSwotFactors(
	source: string,
	impact_level: string
): SwotFactorInput[] {
	return parseMultilineList(source).map((factor, index) => ({
		factor_text: factor,
		impact_level,
		priority_score: Math.max(30, 100 - index * 12),
	}));
}

const QUADRANT_FIELDS = [
	{
		name: 'strengths' as const,
		labelKey: 'editSwotModal.quadrants.strengths.label',
		hintKey: 'editSwotModal.quadrants.strengths.hint',
		accentClass: 'border-l-[3px] border-l-(--mc-accent-55) bg-(--mc-accent-08)',
	},
	{
		name: 'weaknesses' as const,
		labelKey: 'editSwotModal.quadrants.weaknesses.label',
		hintKey: 'editSwotModal.quadrants.weaknesses.hint',
		accentClass: 'border-l-[3px] border-l-amber-600/55 bg-amber-950/[0.28]',
	},
	{
		name: 'opportunities' as const,
		labelKey: 'editSwotModal.quadrants.opportunities.label',
		hintKey: 'editSwotModal.quadrants.opportunities.hint',
		accentClass: 'border-l-[3px] border-l-sky-500/50 bg-sky-950/[0.24]',
	},
	{
		name: 'threats' as const,
		labelKey: 'editSwotModal.quadrants.threats.label',
		hintKey: 'editSwotModal.quadrants.threats.hint',
		accentClass: 'border-l-[3px] border-l-red-500/55 bg-red-950/[0.24]',
	},
];

function factorsForField(
	swot: MarketingSwot,
	field: (typeof QUADRANT_FIELDS)[number]['name']
): MarketingSwotFactor[] {
	const factors = swot.factors;
	switch (field) {
		case 'strengths':
			return factors?.strength ?? [];
		case 'weaknesses':
			return factors?.weakness ?? [];
		case 'opportunities':
			return factors?.opportunity ?? [];
		case 'threats':
			return factors?.threat ?? [];
		default:
			return [];
	}
}

interface EditSwotModalProps {
	isOpen: boolean;
	swot: MarketingSwot | null;
	onSave: (payload: UpdateSwotPayload) => void;
	onCancel: () => void;
	isLoading?: boolean;
}

export function EditSwotModal({
	isOpen,
	swot,
	onSave,
	onCancel,
	isLoading = false,
}: EditSwotModalProps) {
	const { t } = useTranslation('marketing');
	const formRef = useRef<HTMLFormElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const titleRef = useRef<HTMLInputElement>(null);
	const baseId = useId().replace(/:/g, '');
	const titleId = `${baseId}-title`;
	const subtitleId = `${baseId}-subtitle`;
	const kbdHintId = `${baseId}-kbd-hint`;
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	useMarketingDialogFocusTrap(panelRef, isOpen && Boolean(swot));

	useEffect(() => {
		if (!isOpen) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	}, [isOpen]);

	useEffect(() => {
		if (isOpen && swot) {
			titleRef.current?.focus();
		}
	}, [isOpen, swot?.id, swot]);

	if (!isOpen || !swot) return null;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (isLoading) return;
		const form = formRef.current;
		if (!form) return;
		const fd = new FormData(form);
		const title = ((fd.get('title') as string) ?? '').trim();

		const strengths = (fd.get('strengths') as string) ?? '';
		const weaknesses = (fd.get('weaknesses') as string) ?? '';
		const opportunities = (fd.get('opportunities') as string) ?? '';
		const threats = (fd.get('threats') as string) ?? '';

		onSave({
			title,
			description: ((fd.get('description') as string) ?? '').trim() || null,
			executive_summary:
				((fd.get('executive_summary') as string) ?? '').trim() || null,
			company_name: ((fd.get('company_name') as string) ?? '').trim() || null,
			industry: ((fd.get('industry') as string) ?? '').trim() || null,
			strengths: buildSwotFactors(strengths, 'high'),
			weaknesses: buildSwotFactors(weaknesses, 'medium'),
			opportunities: buildSwotFactors(opportunities, 'high'),
			threats: buildSwotFactors(threats, 'critical'),
		});
	};

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
				className="flex max-h-[min(90vh,52rem)] w-full max-w-2xl flex-col overflow-hidden rounded-(--desktop-radius-xl) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) shadow-(--desktop-shadow-panel) backdrop-blur-2xl outline-none focus:outline-none"
				style={{ zIndex: embeddedModalZ.content }}
				tabIndex={-1}
			>
				<header className="flex shrink-0 items-start justify-between gap-3 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 px-5 py-4 sm:px-6">
					<div className="min-w-0 flex-1">
						<h2
							id={titleId}
							className="text-lg font-semibold tracking-tight text-(--desktop-text-primary)"
						>
							{t('editSwotModal.title')}
						</h2>
						<p
							id={subtitleId}
							className={cn(DESKTOP_TYPOGRAPHY.meta, 'mt-1 line-clamp-2')}
							title={swot.title ?? undefined}
						>
							{swot.title}
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
						aria-label={t('editSwotModal.closeAria')}
					>
						<XMarkIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					</DesktopAppButton>
				</header>

				<form
					ref={formRef}
					key={swot.id}
					onSubmit={handleSubmit}
					className="flex min-h-0 flex-1 flex-col"
				>
					<div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-y-contain px-5 py-4 sm:px-6 sm:py-5">
						<div className="space-y-4">
							<DesktopAppSectionLabel>
								{t('editSwotModal.sectionPrimary')}
							</DesktopAppSectionLabel>
							<FieldLabel label={t('editSwotModal.fieldTitle')} required>
								<input
									ref={titleRef}
									name="title"
									defaultValue={swot.title ?? ''}
									placeholder={t('editSwotModal.phTitle')}
									className={cn(
										DESKTOP_APP_STYLE_CONTRACT.searchField,
										DESKTOP_INTERACTIVE.inputFocus,
										'focus:border-(--desktop-border-strong) focus:bg-(--desktop-surface-soft-hover)'
									)}
									required
									minLength={3}
									disabled={isLoading}
								/>
							</FieldLabel>
							<FieldLabel
								label={t('editSwotModal.fieldCompanyIndustry')}
								hint={t('editSwotModal.optionalHint')}
							>
								<div className="grid gap-3 sm:grid-cols-2">
									<DesktopAppInput
										name="company_name"
										defaultValue={swot.company_name ?? ''}
										placeholder={t('editSwotModal.phCompany')}
										className={DESKTOP_INTERACTIVE.inputFocus}
										disabled={isLoading}
									/>
									<DesktopAppInput
										name="industry"
										defaultValue={swot.industry ?? ''}
										placeholder={t('editSwotModal.phIndustry')}
										className={DESKTOP_INTERACTIVE.inputFocus}
										disabled={isLoading}
									/>
								</div>
							</FieldLabel>
							<FieldLabel
								label={t('editSwotModal.fieldDescription')}
								hint={t('editSwotModal.optionalHint')}
							>
								<textarea
									name="description"
									defaultValue={swot.description ?? ''}
									rows={2}
									className={cn(TEXTAREA_CLASS, DESKTOP_INTERACTIVE.inputFocus)}
									disabled={isLoading}
								/>
							</FieldLabel>
							<FieldLabel
								label={t('editSwotModal.fieldExecutiveSummary')}
								hint={t('editSwotModal.optionalHint')}
							>
								<textarea
									name="executive_summary"
									defaultValue={swot.executive_summary ?? ''}
									rows={3}
									className={cn(TEXTAREA_CLASS, DESKTOP_INTERACTIVE.inputFocus)}
									placeholder={t('editSwotModal.phExecutiveSummary')}
									disabled={isLoading}
								/>
							</FieldLabel>
						</div>

						<div className="space-y-4">
							<DesktopAppSectionLabel>
								{t('editSwotModal.sectionQuadrants')}
							</DesktopAppSectionLabel>
							<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'leading-relaxed')}>
								{t('editSwotModal.quadrantsDescription')}
							</p>
							<div className="grid gap-4 md:grid-cols-2">
								{QUADRANT_FIELDS.map((q) => (
									<div
										key={q.name}
										className={cn(
											'rounded-[calc(var(--desktop-radius)-2px)] border border-(--desktop-border-subtle) p-3.5',
											q.accentClass
										)}
									>
										<FieldLabel label={t(q.labelKey)} hint={t(q.hintKey)}>
											<textarea
												name={q.name}
												defaultValue={swotFactorsToMultiline(
													factorsForField(swot, q.name)
												)}
												rows={5}
												className={cn(
													TEXTAREA_CLASS,
													DESKTOP_INTERACTIVE.inputFocus
												)}
												disabled={isLoading}
											/>
										</FieldLabel>
									</div>
								))}
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
							{t('editSwotModal.escapeHint')}
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
									{t('editSwotModal.saving')}
								</>
							) : (
								t('editSwotModal.save')
							)}
						</DesktopAppButton>
					</footer>
				</form>
			</div>
		</div>
	);
}
