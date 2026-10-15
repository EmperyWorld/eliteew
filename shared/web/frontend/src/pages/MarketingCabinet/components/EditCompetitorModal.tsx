import * as React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppInput,
	DESKTOP_APP_STYLE_CONTRACT,
} from '../../Desktop/components/DesktopAppChrome';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_TYPOGRAPHY,
} from '../../Desktop/constants';
import { useEmbeddedPortaledModalZIndex } from '../../Desktop/context/DesktopWindowPortalStackContext';
import { FieldLabel } from './FieldLabel';
import { MarketingCabinetSelect } from './MarketingCabinetSelect';
import { INPUT_STACK_CLASS, TEXTAREA_CLASS } from '../constants';
import type {
	MarketingCompetitor,
	UpdateCompetitorPayload,
} from '../marketingCabinetApi';
import { cn } from '@/utils/cn';
import { localizeCompetitorType } from '../locales';
import { useMarketingDialogFocusTrap } from '../hooks/useMarketingDialogFocusTrap';
import { isValidUrl, parseMultilineList } from '../utils';

interface EditCompetitorModalProps {
	isOpen: boolean;
	competitor: MarketingCompetitor | null;
	onSave: (payload: UpdateCompetitorPayload) => void;
	onCancel: () => void;
	isLoading?: boolean;
}

function linesFromList(items: string[] | undefined): string {
	return (items ?? []).join('\n');
}

export function EditCompetitorModal({
	isOpen,
	competitor,
	onSave,
	onCancel,
	isLoading = false,
}: EditCompetitorModalProps) {
	const { t } = useTranslation('marketing');
	const formRef = useRef<HTMLFormElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const baseId = useId().replace(/:/g, '');
	const titleId = `${baseId}-title`;
	const subtitleId = `${baseId}-subtitle`;
	const kbdHintId = `${baseId}-kbd-hint`;
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const [competitorType, setCompetitorType] = useState('direct');
	useMarketingDialogFocusTrap(panelRef, isOpen && Boolean(competitor));

	useEffect(() => {
		if (competitor) {
			setCompetitorType(competitor.competitor_type ?? 'direct');
		}
	}, [competitor?.id, competitor?.competitor_type, competitor]);

	useEffect(() => {
		if (!isOpen) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen || !competitor) return;
		const form = formRef.current;
		if (!form) return;
		const el = form.elements.namedItem('name');
		if (el instanceof HTMLInputElement) {
			el.focus();
		}
	}, [isOpen, competitor?.id, competitor]);

	if (!isOpen || !competitor) return null;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (isLoading) return;
		const form = formRef.current;
		if (!form) return;
		const fd = new FormData(form);
		const name = ((fd.get('name') as string) ?? '').trim();
		if (!name) return;
		const websiteRaw = ((fd.get('website') as string) ?? '').trim();
		if (websiteRaw && !isValidUrl(websiteRaw)) return;

		onSave({
			name,
			website: websiteRaw || null,
			description: ((fd.get('description') as string) ?? '').trim() || null,
			competitor_type: (fd.get('competitor_type') as string) || undefined,
			market_position:
				((fd.get('market_position') as string) ?? '').trim() || null,
			pricing_strategy:
				((fd.get('pricing_strategy') as string) ?? '').trim() || null,
			strengths: parseMultilineList((fd.get('strengths') as string) ?? ''),
			weaknesses: parseMultilineList((fd.get('weaknesses') as string) ?? ''),
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
				className="flex max-h-[min(90vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-(--desktop-radius-xl) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) shadow-(--desktop-shadow-panel) backdrop-blur-2xl outline-none focus:outline-none"
				style={{ zIndex: embeddedModalZ.content }}
				tabIndex={-1}
			>
				<header className="flex shrink-0 items-start justify-between gap-3 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 px-5 py-4 sm:px-6">
					<div className="min-w-0 flex-1">
						<h2
							id={titleId}
							className="text-lg font-semibold tracking-tight text-(--desktop-text-primary)"
						>
							{t('editCompetitorModal.title')}
						</h2>
						<p
							id={subtitleId}
							className={cn(DESKTOP_TYPOGRAPHY.meta, 'mt-1 line-clamp-2')}
							title={competitor.name ?? undefined}
						>
							{competitor.name}
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
						aria-label={t('editCompetitorModal.closeAria')}
					>
						<XMarkIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					</DesktopAppButton>
				</header>

				<form
					ref={formRef}
					key={competitor.id}
					onSubmit={handleSubmit}
					className="flex min-h-0 flex-1 flex-col"
				>
					<div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-y-contain px-5 py-4 sm:px-6 sm:py-5">
						<FieldLabel label={t('editCompetitorModal.fieldName')} required>
							<DesktopAppInput
								name="name"
								defaultValue={competitor.name ?? ''}
								placeholder={t('editCompetitorModal.phName')}
								className={DESKTOP_INTERACTIVE.inputFocus}
								required
								disabled={isLoading}
							/>
						</FieldLabel>
						<div className={INPUT_STACK_CLASS}>
							<FieldLabel label={t('editCompetitorModal.fieldWebsite')}>
								<DesktopAppInput
									name="website"
									defaultValue={competitor.website ?? ''}
									placeholder={t('editCompetitorModal.phWebsite')}
									className={DESKTOP_INTERACTIVE.inputFocus}
									disabled={isLoading}
								/>
							</FieldLabel>
							<FieldLabel label={t('editCompetitorModal.fieldType')}>
								<MarketingCabinetSelect
									name="competitor_type"
									value={competitorType}
									onChange={setCompetitorType}
									disabled={isLoading}
									options={[
										{
											value: 'direct',
											label: localizeCompetitorType('direct'),
										},
										{
											value: 'indirect',
											label: localizeCompetitorType('indirect'),
										},
										{
											value: 'adjacent',
											label: localizeCompetitorType('adjacent'),
										},
										{
											value: 'replacement',
											label: localizeCompetitorType('replacement'),
										},
									]}
								/>
							</FieldLabel>
						</div>
						<div className={INPUT_STACK_CLASS}>
							<FieldLabel label={t('editCompetitorModal.fieldMarketPosition')}>
								<DesktopAppInput
									name="market_position"
									defaultValue={competitor.market_position ?? ''}
									placeholder={t('editCompetitorModal.phMarketPosition')}
									className={DESKTOP_INTERACTIVE.inputFocus}
									disabled={isLoading}
								/>
							</FieldLabel>
							<FieldLabel label={t('editCompetitorModal.fieldPricing')}>
								<DesktopAppInput
									name="pricing_strategy"
									defaultValue={competitor.pricing_strategy ?? ''}
									placeholder={t('editCompetitorModal.phPricing')}
									className={DESKTOP_INTERACTIVE.inputFocus}
									disabled={isLoading}
								/>
							</FieldLabel>
						</div>
						<FieldLabel label={t('editCompetitorModal.fieldDescription')}>
							<textarea
								name="description"
								className={cn(TEXTAREA_CLASS, DESKTOP_INTERACTIVE.inputFocus)}
								defaultValue={competitor.description ?? ''}
								rows={3}
								disabled={isLoading}
							/>
						</FieldLabel>
						<div className="grid gap-4 sm:grid-cols-2">
							<FieldLabel
								label={t('editCompetitorModal.fieldStrengths')}
								hint={t('editCompetitorModal.hintList')}
							>
								<textarea
									name="strengths"
									className={cn(TEXTAREA_CLASS, DESKTOP_INTERACTIVE.inputFocus)}
									defaultValue={linesFromList(competitor.strengths)}
									rows={4}
									disabled={isLoading}
								/>
							</FieldLabel>
							<FieldLabel
								label={t('editCompetitorModal.fieldWeaknesses')}
								hint={t('editCompetitorModal.hintList')}
							>
								<textarea
									name="weaknesses"
									className={cn(TEXTAREA_CLASS, DESKTOP_INTERACTIVE.inputFocus)}
									defaultValue={linesFromList(competitor.weaknesses)}
									rows={4}
									disabled={isLoading}
								/>
							</FieldLabel>
						</div>
					</div>

					<footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 px-5 py-3.5 sm:px-6">
						<span
							className={cn(
								'mr-auto hidden sm:inline',
								DESKTOP_APP_STYLE_CONTRACT.helperText
							)}
						>
							{t('editCompetitorModal.escapeHint')}
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
									{t('editCompetitorModal.saving')}
								</>
							) : (
								t('editCompetitorModal.save')
							)}
						</DesktopAppButton>
					</footer>
				</form>
			</div>
		</div>
	);
}
