/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Spotlight guided tour for the EWA Desktop companion window (GT-1).
 *
 * Invariants:
 * - Highlights resolve only inside `#ewa-desktop-guide-root`; prefers visible DOM matches.
 * - Tour audio is static WAV only — not live companion TTS.
 *
 * Related:
 * - features/ewa/EwaCompanionChatPanel.tsx
 * - features/ewa/ewaDesktopGuideConstants.ts
 * - documentation/product/GUIDED-TOUR-EXCURSION.md
 */

import { GuideTourSpotlightFrame } from '@/components/guided-tour/GuideTourSpotlightFrame';
import {
	clearGuideTourSpotlightTarget,
	findVisibleGuideHighlight,
	setGuideTourSpotlightTarget,
} from '@/components/guided-tour/guideTourHighlightTarget';
import {
	GUIDE_TOUR_CARD_SHELL_CLASS,
	guideTourCardMotionAnimate,
	guideTourCardMotionExit,
	guideTourCardMotionInitial,
	guideTourCardPositionTransition,
} from '@/components/guided-tour/guideTourCardMotion';
import { useGuideTourFloatingCardPosition } from '@/components/guided-tour/useGuideTourFloatingCardPosition';
import {
	EWA_DESKTOP_GUIDE_AUDIO_LS_KEY,
	EWA_DESKTOP_GUIDE_ROOT_ID,
	EWA_DESKTOP_GUIDE_TOUR_FOLDER,
} from '@/features/ewa/ewaDesktopGuideConstants';
import { GuideTourVoiceSelector } from '@/components/guided-tour/GuideTourVoiceSelector';
import { useGuideTourResolvedAudioPath } from '@/components/guided-tour/useGuideTourResolvedAudioPath';
import { useGuideTourVoicePreference } from '@/components/guided-tour/useGuideTourVoicePreference';
import {
	DESKTOP_PORTAL_STACK_BUMP,
	DESKTOP_Z_INDEX,
} from '@/pages/Desktop/constants';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { useSyncDesktopThemeFromMain } from '@/pages/Desktop/hooks/useSyncDesktopThemeFromMain';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';
import { useMarketingDialogFocusTrap } from '@/pages/MarketingCabinet/hooks/useMarketingDialogFocusTrap';
import { cn } from '@/utils/cn';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { ComponentType, SVGProps } from 'react';
import {
	Bars3BottomLeftIcon,
	ChatBubbleLeftRightIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	Cog6ToothIcon,
	PaperAirplaneIcon,
	SparklesIcon,
	SpeakerWaveIcon,
	SpeakerXMarkIcon,
	UserCircleIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useTranslation } from 'react-i18next';

type EwaGuideStep = {
	id: string;
	title: string;
	body: string;
	highlightSelectors: readonly string[];
};

const STEP_DEFS: Array<{
	id: string;
	highlightSelectors: readonly string[];
}> = [
	{ id: 'intro', highlightSelectors: [] },
	{
		id: 'presence',
		highlightSelectors: [
			'[data-ewa-guide="presence-compact"]',
			'[data-ewa-guide="presence-header"]',
		],
	},
	{ id: 'left-rail', highlightSelectors: ['[data-ewa-guide="left-rail"]'] },
	{ id: 'transcript', highlightSelectors: ['[data-ewa-guide="transcript"]'] },
	{ id: 'operations', highlightSelectors: ['[data-ewa-guide="operations"]'] },
	{
		id: 'quick-presets',
		highlightSelectors: ['[data-ewa-guide="quick-presets"]'],
	},
	{ id: 'composer', highlightSelectors: ['[data-ewa-guide="composer"]'] },
	{ id: 'outro', highlightSelectors: [] },
];

const STEP_ICON: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
	intro: SparklesIcon,
	presence: UserCircleIcon,
	'left-rail': Bars3BottomLeftIcon,
	transcript: ChatBubbleLeftRightIcon,
	operations: Cog6ToothIcon,
	'quick-presets': SparklesIcon,
	composer: PaperAirplaneIcon,
	outro: SparklesIcon,
};

function findStepHighlight(
	root: HTMLElement,
	selectors: readonly string[]
): HTMLElement | null {
	for (const selector of selectors) {
		const el = findVisibleGuideHighlight(root, selector);
		if (el) return el;
	}
	return null;
}

export interface EwaDesktopGuideModalProps {
	open: boolean;
	onClose: () => void;
	onPrepareStep?: (stepId: string) => void;
	spotlightLayoutKey?: string;
}

export function EwaDesktopGuideModal({
	open,
	onClose,
	onPrepareStep,
	spotlightLayoutKey = '',
}: EwaDesktopGuideModalProps) {
	const { t } = useTranslation('marketing');
	const portalStackBase = useDesktopWindowPortalStackBase();
	const reduceMotion = useReducedMotion();

	const steps = useMemo((): EwaGuideStep[] => {
		return STEP_DEFS.map((def) => ({
			id: def.id,
			highlightSelectors: def.highlightSelectors,
			title: t(`ewaGuide.steps.${def.id}.title`),
			body: t(`ewaGuide.steps.${def.id}.body`),
		}));
	}, [t]);

	const [stepIndex, setStepIndex] = useState(0);
	const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
	const [guideAudioEnabled, setGuideAudioEnabled] = useState(() => {
		if (typeof window === 'undefined') return true;
		try {
			const v = window.localStorage.getItem(EWA_DESKTOP_GUIDE_AUDIO_LS_KEY);
			if (v === null) return true;
			return v === '1' || v === 'true';
		} catch {
			return true;
		}
	});
	const [guideVoice, setGuideVoice] = useGuideTourVoicePreference();
	const resolveAudioPath = useGuideTourResolvedAudioPath(
		EWA_DESKTOP_GUIDE_TOUR_FOLDER
	);

	useEffect(() => {
		if (open) setStepIndex(0);
	}, [open]);

	useEffect(() => {
		if (open && stepIndex >= steps.length) {
			setStepIndex(Math.max(0, steps.length - 1));
		}
	}, [open, stepIndex, steps.length]);

	const setGuideAudioPreference = useCallback((next: boolean) => {
		setGuideAudioEnabled(next);
		try {
			window.localStorage.setItem(
				EWA_DESKTOP_GUIDE_AUDIO_LS_KEY,
				next ? '1' : '0'
			);
		} catch {
			/* private mode */
		}
	}, []);

	const step = steps[stepIndex] ?? steps[0];
	const isLast = stepIndex >= steps.length - 1;
	const isFirst = stepIndex <= 0;
	const StepIcon = STEP_ICON[step?.id ?? 'intro'] ?? SparklesIcon;

	const contentTransition = reduceMotion
		? { duration: 0.12 }
		: {
				type: 'tween' as const,
				ease: [0.22, 1, 0.36, 1] as const,
				duration: 0.32,
			};

	const { guideCardWrapRef, floatingCardStyle, useCenterCard } =
		useGuideTourFloatingCardPosition({
			open,
			spotlightRect,
			hasHighlight: step?.highlightSelectors.length > 0,
			stepIndex,
			spotlightLayoutKey,
		});

	const guidePortalShellRef = useRef<HTMLDivElement | null>(null);
	const guideCardPanelRef = useRef<HTMLDivElement | null>(null);
	useSyncDesktopThemeFromMain(open && Boolean(step), guidePortalShellRef);
	useMarketingDialogFocusTrap(guideCardPanelRef, open);

	useEffect(() => {
		if (!open) {
			clearGuideTourSpotlightTarget();
			return;
		}
		return () => {
			clearGuideTourSpotlightTarget();
		};
	}, [open]);

	useEffect(() => {
		if (!open || !step) return;
		onPrepareStep?.(step.id);

		let audio: HTMLAudioElement | null = null;
		if (guideAudioEnabled) {
			const url = resolveAudioPath(step.id);
			if (url) {
				audio = new Audio(url);
				void audio.play().catch(() => {});
			}
		}

		return () => {
			if (audio) {
				audio.pause();
				audio.removeAttribute('src');
			}
		};
	}, [open, guideAudioEnabled, step, onPrepareStep, resolveAudioPath]);

	const updateRect = useCallback(() => {
		void spotlightLayoutKey;
		if (!open || !step || step.highlightSelectors.length === 0) {
			setSpotlightRect(null);
			clearGuideTourSpotlightTarget();
			return;
		}
		const root = document.getElementById(EWA_DESKTOP_GUIDE_ROOT_ID);
		if (!root) {
			setSpotlightRect(null);
			clearGuideTourSpotlightTarget();
			return;
		}
		const el = findStepHighlight(root, step.highlightSelectors);
		setGuideTourSpotlightTarget(el);
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
	}, [open, step, spotlightLayoutKey]);

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
		const root = document.getElementById(EWA_DESKTOP_GUIDE_ROOT_ID);
		if (!root || !step || step.highlightSelectors.length === 0) return;
		const el = findStepHighlight(root, step.highlightSelectors);
		if (!el) return;
		const ro = new ResizeObserver(() => updateRect());
		ro.observe(el);
		return () => ro.disconnect();
	}, [open, step, updateRect]);

	useEffect(() => {
		if (!open || !guideCardPanelRef.current) return;
		void stepIndex;
		const focusTarget = guideCardPanelRef.current.querySelector<HTMLElement>(
			'button:not([disabled])'
		);
		focusTarget?.focus();
	}, [open, stepIndex]);

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

	const GUIDE_LAYER_Z = portalStackBase;
	const GUIDE_CARD_Z =
		portalStackBase + DESKTOP_PORTAL_STACK_BUMP.GUIDE_TOUR_CARD;
	const overlayEnter = reduceMotion
		? { duration: 0.15 }
		: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const };
	const cardSpring = reduceMotion
		? { duration: 0.2 }
		: { type: 'spring' as const, stiffness: 320, damping: 30, mass: 0.9 };

	if (typeof document === 'undefined') return null;
	if (!step) return null;

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
						style={{ zIndex: GUIDE_LAYER_Z }}
						role="dialog"
						aria-modal="true"
						aria-labelledby="ewa-guide-title"
						aria-describedby="ewa-guide-kbd-hint"
					>
						<div
							className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_78%_62%_at_50%_38%,transparent_0%,rgb(var(--desktop-bg-primary-rgb)/0.72)_108%)] opacity-95"
							style={{ zIndex: 0 }}
							aria-hidden
						/>
						{spotlightRect && step.highlightSelectors.length > 0 ? (
							<GuideTourSpotlightFrame
								rect={spotlightRect}
								onDimClick={onClose}
								zMask={DESKTOP_Z_INDEX.MODAL}
								zGlow={DESKTOP_Z_INDEX.MODAL}
								zRing={DESKTOP_Z_INDEX.MODAL_CONTENT}
							/>
						) : (
							<button
								type="button"
								className="fixed inset-0 border-0 bg-[rgb(var(--desktop-bg-primary-rgb)/0.82)] p-0 backdrop-blur-[2px]"
								style={{ zIndex: DESKTOP_Z_INDEX.MODAL }}
								aria-label={t('ewaGuide.closeDimAria')}
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
							style={{ zIndex: GUIDE_CARD_Z }}
							onClick={(e) => e.stopPropagation()}
						>
							<div
								ref={guideCardPanelRef}
								className={cn(
									'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/12',
									'bg-[color-mix(in_srgb,var(--desktop-surface-panel-strong)_96%,transparent)] shadow-[0_28px_80px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(255,255,255,0.05)]',
									'backdrop-blur-2xl backdrop-saturate-150'
								)}
							>
								<p id="ewa-guide-kbd-hint" className="sr-only">
									{t('ewaGuide.kbdHint')}
								</p>

								<div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 px-4 pb-3 pt-4 sm:gap-4 sm:px-5 sm:pb-4 sm:pt-5">
									<div className="flex shrink-0 items-start justify-between gap-3">
										<div className="min-w-0 flex-1 space-y-2">
											<span className="text-[10px] font-medium uppercase tracking-[0.28em] text-[rgb(var(--desktop-accent-rgb)/0.8)]">
												{t('ewaGuide.badge')}
											</span>
											<div
												className="relative h-1 w-full overflow-hidden rounded-full bg-white/10"
												role="progressbar"
												aria-valuemin={1}
												aria-valuenow={stepIndex + 1}
												aria-valuemax={steps.length}
												aria-label={t('ewaGuide.progressAria', {
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
										<div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
											<GuideTourVoiceSelector
												value={guideVoice}
												onChange={setGuideVoice}
											/>
											<button
												type="button"
												onClick={() =>
													setGuideAudioPreference(!guideAudioEnabled)
												}
												aria-pressed={guideAudioEnabled}
												aria-label={t('ewaGuide.audioToggleAria')}
												title={t('ewaGuide.audioToggleTitle')}
												className="rounded-xl border border-white/10 bg-white/5 p-2 text-(--desktop-text-muted) transition-colors hover:bg-white/10 hover:text-[rgb(var(--desktop-accent-rgb)/0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.5)]"
											>
												{guideAudioEnabled ? (
													<SpeakerWaveIcon className="h-4 w-4" aria-hidden />
												) : (
													<SpeakerXMarkIcon className="h-4 w-4" aria-hidden />
												)}
											</button>
											<button
												type="button"
												onClick={onClose}
												aria-label={t('ewaGuide.closeAria')}
												className="rounded-xl border border-white/10 bg-white/5 p-2 text-(--desktop-text-muted) transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.5)]"
											>
												<XMarkIcon className="h-4 w-4" aria-hidden />
											</button>
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
														id="ewa-guide-title"
														className="text-pretty text-lg font-semibold tracking-tight text-white sm:text-xl"
													>
														{step.title}
													</h2>
													<div className="max-h-[min(30vh,13.5rem)] min-h-0 overflow-y-auto pr-1 text-sm leading-relaxed text-(--desktop-text-muted) [scrollbar-color:rgb(var(--desktop-fg-primary-rgb)/0.35)_transparent] scrollbar-thin sm:text-[15px]">
														{step.body}
													</div>
												</div>
											</motion.div>
										</AnimatePresence>
									</div>

									<div className="flex shrink-0 flex-wrap items-center justify-between gap-2 sm:gap-3">
										<div className="flex flex-wrap items-center gap-1">
											<button
												type="button"
												onClick={() => setStepIndex((i) => (i > 0 ? i - 1 : i))}
												disabled={isFirst}
												className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-(--desktop-text-secondary) transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]"
											>
												<ChevronLeftIcon className="h-4 w-4" aria-hidden />
												{t('ewaGuide.back')}
											</button>
											<button
												type="button"
												onClick={onClose}
												className="rounded-xl px-3 py-2 text-xs font-medium text-(--desktop-text-dim) transition-colors hover:text-(--desktop-text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
											>
												{t('ewaGuide.skip')}
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
													{t('ewaGuide.next')}
													<ChevronRightIcon className="h-4 w-4" aria-hidden />
												</button>
											) : (
												<button
													type="button"
													onClick={onClose}
													className="min-w-36 rounded-xl border border-[rgb(var(--desktop-accent-rgb)/0.42)] bg-[rgb(var(--desktop-accent-rgb)/0.28)] px-4 py-2.5 text-sm font-medium text-white shadow-[0_10px_32px_rgb(var(--desktop-accent-rgb)/0.28)] transition-colors hover:bg-[rgb(var(--desktop-accent-rgb)/0.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.5)] sm:min-w-40"
												>
													{t('ewaGuide.finish')}
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
}
