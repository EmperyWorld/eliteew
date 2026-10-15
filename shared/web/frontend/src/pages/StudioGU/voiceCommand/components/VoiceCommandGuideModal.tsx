/**
 * Пошаговый тур по Голосовому штабу: виньетка, спотлайт и карточка — токены desktop shell (glass / accent).
 */

import { GuideTourSpotlightFrame } from '@/components/guided-tour/GuideTourSpotlightFrame';
import { GuideTourVoiceSelector } from '@/components/guided-tour/GuideTourVoiceSelector';
import { useGuideTourResolvedAudioPath } from '@/components/guided-tour/useGuideTourResolvedAudioPath';
import { useGuideTourVoicePreference } from '@/components/guided-tour/useGuideTourVoicePreference';
import {
	GUIDE_TOUR_CARD_SHELL_CLASS,
	guideTourCardMotionAnimate,
	guideTourCardMotionExit,
	guideTourCardMotionInitial,
	guideTourCardPositionTransition,
} from '@/components/guided-tour/guideTourCardMotion';
import { useGuideTourFloatingCardPosition } from '@/components/guided-tour/useGuideTourFloatingCardPosition';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import {
	DESKTOP_OVERLAY,
	DESKTOP_PORTAL_STACK_BUMP,
	DESKTOP_Z_INDEX,
} from '@/pages/Desktop/constants';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import {
	getDesktopShellProgressTrackClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '@/pages/Desktop/utils/desktopVisualSystem';
import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import * as React from 'react';
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type ComponentType,
	type SVGProps,
} from 'react';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';
import { useSyncDesktopThemeFromMain } from '@/pages/Desktop/hooks/useSyncDesktopThemeFromMain';
import {
	BoltIcon,
	BookOpenIcon,
	ChartBarIcon,
	ChatBubbleLeftRightIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	MicrophoneIcon,
	SparklesIcon,
	SpeakerWaveIcon,
	SpeakerXMarkIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

export const VOICE_COMMAND_CENTER_DOM_ID = 'voice-command-center-root';

export const VOICE_COMMAND_GUIDE_TOUR_FOLDER = 'voice-command-guide';

/** Локально: озвучка тура не смешивается с «озвучивать ответы» в настройках штаба. */
const GUIDE_AUDIO_LS_KEY = 'vcc-guide-audio-enabled';

type GuideStepDef = {
	id: string;
	highlightSelector: string | null;
	onlyEmbedded?: boolean;
	hideWhenEmbedded?: boolean;
};

type GuideStep = GuideStepDef & {
	title: string;
	body: string;
};

const STEP_ICON: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
	intro: SparklesIcon,
	toolbar: ChartBarIcon,
	'embedded-bar': BookOpenIcon,
	shortcuts: BoltIcon,
	messages: ChatBubbleLeftRightIcon,
	controls: MicrophoneIcon,
};

const STEP_DEFS: GuideStepDef[] = [
	{
		id: 'intro',
		highlightSelector: null,
	},
	{
		id: 'toolbar',
		highlightSelector: '[data-vcc-guide="toolbar"]',
		hideWhenEmbedded: true,
	},
	{
		id: 'embedded-bar',
		highlightSelector: '[data-vcc-guide="embedded-bar"]',
		onlyEmbedded: true,
	},
	{
		id: 'shortcuts',
		highlightSelector: '[data-vcc-guide="shortcuts"]',
	},
	{
		id: 'messages',
		highlightSelector: '[data-vcc-guide="messages"]',
	},
	{
		id: 'controls',
		highlightSelector: '[data-vcc-guide="controls"]',
	},
];

export interface VoiceCommandGuideModalProps {
	open: boolean;
	onClose: () => void;
	embeddedInStudio: boolean;
}

export const VoiceCommandGuideModal: React.FC<VoiceCommandGuideModalProps> = ({
	open,
	onClose,
	embeddedInStudio,
}) => {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'voiceCommand' });
	const portalStackBase = useDesktopWindowPortalStackBase();
	const reduceMotion = useReducedMotion();
	const shellFrame = useDesktopShellFrame();
	const guideInsetIconButton = cn(
		getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
		'rounded-xl p-2 text-(--desktop-text-muted) transition-colors hover:text-(--desktop-text-secondary)',
		DESKTOP_CHROME_FOCUS_VISIBLE
	);
	const guideProgressTrackClass = cn(
		getDesktopShellProgressTrackClassName(shellFrame),
		'relative h-1 w-full overflow-hidden rounded-full'
	);
	const steps = useMemo(
		() =>
			STEP_DEFS.filter((s) => {
				if (s.onlyEmbedded && !embeddedInStudio) return false;
				if (s.hideWhenEmbedded && embeddedInStudio) return false;
				return true;
			}).map(
				(s): GuideStep => ({
					...s,
					title: t(`guide.steps.${s.id}.title` as never),
					body: t(`guide.steps.${s.id}.body` as never),
				})
			),
		[embeddedInStudio, t]
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
		VOICE_COMMAND_GUIDE_TOUR_FOLDER
	);

	useEffect(() => {
		if (open) setStepIndex(0);
	}, [open]);

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

	const { guideCardWrapRef, floatingCardStyle, useCenterCard } =
		useGuideTourFloatingCardPosition({
			open,
			spotlightRect,
			hasHighlight: Boolean(step?.highlightSelector),
			stepIndex,
		});

	const guidePortalShellRef = useRef<HTMLDivElement | null>(null);
	useSyncDesktopThemeFromMain(open && Boolean(step), guidePortalShellRef);

	useLayoutEffect(() => {
		if (!open || !step) return;

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
	}, [open, guideAudioEnabled, step?.id, step, resolveAudioPath]);

	const updateRect = useCallback(() => {
		if (!open || !step?.highlightSelector) {
			setSpotlightRect(null);
			return;
		}
		const root = document.getElementById(VOICE_COMMAND_CENTER_DOM_ID);
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
	}, [open, step?.highlightSelector]);

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
		const root = document.getElementById(VOICE_COMMAND_CENTER_DOM_ID);
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
						aria-labelledby="vcc-guide-title"
						aria-describedby="vcc-guide-kbd-hint"
					>
						<div
							className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_78%_62%_at_50%_38%,transparent_0%,rgba(2,6,23,0.72)_108%)] opacity-95"
							style={{ zIndex: 0 }}
							aria-hidden
						/>
						{spotlightRect && step.highlightSelector ? (
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
								className={cn(
									'fixed inset-0 border-0 p-0',
									DESKTOP_OVERLAY.backdrop
								)}
								style={{ zIndex: DESKTOP_Z_INDEX.MODAL }}
								aria-label={t('actions.close')}
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
								className={cn(
									'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-(--glass-border)',
									'bg-[color-mix(in_srgb,var(--glass-bg-strong)_90%,rgb(var(--desktop-bg-primary-rgb)/0.1))]',
									'shadow-[0_28px_80px_rgba(0,0,0,0.52),inset_0_0_0_1px_rgb(var(--desktop-fg-primary-rgb)/0.06)]',
									'backdrop-blur-2xl backdrop-saturate-150'
								)}
							>
								<div
									className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[rgb(var(--desktop-accent-rgb)/0.45)] to-transparent"
									aria-hidden
								/>

								<p id="vcc-guide-kbd-hint" className="sr-only">
									Листать шаги: стрелки влево и вправо, Home и End — к первому и
									последнему шагу, или выберите шаг кнопками прогресса. Закрыть:
									Escape.
								</p>

								<div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 px-4 pb-3 pt-4 sm:gap-4 sm:px-5 sm:pb-4 sm:pt-5">
									<div className="flex shrink-0 items-start justify-between gap-3">
										<div className="min-w-0 flex-1 space-y-2">
											<div className="flex flex-wrap items-center gap-2">
												<span className="text-[10px] font-medium uppercase tracking-[0.28em] text-(--desktop-text-secondary)">
													Экскурсия
												</span>
												<span
													className="tabular-nums text-[11px] font-semibold text-[rgb(var(--desktop-accent-rgb)/0.92)]"
													aria-hidden
												>
													{stepIndex + 1}/{steps.length}
												</span>
											</div>
											<div
												className={guideProgressTrackClass}
												role="progressbar"
												aria-valuemin={1}
												aria-valuenow={stepIndex + 1}
												aria-valuemax={steps.length}
												aria-label={`Шаг ${stepIndex + 1} из ${steps.length}`}
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
											<button
												type="button"
												onClick={() =>
													setGuideAudioPreference(!guideAudioEnabled)
												}
												aria-pressed={guideAudioEnabled}
												aria-label={
													guideAudioEnabled
														? t('guide.audioOffAria')
														: t('guide.audioOnAria')
												}
												title={
													guideAudioEnabled
														? t('guide.audioOffAria')
														: t('guide.audioOnAria')
												}
												className={guideInsetIconButton}
											>
												{guideAudioEnabled ? (
													<SpeakerWaveIcon className="h-4 w-4" />
												) : (
													<SpeakerXMarkIcon className="h-4 w-4" />
												)}
											</button>
											<button
												type="button"
												onClick={onClose}
												aria-label="Закрыть"
												className={cn(
													guideInsetIconButton,
													'hover:text-(--desktop-text-primary)'
												)}
											>
												<XMarkIcon className="h-4 w-4" />
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
														'bg-[linear-gradient(145deg,rgb(var(--desktop-accent-rgb)/0.32)_0%,color-mix(in_srgb,var(--desktop-surface-soft)_72%,rgb(var(--desktop-bg-primary-rgb)/0.85))_100%)]',
														'text-[rgb(var(--desktop-fg-primary-rgb))] shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.12)] ring-1 ring-[rgb(var(--desktop-fg-primary-rgb)/0.1)]'
													)}
													aria-hidden
												>
													<StepIcon className="h-6 w-6 sm:h-7 sm:w-7" />
												</div>
												<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
													<h2
														id="vcc-guide-title"
														className="text-balance text-lg font-semibold tracking-tight text-(--desktop-text-primary) sm:text-xl"
													>
														{step.title}
													</h2>
													<div className="max-h-[min(30vh,13.5rem)] min-h-0 overflow-y-auto pr-1 text-sm leading-relaxed text-(--desktop-text-muted) [scrollbar-color:color-mix(in_srgb,var(--desktop-text-primary)_22%,transparent)_transparent] scrollbar-thin sm:text-[15px]">
														{step.body}
													</div>
												</div>
											</motion.div>
										</AnimatePresence>
									</div>

									<nav
										className="flex flex-col gap-3 border-t border-(--desktop-border-subtle) pt-3 shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.05)] sm:pt-4"
										aria-label="Прогресс тура"
									>
										<div
											className="flex flex-wrap items-center gap-2"
											role="tablist"
											aria-label="Шаги тура"
										>
											{steps.map((s, i) => (
												<button
													key={s.id}
													type="button"
													role="tab"
													title={s.title}
													aria-selected={i === stepIndex}
													aria-label={`Шаг ${i + 1}: ${s.title}`}
													onClick={() => setStepIndex(i)}
													className={cn(
														'relative flex h-9 min-w-9 items-center justify-center rounded-xl text-[11px] font-semibold tabular-nums transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] motion-reduce:transition-none',
														i === stepIndex
															? 'scale-[1.02] bg-[rgb(var(--desktop-accent-rgb))] text-[rgb(var(--desktop-fg-primary-rgb))] shadow-[0_10px_28px_-8px_rgb(var(--desktop-accent-rgb)/0.38)]'
															: 'bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)] text-(--desktop-text-dim) hover:bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.14)_100%,transparent)] hover:text-(--desktop-text-secondary)'
													)}
												>
													{i + 1}
												</button>
											))}
										</div>
										<p
											className="text-[10px] text-(--desktop-text-dim)"
											aria-hidden
										>
											← → · Home · End · Esc
										</p>
									</nav>

									<div className="flex shrink-0 flex-wrap items-center justify-between gap-2 sm:gap-3">
										<div className="flex flex-wrap items-center gap-1">
											<button
												type="button"
												onClick={() => setStepIndex((i) => (i > 0 ? i - 1 : i))}
												disabled={isFirst}
												className={cn(
													getDesktopShellToolbarClusterInsetControlClassName(
														shellFrame
													),
													'inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium text-(--desktop-text-secondary) transition-colors hover:text-(--desktop-text-primary) disabled:opacity-40',
													DESKTOP_CHROME_FOCUS_VISIBLE
												)}
											>
												<ChevronLeftIcon className="h-4 w-4" />
												{t('guide.back')}
											</button>
											<button
												type="button"
												onClick={onClose}
												className="rounded-xl px-3 py-2 text-xs font-medium text-(--desktop-text-dim) transition-colors hover:text-(--desktop-text-secondary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.35)]"
											>
												{t('guide.skip')}
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
													className="inline-flex items-center gap-1.5 rounded-xl border border-[rgb(var(--desktop-accent-rgb)/0.42)] bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_26%,var(--desktop-surface-soft))] px-4 py-2 text-sm font-medium text-[rgb(var(--desktop-fg-primary-rgb))] shadow-[0_8px_28px_rgb(var(--desktop-accent-rgb)/0.22)] transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]"
												>
													{t('guide.next')}
													<ChevronRightIcon className="h-4 w-4" />
												</button>
											) : (
												<button
													type="button"
													onClick={onClose}
													className="min-w-36 rounded-xl border border-[rgb(var(--desktop-accent-rgb)/0.42)] bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_28%,var(--desktop-surface-soft))] px-4 py-2.5 text-sm font-medium text-[rgb(var(--desktop-fg-primary-rgb))] shadow-[0_10px_32px_rgb(var(--desktop-accent-rgb)/0.24)] transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] sm:min-w-40"
												>
													{t('guide.finish')}
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
