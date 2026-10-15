/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Reusable spotlight guided tour modal (portal, dim, floating card, optional WAV).
 *
 * Invariants:
 * - Highlights resolve inside `rootId`; prefers first visible DOM match.
 * - Tour audio is static WAV only — not live app TTS.
 * - Keyboard shortcuts use capture + stopPropagation so parent shells defer Escape.
 * - Implemented via `useGuideTourCaptureKeyboard`.
 *
 * Related:
 * - GuideTourSpotlightFrame.tsx, useGuideTourFloatingCardPosition.ts, guideTourHighlightTarget.ts
 * - DesktopChromeTooltip.tsx
 * - documentation/product/GUIDED-TOUR-EXCURSION.md
 */

import { GuideTourCardConnector } from '@/components/guided-tour/GuideTourCardConnector';
import { GuideTourActionDemo } from '@/components/guided-tour/GuideTourActionDemo';
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
import { GuideTourSpotlightFrame } from '@/components/guided-tour/GuideTourSpotlightFrame';
import { useGuideTourFloatingCardPosition } from '@/components/guided-tour/useGuideTourFloatingCardPosition';
import { useGuideTourCaptureKeyboard } from '@/components/guided-tour/useGuideTourCaptureKeyboard';
import {
	DESKTOP_PORTAL_STACK_BUMP,
	DESKTOP_Z_INDEX,
} from '@/pages/Desktop/constants';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { DesktopChromeTooltip } from '@/pages/Desktop/components/DesktopChromeTooltip';
import { useSyncDesktopThemeFromMain } from '@/pages/Desktop/hooks/useSyncDesktopThemeFromMain';
import { cn } from '@/utils/cn';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { ComponentType, SVGProps } from 'react';
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	SparklesIcon,
	SpeakerWaveIcon,
	SpeakerXMarkIcon,
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
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';
import { GuideTourVoiceSelector } from '@/components/guided-tour/GuideTourVoiceSelector';
import { useGuideTourResolvedAudioPath } from '@/components/guided-tour/useGuideTourResolvedAudioPath';
import { useGuideTourVoicePreference } from '@/components/guided-tour/useGuideTourVoicePreference';

export type SpotlightGuideStep = {
	id: string;
	title: string;
	body: string;
	highlightSelector: string | null;
	demoAction?: 'click' | 'doubleClick' | 'rightClick';
	demoCaption?: string;
};

export type SpotlightGuideModalLabels = {
	badge: string;
	kbdHint: string;
	progressAria: (current: number, total: number) => string;
	closeDimAria: string;
	closeAria: string;
	audioToggleAria: string;
	audioToggleTitle: string;
	back: string;
	skip: string;
	next: string;
	finish: string;
};

export type SpotlightGuideModalProps = {
	open: boolean;
	onClose: () => void;
	rootId: string;
	steps: SpotlightGuideStep[];
	/** Folder under `public/audio/` (e.g. `ugs-hub-guide`). */
	tourAudioFolder: string;
	audioLocalStorageKey: string;
	/** Optional filter/override; return `''` to skip audio for a step. */
	audioPathForStep?: (stepId: string) => string | undefined;
	labels: SpotlightGuideModalLabels;
	onPrepareStep?: (stepId: string) => void;
	spotlightLayoutKey?: string;
	stepIcons?: Record<string, ComponentType<SVGProps<SVGSVGElement>>>;
	dialogTitleId?: string;
};

export function SpotlightGuideModal({
	open,
	onClose,
	rootId,
	steps,
	tourAudioFolder,
	audioLocalStorageKey,
	audioPathForStep,
	labels,
	onPrepareStep,
	spotlightLayoutKey = '',
	stepIcons = {},
	dialogTitleId = 'spotlight-guide-title',
}: SpotlightGuideModalProps) {
	const portalStackBase = useDesktopWindowPortalStackBase();
	const reduceMotion = useReducedMotion();
	const [guideVoice, setGuideVoice] = useGuideTourVoicePreference();
	const resolveAudioPath = useGuideTourResolvedAudioPath(
		tourAudioFolder,
		audioPathForStep
	);

	const [stepIndex, setStepIndex] = useState(0);
	useGuideTourCaptureKeyboard(open, steps.length, onClose, setStepIndex);
	const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
	const [guideAudioEnabled, setGuideAudioEnabled] = useState(() => {
		if (typeof window === 'undefined') return true;
		try {
			const v = window.localStorage.getItem(audioLocalStorageKey);
			if (v === null) return true;
			return v === '1' || v === 'true';
		} catch {
			return true;
		}
	});

	useEffect(() => {
		if (open) setStepIndex(0);
	}, [open]);

	useEffect(() => {
		if (open && stepIndex >= steps.length) {
			setStepIndex(Math.max(0, steps.length - 1));
		}
	}, [open, stepIndex, steps.length]);

	const setGuideAudioPreference = useCallback(
		(next: boolean) => {
			setGuideAudioEnabled(next);
			try {
				window.localStorage.setItem(audioLocalStorageKey, next ? '1' : '0');
			} catch {
				/* private mode */
			}
		},
		[audioLocalStorageKey]
	);

	const step = steps[stepIndex] ?? steps[0];
	const isLast = stepIndex >= steps.length - 1;
	const isFirst = stepIndex <= 0;
	const StepIcon = stepIcons[step?.id ?? 'intro'] ?? SparklesIcon;

	const contentTransition = reduceMotion
		? { duration: 0.12 }
		: {
				type: 'tween' as const,
				ease: [0.22, 1, 0.36, 1] as const,
				duration: 0.32,
			};

	const {
		guideCardWrapRef,
		floatingCardStyle,
		cardPlacementSide,
		useCenterCard,
	} = useGuideTourFloatingCardPosition({
		open,
		spotlightRect,
		hasHighlight: Boolean(step?.highlightSelector),
		stepIndex,
		spotlightLayoutKey,
	});

	const [cardMeasureRect, setCardMeasureRect] = useState<DOMRect | null>(null);
	const floatingCardTop = floatingCardStyle?.top ?? null;
	const floatingCardLeft = floatingCardStyle?.left ?? null;

	// biome-ignore lint/correctness/useExhaustiveDependencies: guideCardWrapRef is stable; remeasure when floating position changes
	useLayoutEffect(() => {
		if (
			!open ||
			useCenterCard ||
			floatingCardTop == null ||
			floatingCardLeft == null
		) {
			setCardMeasureRect(null);
			return;
		}
		const el = guideCardWrapRef.current;
		if (!el) return;

		const updateMeasure = () => {
			setCardMeasureRect(el.getBoundingClientRect());
		};
		updateMeasure();

		const ro = new ResizeObserver(updateMeasure);
		ro.observe(el);
		window.addEventListener('scroll', updateMeasure, true);
		window.addEventListener('resize', updateMeasure);
		return () => {
			ro.disconnect();
			window.removeEventListener('scroll', updateMeasure, true);
			window.removeEventListener('resize', updateMeasure);
		};
	}, [open, useCenterCard, floatingCardTop, floatingCardLeft]);

	const guidePortalShellRef = useRef<HTMLDivElement | null>(null);
	useSyncDesktopThemeFromMain(open && Boolean(step), guidePortalShellRef);

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
		if (!open || !step?.highlightSelector) {
			clearGuideTourSpotlightTarget();
			setSpotlightRect(null);
			return;
		}
		const root = document.getElementById(rootId);
		if (!root) {
			clearGuideTourSpotlightTarget();
			setSpotlightRect(null);
			return;
		}
		const el = findVisibleGuideHighlight(root, step.highlightSelector);
		if (!el) {
			clearGuideTourSpotlightTarget();
			setSpotlightRect(null);
			return;
		}
		setGuideTourSpotlightTarget(el);
		el.scrollIntoView({
			block: 'nearest',
			inline: 'nearest',
			behavior: 'auto',
		});
		setSpotlightRect(el.getBoundingClientRect());
	}, [open, step?.highlightSelector, spotlightLayoutKey, rootId]);

	useEffect(() => {
		if (open) return;
		clearGuideTourSpotlightTarget();
		return () => {
			clearGuideTourSpotlightTarget();
		};
	}, [open]);

	useLayoutEffect(() => {
		updateRect();
		if (!open) return;
		let frameTwo = 0;
		const frameOne = window.requestAnimationFrame(() => {
			frameTwo = window.requestAnimationFrame(() => {
				updateRect();
			});
		});
		return () => {
			window.cancelAnimationFrame(frameOne);
			window.cancelAnimationFrame(frameTwo);
		};
	}, [open, updateRect]);

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
		const root = document.getElementById(rootId);
		if (!root || !step?.highlightSelector) return;
		const el = findVisibleGuideHighlight(root, step.highlightSelector);
		const ro = new ResizeObserver(() => updateRect());
		if (el) ro.observe(el);
		ro.observe(root);
		const mo = new MutationObserver(() => updateRect());
		mo.observe(root, { childList: true, subtree: true });
		return () => {
			ro.disconnect();
			mo.disconnect();
		};
	}, [open, step?.highlightSelector, updateRect, rootId]);

	const GUIDE_LAYER_Z = portalStackBase;
	const GUIDE_CARD_Z =
		portalStackBase + DESKTOP_PORTAL_STACK_BUMP.GUIDE_TOUR_CARD;
	const overlayEnter = reduceMotion
		? { duration: 0.15 }
		: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const };
	const cardPositionSpring = reduceMotion
		? { duration: 0.12 }
		: { type: 'spring' as const, stiffness: 280, damping: 32, mass: 0.88 };

	const showConnector =
		!useCenterCard &&
		cardMeasureRect != null &&
		spotlightRect != null &&
		Boolean(step?.highlightSelector);

	const kbdHintId = useMemo(() => `${dialogTitleId}-kbd-hint`, [dialogTitleId]);

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
						aria-labelledby={dialogTitleId}
						aria-describedby={kbdHintId}
					>
						<div
							className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_78%_62%_at_50%_38%,transparent_0%,rgba(2,6,23,0.76)_108%)] opacity-95"
							style={{ zIndex: 0 }}
							aria-hidden
						/>
						{showConnector && cardMeasureRect && spotlightRect ? (
							<GuideTourCardConnector
								cardRect={cardMeasureRect}
								spotlightRect={spotlightRect}
								side={cardPlacementSide}
								zIndex={DESKTOP_Z_INDEX.MODAL_CONTENT - 1}
							/>
						) : null}
						{spotlightRect && step.highlightSelector ? (
							<>
								<GuideTourSpotlightFrame
									rect={spotlightRect}
									onDimClick={onClose}
									zMask={DESKTOP_Z_INDEX.MODAL}
									zGlow={DESKTOP_Z_INDEX.MODAL}
									zRing={DESKTOP_Z_INDEX.MODAL_CONTENT}
								/>
								{step.demoAction ? (
									<GuideTourActionDemo
										rect={spotlightRect}
										action={step.demoAction}
										caption={step.demoCaption}
										zIndex={DESKTOP_Z_INDEX.MODAL_CONTENT + 2}
									/>
								) : null}
							</>
						) : (
							<button
								type="button"
								className="fixed inset-0 border-0 bg-slate-950/82 p-0 backdrop-blur-[2px]"
								style={{ zIndex: DESKTOP_Z_INDEX.MODAL }}
								aria-label={labels.closeDimAria}
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
								cardPositionSpring
							)}
							className={GUIDE_TOUR_CARD_SHELL_CLASS}
							style={{ zIndex: GUIDE_CARD_Z }}
							onClick={(e) => e.stopPropagation()}
						>
							<div
								className={cn(
									'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/12',
									'bg-slate-950/96 shadow-[0_28px_80px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(255,255,255,0.05)]',
									'backdrop-blur-2xl backdrop-saturate-150'
								)}
							>
								<div
									className="pointer-events-none absolute inset-x-0 top-0 h-0.75 bg-[linear-gradient(90deg,rgba(139,92,246,0.15)_0%,rgba(167,139,250,0.85)_38%,rgba(157,255,0,0.75)_100%)]"
									aria-hidden
								/>
								<p id={kbdHintId} className="sr-only">
									{labels.kbdHint}
								</p>

								<div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 px-4 pb-3 pt-4 sm:gap-4 sm:px-5 sm:pb-4 sm:pt-5">
									<div className="flex shrink-0 items-start justify-between gap-3">
										<div className="min-w-0 flex-1 space-y-2">
											<div className="flex items-center justify-between gap-2">
												<span className="text-[10px] font-medium uppercase tracking-[0.28em] text-violet-200/80">
													{labels.badge}
												</span>
												<span
													className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-300"
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
												aria-label={labels.progressAria(
													stepIndex + 1,
													steps.length
												)}
											>
												<motion.div
													className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,rgba(139,92,246,0.95)_0%,rgba(196,181,253,0.85)_55%,rgba(157,255,0,0.75)_100%)] shadow-[0_0_14px_rgba(139,92,246,0.35)]"
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
											<div
												className="flex flex-wrap items-center gap-1"
												aria-hidden
											>
												{steps.map((s, i) => (
													<span
														key={s.id}
														className={cn(
															'h-1.5 rounded-full transition-all duration-200',
															i === stepIndex
																? 'w-5 bg-lime-300/90 shadow-[0_0_10px_rgba(157,255,0,0.35)]'
																: i < stepIndex
																	? 'w-1.5 bg-violet-400/70'
																	: 'w-1.5 bg-white/20'
														)}
													/>
												))}
											</div>
										</div>
										<div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
											<GuideTourVoiceSelector
												value={guideVoice}
												onChange={setGuideVoice}
											/>
											<DesktopChromeTooltip
												content={labels.audioToggleTitle}
												placement="top"
												offsetExtra={4}
											>
												<button
													type="button"
													onClick={() =>
														setGuideAudioPreference(!guideAudioEnabled)
													}
													aria-pressed={guideAudioEnabled}
													aria-label={labels.audioToggleAria}
													className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
												>
													{guideAudioEnabled ? (
														<SpeakerWaveIcon className="h-4 w-4" aria-hidden />
													) : (
														<SpeakerXMarkIcon className="h-4 w-4" aria-hidden />
													)}
												</button>
											</DesktopChromeTooltip>
											<DesktopChromeTooltip
												content={labels.closeAria}
												placement="top"
												offsetExtra={4}
											>
												<button
													type="button"
													onClick={onClose}
													aria-label={labels.closeAria}
													className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
												>
													<XMarkIcon className="h-4 w-4" aria-hidden />
												</button>
											</DesktopChromeTooltip>
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
														'text-violet-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-white/10'
													)}
													aria-hidden
												>
													<StepIcon className="h-6 w-6 sm:h-7 sm:w-7" />
												</div>
												<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
													<h2
														id={dialogTitleId}
														className="text-pretty text-lg font-semibold tracking-tight text-white sm:text-xl"
													>
														{step.title}
													</h2>
													<div className="max-h-[min(30vh,13.5rem)] min-h-0 overflow-y-auto pr-1 text-sm leading-relaxed text-slate-400 [scrollbar-color:rgba(100,116,139,0.5)_transparent] scrollbar-thin sm:text-[15px]">
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
												className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/45"
											>
												<ChevronLeftIcon className="h-4 w-4" aria-hidden />
												{labels.back}
											</button>
											<button
												type="button"
												onClick={onClose}
												className="rounded-xl px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
											>
												{labels.skip}
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
													className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/40 bg-violet-500/25 px-4 py-2 text-sm font-medium text-white shadow-[0_8px_28px_rgba(91,33,182,0.25)] transition-colors hover:bg-violet-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
												>
													{labels.next}
													<ChevronRightIcon className="h-4 w-4" aria-hidden />
												</button>
											) : (
												<button
													type="button"
													onClick={onClose}
													className="min-w-36 rounded-xl border border-violet-400/42 bg-violet-500/28 px-4 py-2.5 text-sm font-medium text-white shadow-[0_10px_32px_rgba(91,33,182,0.28)] transition-colors hover:bg-violet-500/38 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 sm:min-w-40"
												>
													{labels.finish}
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
