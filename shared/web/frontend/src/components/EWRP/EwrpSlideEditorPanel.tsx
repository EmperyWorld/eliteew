/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact UGS actions per slide in the EWRP editor: regenerate image and text.
 *
 * Invariants:
 * - Per-slide buttons disabled while `ewrpSlideEditorJobBusy`; billing follows server.
 *
 * Related:
 * - `ewrpSlideEditorHelpers.ts`, `ewrpHttpErrors.ts`, `ewrpApi.ts`, `EWRPGeneratorMain.tsx`
 */

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useCreativeStudioUgsCosts } from '@/hooks/useCreativeStudioUgsCosts';
import { notify } from '@/notifications';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_OVERLAY,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import {
	getDesktopShellContextMenuClassName,
	getDesktopShellPanelClassName,
} from '@/pages/Desktop/utils/desktopVisualSystem';
import {
	ewrpApi,
	type EwrpSlide,
	type EwrpStatusResponse,
} from '@/services/ewrpApi';
import { cn } from '@/utils/cn';
import {
	ewrpSlideEditorAiDisabled,
	ewrpSlideEditorDisabledTitle,
	isEwrpSlideImagePromptValid,
	parseEwrpStatusResponse,
} from './ewrpSlideEditorHelpers';
import { notifyEwrpHttpError } from './ewrpHttpErrors';
import { useEwrpDialogFocusTrap } from './useEwrpDialogFocusTrap';
import {
	EWRP_SLIDE_REGEN_IMAGE_ENERGY,
	EWRP_SLIDE_REGEN_TEXT_ENERGY,
} from './ewrpSlideRegenEnergy';
import { ewrpZIndexClass } from './ewrpZIndex';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ArrowPathIcon,
	DocumentTextIcon,
	PhotoIcon,
	SparklesIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

const sw = DESKTOP_LUCIDE.stroke;

const ugsMenuItemClass =
	'flex cursor-pointer select-none flex-col gap-0.5 rounded-lg px-2 py-2 text-xs outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-(--desktop-surface-soft-hover)';

export type UseEwrpSlideEditorAiOptions = {
	jobId: string | null;
	status: EwrpStatusResponse | null;
	setStatus: React.Dispatch<React.SetStateAction<EwrpStatusResponse | null>>;
	onPatchDraftSlide: (index: number, patch: Partial<EwrpSlide>) => void;
	resumeActivePolling: () => void;
	secondaryBtnClass: string;
	primaryBtnClass: string;
};

export type EwrpSlideEditorAiControls = {
	/** UGS actions under slide fields */
	renderSlideActions: (slideIndex: number, slide: EwrpSlide) => React.ReactNode;
	/** Modals (mount once next to editor root) */
	modals: React.ReactNode;
};

/**
 * Hook: per-slide UGS buttons + prompt/instruction modals.
 * On successful POST calls resumeActivePolling; parent polling stops when status is completed.
 */
export function useEwrpSlideEditorAi(
	options: UseEwrpSlideEditorAiOptions
): EwrpSlideEditorAiControls {
	const { t } = useTranslation('ewrp');
	const {
		jobId,
		status,
		setStatus,
		onPatchDraftSlide,
		resumeActivePolling,
		secondaryBtnClass,
		primaryBtnClass,
	} = options;

	const { costByTypeKey } = useCreativeStudioUgsCosts();
	const imageEnergy =
		costByTypeKey.get('image_generation_comfyui') ??
		EWRP_SLIDE_REGEN_IMAGE_ENERGY;
	const textEnergy =
		costByTypeKey.get('ewrp_slide_text_regen') ?? EWRP_SLIDE_REGEN_TEXT_ENERGY;

	const shellFrame = useDesktopShellFrame();
	const ugsMenuSurfaceClass = useMemo(
		() =>
			cn(
				getDesktopShellContextMenuClassName(shellFrame),
				ewrpZIndexClass.radixPortal,
				'p-1',
				DESKTOP_CHROME_FOCUS_VISIBLE
			),
		[shellFrame]
	);
	const ugsModalPanelClass = useMemo(
		() =>
			cn(
				getDesktopShellPanelClassName(shellFrame, 'strong'),
				'w-full max-w-lg p-6'
			),
		[shellFrame]
	);
	const [modal, setModal] = useState<{
		kind: 'image' | 'text';
		index: number;
	} | null>(null);
	const [draftText, setDraftText] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [busySlideIndex, setBusySlideIndex] = useState<number | null>(null);
	const dialogPanelRef = useRef<HTMLDivElement>(null);
	const dialogFieldRef = useRef<HTMLTextAreaElement>(null);

	useEwrpDialogFocusTrap(dialogPanelRef, Boolean(modal));

	useEffect(() => {
		if (!modal) return;
		const id = window.requestAnimationFrame(() => {
			dialogFieldRef.current?.focus();
		});
		return () => window.cancelAnimationFrame(id);
	}, [modal]);

	const aiGloballyDisabled = ewrpSlideEditorAiDisabled({
		jobId,
		status: status?.status,
		busySlideIndex,
	});

	const openImageModal = useCallback((index: number, slide: EwrpSlide) => {
		setDraftText((slide.image_prompt ?? '').trim());
		setModal({ kind: 'image', index });
	}, []);

	const openTextModal = useCallback((index: number) => {
		setDraftText('');
		setModal({ kind: 'text', index });
	}, []);

	const closeModal = useCallback(() => {
		setModal(null);
		setDraftText('');
		setSubmitting(false);
	}, []);

	useEffect(() => {
		if (!modal) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			if (submitting) return;
			e.preventDefault();
			e.stopPropagation();
			closeModal();
		};
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	}, [modal, submitting, closeModal]);

	const handleConfirmImage = useCallback(async () => {
		if (!jobId || !modal || modal.kind !== 'image') return;
		const prompt = draftText.trim();
		if (!isEwrpSlideImagePromptValid(prompt)) {
			notify.error(t('slideEditor.promptTooShort'));
			return;
		}
		setSubmitting(true);
		setBusySlideIndex(modal.index);
		try {
			const res = await ewrpApi.regenerateSlideImage(
				jobId,
				modal.index,
				prompt
			);
			const data = parseEwrpStatusResponse(res);
			if (data) setStatus(data);
			onPatchDraftSlide(modal.index, { image_prompt: prompt });
			notify.success(
				t('slideEditor.startedTitle'),
				t('slideEditor.imageStartedBody')
			);
			closeModal();
			resumeActivePolling();
		} catch (e: unknown) {
			notifyEwrpHttpError(e, t('slideEditor.imageRegenFailed'), notify, t);
		} finally {
			setSubmitting(false);
			setBusySlideIndex(null);
		}
	}, [
		jobId,
		modal,
		draftText,
		t,
		setStatus,
		onPatchDraftSlide,
		closeModal,
		resumeActivePolling,
	]);

	const handleConfirmText = useCallback(async () => {
		if (!jobId || !modal || modal.kind !== 'text') return;
		const instruction = draftText.trim() || undefined;
		setSubmitting(true);
		setBusySlideIndex(modal.index);
		try {
			const res = await ewrpApi.regenerateSlideText(
				jobId,
				modal.index,
				instruction
			);
			const data = parseEwrpStatusResponse(res);
			if (data) setStatus(data);
			notify.success(
				t('slideEditor.startedTitle'),
				t('slideEditor.textStartedBody')
			);
			closeModal();
			resumeActivePolling();
		} catch (e: unknown) {
			notifyEwrpHttpError(e, t('slideEditor.textRegenFailed'), notify, t);
		} finally {
			setSubmitting(false);
			setBusySlideIndex(null);
		}
	}, [jobId, modal, draftText, t, setStatus, closeModal, resumeActivePolling]);

	const renderSlideActions = useCallback(
		(slideIndex: number, slide: EwrpSlide) => {
			const rowBusy = busySlideIndex === slideIndex;
			const disabled = aiGloballyDisabled || rowBusy;
			const disabledTitle = ewrpSlideEditorDisabledTitle(
				{ jobId, status: status?.status, busySlideIndex, rowBusy },
				t
			);
			const imgTitle = t('slideEditor.imgButtonTitleWithCost', {
				cost: imageEnergy,
			});
			const txtTitle = t('slideEditor.textButtonTitleWithCost', {
				cost: textEnergy,
			});
			return (
				<DropdownMenu.Root modal={false}>
					<DropdownMenu.Trigger asChild>
						<button
							type="button"
							disabled={disabled}
							title={disabledTitle}
							aria-label={t('slideEditor.ugsMenuAria')}
							className={cn(
								'inline-flex items-center gap-1.5 rounded-lg border border-(--desktop-border-subtle)/70 bg-(--desktop-surface-soft)/40 px-2.5 py-1.5 text-[10px] font-semibold tabular-nums text-(--desktop-text-secondary) transition duration-200',
								disabled
									? 'cursor-not-allowed opacity-45'
									: 'hover:border-[rgb(var(--desktop-accent-rgb)/0.35)] hover:bg-[rgb(var(--desktop-accent-rgb)/0.08)] hover:text-(--desktop-text-primary)',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
						>
							{rowBusy ? (
								<ArrowPathIcon
									className="h-3.5 w-3.5 shrink-0 animate-spin"
									strokeWidth={sw}
									aria-hidden
								/>
							) : (
								<SparklesIcon
									className="h-3.5 w-3.5 shrink-0 opacity-90"
									strokeWidth={sw}
									aria-hidden
								/>
							)}
							<span>{t('slideEditor.ugsMenuTrigger')}</span>
						</button>
					</DropdownMenu.Trigger>
					<DropdownMenu.Portal>
						<DropdownMenu.Content
							className={ugsMenuSurfaceClass}
							sideOffset={6}
							align="start"
						>
							<DropdownMenu.Item
								className={ugsMenuItemClass}
								disabled={disabled}
								onSelect={() => openImageModal(slideIndex, slide)}
							>
								<span className="flex items-center gap-2 font-medium text-(--desktop-text-primary)">
									<PhotoIcon
										className="h-3.5 w-3.5 shrink-0 opacity-90"
										strokeWidth={sw}
										aria-hidden
									/>
									{t('slideEditor.imageShortLabel')}
									<span className="ml-auto tabular-nums text-(--desktop-text-muted)">
										{imageEnergy} {'\u26A1'}
									</span>
								</span>
								<span className="pl-5.5 text-[10px] leading-snug text-(--desktop-text-dim)">
									{imgTitle}
								</span>
							</DropdownMenu.Item>
							<DropdownMenu.Item
								className={ugsMenuItemClass}
								disabled={disabled}
								onSelect={() => openTextModal(slideIndex)}
							>
								<span className="flex items-center gap-2 font-medium text-(--desktop-text-primary)">
									<DocumentTextIcon
										className="h-3.5 w-3.5 shrink-0 opacity-90"
										strokeWidth={sw}
										aria-hidden
									/>
									{t('slideEditor.textShortLabel')}
									<span className="ml-auto tabular-nums text-(--desktop-text-muted)">
										{textEnergy} {'\u26A1'}
									</span>
								</span>
								<span className="pl-5.5 text-[10px] leading-snug text-(--desktop-text-dim)">
									{txtTitle}
								</span>
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Portal>
				</DropdownMenu.Root>
			);
		},
		[
			t,
			jobId,
			status?.status,
			aiGloballyDisabled,
			busySlideIndex,
			openImageModal,
			openTextModal,
			ugsMenuSurfaceClass,
			imageEnergy,
			textEnergy,
		]
	);

	const modals = useMemo(() => {
		if (!modal) return null;
		const title =
			modal.kind === 'image'
				? t('slideEditor.modalImageTitle')
				: t('slideEditor.modalTextTitle');
		const subtitle =
			modal.kind === 'image'
				? t('slideEditor.modalImageSubtitle')
				: t('slideEditor.modalTextSubtitle');
		const costLine = t('slideEditor.costWithAmount', {
			cost: modal.kind === 'image' ? imageEnergy : textEnergy,
		});

		return (
			<div
				className={cn(
					'fixed inset-0 flex items-center justify-center px-4',
					ewrpZIndexClass.ugsModalBackdrop,
					DESKTOP_OVERLAY.backdrop
				)}
				data-ewrp-ignore-hotkey
			>
				<button
					type="button"
					className="absolute inset-0 cursor-default border-0 bg-transparent p-0"
					aria-label={t('form.closeAria')}
					onClick={submitting ? undefined : closeModal}
					disabled={submitting}
					tabIndex={-1}
				/>
				<div
					ref={dialogPanelRef}
					className={cn(ugsModalPanelClass, 'relative z-10')}
					role="dialog"
					aria-modal="true"
					aria-labelledby="ewrp-slide-ai-title"
					aria-describedby="ewrp-slide-ai-desc"
					aria-busy={submitting}
					onClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => e.stopPropagation()}
				>
					<div className="mb-4 flex items-start justify-between gap-3">
						<div className="flex min-w-0 items-start gap-3">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--desktop-accent-rgb)/0.1)] ring-1 ring-inset ring-[rgb(var(--desktop-accent-rgb)/0.18)]">
								<SparklesIcon
									className="h-5 w-5 text-[rgb(var(--desktop-accent-rgb)/0.95)]"
									strokeWidth={sw}
									aria-hidden
								/>
							</div>
							<div className="min-w-0">
								<p
									id="ewrp-slide-ai-title"
									className="text-sm font-semibold text-(--desktop-text-primary)"
								>
									{title}
								</p>
								<p
									id="ewrp-slide-ai-desc"
									className={cn(
										DESKTOP_TYPOGRAPHY.small,
										'mt-1 text-(--desktop-text-dim)'
									)}
								>
									{subtitle}
								</p>
								<p
									className={cn(
										DESKTOP_TYPOGRAPHY.small,
										'mt-2 font-medium tabular-nums text-(--desktop-text-secondary)'
									)}
								>
									{costLine}
								</p>
							</div>
						</div>
						<button
							type="button"
							onClick={closeModal}
							disabled={submitting}
							className={cn(
								'rounded-lg p-2 text-(--desktop-text-muted)',
								DESKTOP_INTERACTIVE.btnRounded
							)}
							aria-label={t('form.closeAria')}
						>
							<XMarkIcon className="h-4 w-4" strokeWidth={sw} />
						</button>
					</div>
					{modal.kind === 'image' ? (
						<label className="block">
							<span
								className={cn(
									DESKTOP_TYPOGRAPHY.small,
									'mb-1.5 block font-medium text-(--desktop-text-secondary)'
								)}
							>
								{t('slideEditor.promptFieldLabel')}
							</span>
							<textarea
								ref={dialogFieldRef}
								value={draftText}
								onChange={(e) => setDraftText(e.target.value)}
								rows={4}
								maxLength={2000}
								className="w-full resize-y rounded-xl border border-(--desktop-border-subtle)/80 bg-(--desktop-surface-soft)/40 px-3 py-2 text-xs text-(--desktop-text-primary) placeholder:text-(--desktop-text-muted) focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]"
								placeholder={t('slideEditor.promptPlaceholder')}
							/>
						</label>
					) : (
						<label className="block">
							<span
								className={cn(
									DESKTOP_TYPOGRAPHY.small,
									'mb-1.5 block font-medium text-(--desktop-text-secondary)'
								)}
							>
								{t('slideEditor.instructionFieldLabel')}
							</span>
							<textarea
								ref={dialogFieldRef}
								value={draftText}
								onChange={(e) => setDraftText(e.target.value)}
								rows={4}
								maxLength={2000}
								className="w-full resize-y rounded-xl border border-(--desktop-border-subtle)/80 bg-(--desktop-surface-soft)/40 px-3 py-2 text-xs text-(--desktop-text-primary) placeholder:text-(--desktop-text-muted) focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]"
								placeholder={t('slideEditor.instructionPlaceholder')}
							/>
						</label>
					)}
					<div className="mt-5 flex flex-wrap justify-end gap-2">
						<button
							type="button"
							onClick={closeModal}
							disabled={submitting}
							className={secondaryBtnClass}
						>
							{t('form.cancel')}
						</button>
						<button
							type="button"
							onClick={
								modal.kind === 'image'
									? () => void handleConfirmImage()
									: () => void handleConfirmText()
							}
							disabled={submitting}
							className={cn(
								primaryBtnClass,
								'inline-flex w-auto min-w-32 flex-row px-4 py-2.5 text-xs'
							)}
						>
							{submitting ? (
								<ArrowPathIcon
									className="h-3.5 w-3.5 shrink-0 animate-spin"
									strokeWidth={sw}
								/>
							) : null}
							<span>
								{submitting
									? t('slideEditor.starting')
									: t('slideEditor.confirm')}
							</span>
						</button>
					</div>
				</div>
			</div>
		);
	}, [
		modal,
		draftText,
		submitting,
		t,
		closeModal,
		secondaryBtnClass,
		primaryBtnClass,
		handleConfirmImage,
		handleConfirmText,
		ugsModalPanelClass,
		imageEnergy,
		textEnergy,
	]);

	return { renderSlideActions, modals };
}
