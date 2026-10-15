/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop AI Chat guided-tour modal (facade): vignette, card, audio, step chrome.
 * Placement / spotlight / step registry live under ./guide/.
 *
 * Invariants:
 * - Public exports DESKTOP_AI_CHAT_ROOT_ID / GUIDE_TOUR_FOLDER / desktopAiChatGuideWavUrl stay here.
 *
 * Related:
 * - features/desktop-ai-chat/guide/*
 * - documentation/platform/PRODUCT-AUDIT-STABILITY-BACKLOG.md (desktop-ai-chat-026)
 */

import {
	GUIDE_TOUR_CARD_SHELL_CLASS,
	guideTourCardMotionAnimate,
	guideTourCardMotionExit,
	guideTourCardMotionInitial,
	guideTourCardPositionTransition,
} from '@/components/guided-tour/guideTourCardMotion';
import { GuideTourVoiceSelector } from '@/components/guided-tour/GuideTourVoiceSelector';
import { guideTourWavUrl } from '@/components/guided-tour/guideTourWavUrl';
import { useGuideTourResolvedAudioPath } from '@/components/guided-tour/useGuideTourResolvedAudioPath';
import { useGuideTourVoicePreference } from '@/components/guided-tour/useGuideTourVoicePreference';
import {
	DESKTOP_PORTAL_STACK_BUMP,
	DESKTOP_TYPOGRAPHY,
	DESKTOP_Z_INDEX,
} from '@/pages/Desktop/constants';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { DesktopAiChatIconTooltip } from './components/desktopAiChatIconTooltip';
import { cn } from '@/utils/cn';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import * as React from 'react';
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSyncDesktopThemeFromMain } from '@/pages/Desktop/hooks/useSyncDesktopThemeFromMain';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	SpeakerWaveIcon,
	SpeakerXMarkIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { computeGuideCardPlacement } from './guide/desktopAiChatGuidePlacement';
import { STEP_ICON, STEP_IDS } from './guide/desktopAiChatGuideSteps';
import { SpotlightFrame } from './guide/DesktopAiChatGuideSpotlightFrame';

export const DESKTOP_AI_CHAT_ROOT_ID = 'desktop-ai-chat-app-root';

export const DESKTOP_AI_CHAT_GUIDE_TOUR_FOLDER = 'desktop-ai-chat-guide';

const GUIDE_AUDIO_LS_KEY = 'desktop-ai-chat-guide-audio-enabled';

/** @deprecated Prefer `useGuideTourResolvedAudioPath(DESKTOP_AI_CHAT_GUIDE_TOUR_FOLDER)`. */
export function desktopAiChatGuideWavUrl(stepId: string): string {
	return guideTourWavUrl(DESKTOP_AI_CHAT_GUIDE_TOUR_FOLDER, stepId);
}

export interface DesktopAiChatGuideModalProps {
	open: boolean;
	onClose: () => void;
	onPrepareStep?: (stepId: string) => void;
	spotlightLayoutKey?: string;
	/** When false, composer step skips mic/voice mentions. */
	voiceEnabled?: boolean;
}

export const DesktopAiChatGuideModal: React.FC<DesktopAiChatGuideModalProps> = (
	props
) => {
	const {
		open,
		onClose,
		spotlightLayoutKey = '',
		onPrepareStep,
		voiceEnabled = true,
	} = props;
	const { t } = useTranslation('desktopAiChat');
	const portalStackBase = useDesktopWindowPortalStackBase();
	const reduceMotion = useReducedMotion();

	const steps = useMemo(
		() =>
			STEP_IDS.map((s) => ({
				...s,
				title: t(`tour.step.${s.id}.title`),
				body:
					s.id === 'composer' && voiceEnabled === false
						? t('tour.step.composer.bodyVoiceOff')
						: t(`tour.step.${s.id}.body`),
			})),
		[t, voiceEnabled]
	);

	const [stepIndex, setStepIndex] = useState(0);
	const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
	const [guideAudioEnabled, setGuideAudioEnabled] = useState(() => {
		if (typeof window === 'undefined') return true;
		try {
			const v = window.localStorage.getItem(GUIDE_AUDIO_LS_KEY);
			if (v === null) return true;
			return v === '1' || v === 'true';
		} catch {
			return true;
		}
	});
	const [guideVoice, setGuideVoice] = useGuideTourVoicePreference();
	const resolveAudioPath = useGuideTourResolvedAudioPath(
		DESKTOP_AI_CHAT_GUIDE_TOUR_FOLDER
	);

	const tourAudioTRef = useRef(t);
	tourAudioTRef.current = t;
	/** Один раз за открытие модалки — тост про автозапуск только при реальном NotAllowedError. */
	const guideAutoplayHintShownRef = useRef(false);
	const guideCardWrapRef = useRef<HTMLDivElement | null>(null);
	const guidePortalShellRef = useRef<HTMLDivElement | null>(null);
	const measuredForStepIndexRef = useRef<number | null>(null);
	const measuredSpotlightSigRef = useRef<string>('');

	const setGuideAudioPreference = useCallback((next: boolean) => {
		setGuideAudioEnabled(next);
		try {
			window.localStorage.setItem(GUIDE_AUDIO_LS_KEY, next ? '1' : '0');
		} catch {
			/* private mode */
		}
	}, []);

	const step = steps[stepIndex] ?? steps[0];
	const isLast = stepIndex >= steps.length - 1;
	const isFirst = stepIndex <= 0;
	const StepIcon = STEP_ICON[step.id] ?? SparklesIcon;
	const contentTransition = reduceMotion
		? { duration: 0.12 }
		: {
				type: 'tween' as const,
				ease: [0.22, 1, 0.36, 1] as const,
				duration: 0.32,
			};

	useSyncDesktopThemeFromMain(open && Boolean(step), guidePortalShellRef);

	const onPrepareStepRef = useRef(onPrepareStep);
	onPrepareStepRef.current = onPrepareStep;

	useEffect(() => {
		if (!open) return;
		const sid = STEP_IDS[stepIndex]?.id;
		if (!sid) return;
		onPrepareStepRef.current?.(sid);
	}, [open, stepIndex]);

	// useLayoutEffect + новый mount при каждом открытии (key в родителе): если stepIndex сбрасывать
	// в useEffect после layout, первый play() идёт по старому шагу, cleanup рвёт звук, intro играет
	// уже без user gesture — тишина, хотя в Network 206. Voice/CM держат audio в useEffect вместе со сбросом шага.
	useLayoutEffect(() => {
		if (!open || !guideAudioEnabled) return;
		const stepId = STEP_IDS[stepIndex]?.id;
		if (!stepId) return;

		let audio: HTMLAudioElement | null = null;

		const url = resolveAudioPath(stepId);
		if (!url) return;
		audio = new Audio(url);
		audio.preload = 'auto';
		void audio.play().catch((err: unknown) => {
			if (import.meta.env.DEV) {
				console.warn('[desktop-ai-chat-guide] play()', err, url);
			}
			const blocked =
				err instanceof DOMException && err.name === 'NotAllowedError';
			if (blocked && !guideAutoplayHintShownRef.current) {
				guideAutoplayHintShownRef.current = true;
				toast.message(tourAudioTRef.current('tour.audioAutoplayHint'), {
					duration: 5000,
				});
			}
		});

		return () => {
			if (audio) {
				audio.pause();
				audio.removeAttribute('src');
			}
		};
	}, [open, guideAudioEnabled, stepIndex, resolveAudioPath]);

	const updateRect = useCallback(() => {
		void spotlightLayoutKey;
		if (!open || !step?.highlightSelector) {
			setSpotlightRect(null);
			return;
		}
		const root = document.getElementById(DESKTOP_AI_CHAT_ROOT_ID);
		const el = root?.querySelector(
			step.highlightSelector
		) as HTMLElement | null;
		if (!el) {
			setSpotlightRect(null);
			return;
		}
		el.scrollIntoView({
			block: 'nearest',
			inline: 'nearest',
			behavior: 'auto',
		});
		setSpotlightRect(el.getBoundingClientRect());
	}, [open, step?.highlightSelector, spotlightLayoutKey]);

	useLayoutEffect(() => {
		updateRect();
	}, [updateRect]);

	useEffect(() => {
		if (!open) return;
		const onResize = () => updateRect();
		window.addEventListener('resize', onResize);
		window.addEventListener('scroll', onResize, true);
		return () => {
			window.removeEventListener('resize', onResize);
			window.removeEventListener('scroll', onResize, true);
		};
	}, [open, updateRect]);

	useEffect(() => {
		if (!open) return;
		const root = document.getElementById(DESKTOP_AI_CHAT_ROOT_ID);
		if (!root || !step?.highlightSelector) return;
		const el = root.querySelector(step.highlightSelector);
		if (!el) return;
		const ro = new ResizeObserver(() => updateRect());
		ro.observe(el);
		return () => ro.disconnect();
	}, [open, step?.highlightSelector, updateRect]);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				onClose();
				return;
			}
			if (e.key === 'ArrowRight') {
				e.preventDefault();
				setStepIndex((i) => (i < steps.length - 1 ? i + 1 : i));
				return;
			}
			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				setStepIndex((i) => (i > 0 ? i - 1 : i));
				return;
			}
			if (e.key === 'Home') {
				e.preventDefault();
				setStepIndex(0);
				return;
			}
			if (e.key === 'End') {
				e.preventDefault();
				setStepIndex(steps.length - 1);
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [open, onClose, steps.length]);

	const useCenterCard = !spotlightRect || !step?.highlightSelector;

	const estimatedFloatingPos = useMemo(() => {
		if (!spotlightRect || !step?.highlightSelector) return null;
		if (typeof window === 'undefined') return null;
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const cardW = Math.min(432, vw - 32);
		const cardH = Math.min(420, vh * 0.5);
		return computeGuideCardPlacement(spotlightRect, cardW, cardH, vw, vh);
	}, [spotlightRect, step?.highlightSelector]);

	const [measuredFloatingPos, setMeasuredFloatingPos] = useState<{
		top: number;
		left: number;
	} | null>(null);

	useLayoutEffect(() => {
		if (!open || !spotlightRect || !step?.highlightSelector) {
			setMeasuredFloatingPos(null);
			measuredForStepIndexRef.current = null;
			measuredSpotlightSigRef.current = '';
			return;
		}

		measuredForStepIndexRef.current = null;
		measuredSpotlightSigRef.current = '';
		setMeasuredFloatingPos(null);

		const spotlightSig = [
			Math.round(spotlightRect.top),
			Math.round(spotlightRect.left),
			Math.round(spotlightRect.width),
			Math.round(spotlightRect.height),
			spotlightLayoutKey,
		].join(':');

		const run = () => {
			const el = guideCardWrapRef.current;
			if (!el) return;
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			const r = el.getBoundingClientRect();
			setMeasuredFloatingPos(
				computeGuideCardPlacement(spotlightRect, r.width, r.height, vw, vh)
			);
			measuredForStepIndexRef.current = stepIndex;
			measuredSpotlightSigRef.current = spotlightSig;
		};

		run();
		let innerRaf = 0;
		const outerRaf = window.requestAnimationFrame(() => {
			innerRaf = window.requestAnimationFrame(run);
		});
		return () => {
			window.cancelAnimationFrame(outerRaf);
			window.cancelAnimationFrame(innerRaf);
		};
	}, [
		open,
		spotlightRect,
		step?.highlightSelector,
		stepIndex,
		spotlightLayoutKey,
	]);

	const spotlightSigForRender = spotlightRect
		? [
				Math.round(spotlightRect.top),
				Math.round(spotlightRect.left),
				Math.round(spotlightRect.width),
				Math.round(spotlightRect.height),
				spotlightLayoutKey,
			].join(':')
		: '';

	const floatingCardStyle =
		measuredFloatingPos &&
		measuredForStepIndexRef.current === stepIndex &&
		measuredSpotlightSigRef.current === spotlightSigForRender
			? measuredFloatingPos
			: estimatedFloatingPos;
	const guideLayerZ = portalStackBase;
	const guideCardZ =
		portalStackBase + DESKTOP_PORTAL_STACK_BUMP.GUIDE_TOUR_CARD;
	const overlayEnter = reduceMotion
		? { duration: 0.15 }
		: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const };
	const cardSpring = reduceMotion
		? { duration: 0.2 }
		: { type: 'spring' as const, stiffness: 320, damping: 30, mass: 0.9 };

	if (typeof document === 'undefined') return null;

	return (
		<ShellPortalMount layer="embedded_modal_backdrop">
			<AnimatePresence>
				{open && step ? (
					<motion.div
						ref={guidePortalShellRef}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={overlayEnter}
						className="fixed inset-0"
						style={{ zIndex: guideLayerZ }}
						role="dialog"
						aria-modal="true"
						aria-labelledby="desktop-ai-chat-guide-title"
						aria-describedby="desktop-ai-chat-guide-kbd"
					>
						<div
							className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_78%_62%_at_50%_38%,transparent_0%,rgb(var(--desktop-bg-primary-rgb)/0.72)_108%)] opacity-95"
							style={{ zIndex: 0 }}
							aria-hidden
						/>
						{spotlightRect && step.highlightSelector ? (
							<SpotlightFrame rect={spotlightRect} onDimClick={onClose} />
						) : (
							<button
								type="button"
								className="fixed inset-0 border-0 bg-[rgb(var(--desktop-bg-primary-rgb)/0.82)] p-0 backdrop-blur-[2px]"
								style={{ zIndex: DESKTOP_Z_INDEX.MODAL }}
								aria-label={t('tour.closeDim')}
								onClick={onClose}
							/>
						)}

						<motion.div
							ref={guideCardWrapRef}
							initial={guideTourCardMotionInitial(useCenterCard, reduceMotion)}
							animate={guideTourCardMotionAnimate(
								useCenterCard,
								floatingCardStyle,
								reduceMotion
							)}
							exit={guideTourCardMotionExit(useCenterCard, reduceMotion)}
							transition={guideTourCardPositionTransition(
								useCenterCard,
								cardSpring
							)}
							className={GUIDE_TOUR_CARD_SHELL_CLASS}
							style={{ zIndex: guideCardZ }}
							onClick={(e) => e.stopPropagation()}
						>
							<div
								className={cn(
									'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/12',
									'bg-[color-mix(in_srgb,var(--desktop-surface-panel-strong)_96%,transparent)] shadow-[0_28px_80px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(255,255,255,0.05)]',
									'backdrop-blur-2xl backdrop-saturate-150'
								)}
							>
								<div
									className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[rgb(var(--desktop-accent-rgb)/0.5)] to-transparent"
									aria-hidden
								/>

								<p id="desktop-ai-chat-guide-kbd" className="sr-only">
									{t('tour.kbdHint')}
								</p>

								<div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 px-4 pb-3 pt-4 sm:gap-4 sm:px-5 sm:pb-4 sm:pt-5">
									<div className="flex shrink-0 items-start justify-between gap-3">
										<div className="min-w-0 flex-1 space-y-2">
											<div className="flex flex-wrap items-center gap-2">
												<span
													className={cn(
														'font-medium uppercase tracking-[0.28em] text-[rgb(var(--desktop-accent-rgb)/0.8)]',
														DESKTOP_TYPOGRAPHY.shellMeta10
													)}
												>
													{t('tour.kicker')}
												</span>
												<span
													className={cn(
														'tabular-nums font-semibold text-[rgb(var(--desktop-accent-rgb)/0.95)]',
														DESKTOP_TYPOGRAPHY.captionInherit
													)}
													aria-hidden
												>
													{stepIndex + 1}/{steps.length}
												</span>
											</div>
											<div
												className="relative h-1 w-full overflow-hidden rounded-full bg-white/10"
												role="progressbar"
												aria-valuemin={1}
												aria-valuenow={stepIndex + 1}
												aria-valuemax={steps.length}
												aria-label={t('tour.progressAria', {
													current: stepIndex + 1,
													total: steps.length,
												})}
											>
												<motion.div
													className="absolute inset-y-0 left-0 rounded-full bg-[rgb(var(--desktop-accent-rgb))] shadow-[0_0_14px_rgb(var(--desktop-accent-rgb)/0.35)]"
													initial={false}
													animate={{
														width: `${((stepIndex + 1) / steps.length) * 100}%`,
													}}
													transition={
														reduceMotion
															? { duration: 0 }
															: { type: 'spring', stiffness: 200, damping: 28 }
													}
												/>
											</div>
										</div>
										<div className="flex shrink-0 items-center gap-0.5">
											<GuideTourVoiceSelector
												value={guideVoice}
												onChange={setGuideVoice}
											/>
											<DesktopAiChatIconTooltip
												content={
													guideAudioEnabled
														? t('tour.audioMute')
														: t('tour.audioUnmute')
												}
											>
												<button
													type="button"
													onClick={() =>
														setGuideAudioPreference(!guideAudioEnabled)
													}
													aria-pressed={guideAudioEnabled}
													aria-label={
														guideAudioEnabled
															? t('tour.audioMute')
															: t('tour.audioUnmute')
													}
													className="rounded-xl border border-white/10 bg-white/5 p-2 text-(--desktop-text-muted) transition-colors hover:bg-white/10 hover:text-[rgb(var(--desktop-accent-rgb)/0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.5)]"
												>
													{guideAudioEnabled ? (
														<SpeakerWaveIcon className="h-4 w-4" />
													) : (
														<SpeakerXMarkIcon className="h-4 w-4" />
													)}
												</button>
											</DesktopAiChatIconTooltip>
											<DesktopAiChatIconTooltip content={t('tour.close')}>
												<button
													type="button"
													onClick={onClose}
													aria-label={t('tour.close')}
													className="rounded-xl border border-white/10 bg-white/5 p-2 text-(--desktop-text-muted) transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.5)]"
												>
													<XMarkIcon className="h-4 w-4" />
												</button>
											</DesktopAiChatIconTooltip>
										</div>
									</div>

									<div className="relative min-h-0 flex-1 overflow-hidden">
										<AnimatePresence mode="wait" initial={false}>
											<motion.div
												key={step.id}
												initial={
													reduceMotion
														? { opacity: 0 }
														: { opacity: 0, x: 16, filter: 'blur(4px)' }
												}
												animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
												exit={
													reduceMotion
														? { opacity: 0 }
														: { opacity: 0, x: -12, filter: 'blur(3px)' }
												}
												transition={contentTransition}
												className="flex h-full min-h-0 gap-3 sm:gap-4"
											>
												<div
													className={cn(
														'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl sm:h-14 sm:w-14',
														'bg-[linear-gradient(145deg,rgba(139,92,246,0.35)_0%,rgba(30,27,75,0.9)_100%)]',
														'text-[rgb(var(--desktop-accent-rgb)/0.95)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-white/10'
													)}
													aria-hidden
												>
													<StepIcon className="h-6 w-6 sm:h-7 sm:w-7" />
												</div>
												<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
													<h2
														id="desktop-ai-chat-guide-title"
														className="text-balance text-lg font-semibold tracking-tight text-white sm:text-xl"
													>
														{step.title}
													</h2>
													<div
														className={cn(
															'max-h-[min(30vh,13.5rem)] min-h-0 overflow-y-auto pr-1 text-sm leading-relaxed text-(--desktop-text-muted) [scrollbar-color:rgb(var(--desktop-fg-primary-rgb)/0.35)_transparent] scrollbar-thin',
															DESKTOP_TYPOGRAPHY.shellCopy15Sm
														)}
													>
														{step.body}
													</div>
												</div>
											</motion.div>
										</AnimatePresence>
									</div>

									<nav
										className="flex flex-col gap-3 border-t border-white/10 pt-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:pt-4"
										aria-label={t('tour.stepsNavAria')}
									>
										<div
											className="flex flex-wrap items-center gap-2"
											role="tablist"
											aria-label={t('tour.tablistAria')}
										>
											{steps.map((s, i) => (
												<DesktopAiChatIconTooltip key={s.id} content={s.title}>
													<button
														type="button"
														role="tab"
														aria-selected={i === stepIndex}
														aria-label={t('tour.stepChipAria', {
															n: i + 1,
															title: s.title,
														})}
														onClick={() => setStepIndex(i)}
														className={cn(
															'relative flex h-9 min-w-9 items-center justify-center rounded-xl font-semibold tabular-nums transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.5)] motion-reduce:transition-none',
															DESKTOP_TYPOGRAPHY.captionInherit,
															i === stepIndex
																? 'scale-[1.02] bg-[rgb(var(--desktop-accent-rgb))] text-white shadow-[0_10px_28px_-8px_rgb(var(--desktop-accent-rgb)/0.45)]'
																: 'bg-white/6 text-(--desktop-text-dim) hover:bg-white/10 hover:text-(--desktop-text-secondary)'
														)}
													>
														{i + 1}
													</button>
												</DesktopAiChatIconTooltip>
											))}
										</div>
										<p
											className={cn(
												'text-(--desktop-text-dim)',
												DESKTOP_TYPOGRAPHY.shellMeta10
											)}
											aria-hidden
										>
											{t('tour.keycapHint')}
										</p>
									</nav>

									<div className="flex shrink-0 flex-wrap items-center justify-between gap-2 sm:gap-3">
										<div className="flex flex-wrap items-center gap-1">
											<button
												type="button"
												onClick={() => setStepIndex((i) => (i > 0 ? i - 1 : i))}
												disabled={isFirst}
												className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-(--desktop-text-secondary) transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]"
											>
												<ChevronLeftIcon className="h-4 w-4" />
												{t('tour.back')}
											</button>
											<button
												type="button"
												onClick={onClose}
												className="rounded-xl px-3 py-2 text-xs font-medium text-(--desktop-text-dim) transition-colors hover:text-(--desktop-text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
											>
												{t('tour.skip')}
											</button>
										</div>
										<div className="flex gap-2">
											{!isLast ? (
												<button
													type="button"
													onClick={() =>
														setStepIndex((i) =>
															i < steps.length - 1 ? i + 1 : i
														)
													}
													className="inline-flex items-center gap-1.5 rounded-xl border border-[rgb(var(--desktop-accent-rgb)/0.4)] bg-[rgb(var(--desktop-accent-rgb)/0.25)] px-4 py-2 text-sm font-medium text-white shadow-[0_8px_28px_rgb(var(--desktop-accent-rgb)/0.25)] transition-colors hover:bg-[rgb(var(--desktop-accent-rgb)/0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.5)]"
												>
													{t('tour.next')}
													<ChevronRightIcon className="h-4 w-4" />
												</button>
											) : (
												<button
													type="button"
													onClick={onClose}
													className="min-w-36 rounded-xl border border-[rgb(var(--desktop-accent-rgb)/0.42)] bg-[rgb(var(--desktop-accent-rgb)/0.28)] px-4 py-2.5 text-sm font-medium text-white shadow-[0_10px_32px_rgb(var(--desktop-accent-rgb)/0.28)] transition-colors hover:bg-[rgb(var(--desktop-accent-rgb)/0.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.5)] sm:min-w-40"
												>
													{t('tour.finish')}
												</button>
											)}
										</div>
									</div>
								</div>
							</div>
						</motion.div>
					</motion.div>
				) : null}
			</AnimatePresence>
		</ShellPortalMount>
	);
};
