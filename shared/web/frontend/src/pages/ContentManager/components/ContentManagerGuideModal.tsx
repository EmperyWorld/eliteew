/**
 * Экскурсия по контент-менеджеру: виньетка, спотлайт и карточка — как AI Chat / workflow (violet glass).
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
import {
	DESKTOP_PORTAL_STACK_BUMP,
	DESKTOP_Z_INDEX,
} from '@/pages/Desktop/constants';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { cn } from '@/utils/cn';
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
	ArrowUpTrayIcon,
	ChartBarSquareIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	FolderOpenIcon,
	FunnelIcon,
	MagnifyingGlassIcon,
	SparklesIcon,
	SpeakerWaveIcon,
	SpeakerXMarkIcon,
	Squares2X2Icon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

export const CONTENT_MANAGER_ROOT_ID = 'content-manager-pro-root';

export const CONTENT_MANAGER_GUIDE_TOUR_FOLDER = 'content-manager-guide';

const GUIDE_AUDIO_LS_KEY = 'cm-guide-audio-enabled';

type GuideStep = {
	id: string;
	title: string;
	body: string;
	highlightSelector: string | null;
};

const STEP_ICON: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
	intro: SparklesIcon,
	tabs: Squares2X2Icon,
	'header-actions': ArrowUpTrayIcon,
	'files-search-toolbar': MagnifyingGlassIcon,
	'files-panel-toolbar': FunnelIcon,
	'files-panel': FolderOpenIcon,
	'more-tabs': ChartBarSquareIcon,
};

const STEPS: GuideStep[] = [
	{
		id: 'intro',
		title: 'Файловый менеджер',
		body: 'Единое хранилище файлов: загрузка, папки, поиск, версии и шаринг. Ниже несколько коротких остановок — листайте стрелками или кнопками, закрыть можно в любой момент.',
		highlightSelector: null,
	},
	{
		id: 'tabs',
		title: 'Вкладки',
		body: 'Файлы, версии, доступы, комментарии, дубликаты, статистика и теги — переключайте сценарии без смены окна. Часть шагов экскурсии вернёт вас на вкладку «Файлы», чтобы показать панель списка.',
		highlightSelector: '[data-cm-guide="tabs"]',
	},
	{
		id: 'header-actions',
		title: 'Обновить и загрузить',
		body: 'Обновление списка, загрузка с диска в раздел «Без папки» и выгрузка архива ваших файлов — всё в одной полосе у верхней кромки.',
		highlightSelector: '[data-cm-guide="header-actions"]',
	},
	{
		id: 'files-search-toolbar',
		title: 'Поиск и папки',
		body: 'Слева — строка поиска, расширенный поиск и дерево папок в режиме «Проводник». Справа над списком — понятная панель: где смотреть файлы, сортировка, вид, фильтры и выбор.',
		highlightSelector: '[data-cm-guide="files-search-toolbar"]',
	},
	{
		id: 'files-panel-toolbar',
		title: 'Над сеткой файлов',
		body: 'Вверху — переключатель «Проводник / Каталог / Все файлы». Ниже — сортировка, вид сеткой или списком, фильтры и режим выбора для пакетных действий.',
		highlightSelector: '[data-cm-guide="files-panel-toolbar"]',
	},
	{
		id: 'files-panel',
		title: 'Список и превью',
		body: 'Здесь карточки или строки файлов: откройте файл, выделите несколько для пакетных действий, перетащите в папки в режиме проводника.',
		highlightSelector: '[data-cm-guide="files-panel"]',
	},
	{
		id: 'more-tabs',
		title: 'Остальные вкладки',
		body: 'Версии и откат, расшаренное, обсуждения к файлу, поиск дубликатов, сводка по объёму и активности, облако тегов — переключайтесь через верхние вкладки, когда понадобится.',
		highlightSelector: null,
	},
];

export interface ContentManagerGuideModalProps {
	open: boolean;
	onClose: () => void;
	/** Переключить вкладку / состояние до измерения спотлайта (например на «Файлы»). */
	onPrepareStep?: (stepId: string) => void;
	/** Меняется при смене вкладки контент-менеджера — пересчёт rect спотлайта после монтирования панели «Файлы». */
	spotlightLayoutKey?: string;
}

export const ContentManagerGuideModal: React.FC<
	ContentManagerGuideModalProps
> = (props) => {
	const { open, onClose, spotlightLayoutKey = '', onPrepareStep } = props;
	const portalStackBase = useDesktopWindowPortalStackBase();
	const reduceMotion = useReducedMotion();
	const steps = useMemo(() => STEPS, []);

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
		CONTENT_MANAGER_GUIDE_TOUR_FOLDER
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
			spotlightLayoutKey,
		});

	const guidePortalShellRef = useRef<HTMLDivElement | null>(null);
	useSyncDesktopThemeFromMain(open && Boolean(step), guidePortalShellRef);

	const onPrepareStepRef = useRef(onPrepareStep);
	onPrepareStepRef.current = onPrepareStep;

	useEffect(() => {
		if (!open || !step) return;
		onPrepareStepRef.current?.(step.id);
	}, [open, step?.id, step]);

	useEffect(() => {
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
		void spotlightLayoutKey;
		if (!open || !step?.highlightSelector) {
			setSpotlightRect(null);
			return;
		}
		const root = document.getElementById(CONTENT_MANAGER_ROOT_ID);
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
		const root = document.getElementById(CONTENT_MANAGER_ROOT_ID);
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
						aria-labelledby="cm-guide-title"
						aria-describedby="cm-guide-kbd-hint"
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
								className="fixed inset-0 border-0 bg-slate-950/82 p-0 backdrop-blur-[2px]"
								style={{ zIndex: DESKTOP_Z_INDEX.MODAL }}
								aria-label="Закрыть подсказку"
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
									'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/12',
									'bg-slate-950/96 shadow-[0_28px_80px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(255,255,255,0.05)]',
									'backdrop-blur-2xl backdrop-saturate-150'
								)}
							>
								<div
									className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-violet-400/50 to-transparent"
									aria-hidden
								/>

								<p id="cm-guide-kbd-hint" className="sr-only">
									Листать шаги: стрелки влево и вправо, Home и End — к первому и
									последнему шагу, или выберите шаг кнопками прогресса. Закрыть:
									Escape.
								</p>

								<div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 px-4 pb-3 pt-4 sm:gap-4 sm:px-5 sm:pb-4 sm:pt-5">
									<div className="flex shrink-0 items-start justify-between gap-3">
										<div className="min-w-0 flex-1 space-y-2">
											<div className="flex flex-wrap items-center gap-2">
												<span className="text-[10px] font-medium uppercase tracking-[0.28em] text-violet-200/80">
													Экскурсия
												</span>
												<span
													className="tabular-nums text-[11px] font-semibold text-violet-300/95"
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
												aria-label={`Шаг ${stepIndex + 1} из ${steps.length}`}
											>
												<motion.div
													className="absolute inset-y-0 left-0 rounded-full bg-violet-500 shadow-[0_0_14px_rgba(139,92,246,0.35)]"
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
														? 'Выключить озвучку экскурсии'
														: 'Включить озвучку экскурсии'
												}
												title={
													guideAudioEnabled
														? 'Озвучка экскурсии включена'
														: 'Озвучка экскурсии выключена'
												}
												className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
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
												className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
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
														'bg-[linear-gradient(145deg,rgba(139,92,246,0.35)_0%,rgba(30,27,75,0.9)_100%)]',
														'text-violet-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-white/10'
													)}
													aria-hidden
												>
													<StepIcon className="h-6 w-6 sm:h-7 sm:w-7" />
												</div>
												<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
													<h2
														id="cm-guide-title"
														className="text-balance text-lg font-semibold tracking-tight text-white sm:text-xl"
													>
														{step.title}
													</h2>
													<div className="max-h-[min(30vh,13.5rem)] min-h-0 overflow-y-auto pr-1 text-sm leading-relaxed text-slate-400 [scrollbar-color:rgba(100,116,139,0.5)_transparent] [scrollbar-width:thin] sm:text-[15px]">
														{step.body}
													</div>
												</div>
											</motion.div>
										</AnimatePresence>
									</div>

									<nav
										className="flex flex-col gap-3 border-t border-white/10 pt-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:pt-4"
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
														'relative flex h-9 min-w-9 items-center justify-center rounded-xl text-[11px] font-semibold tabular-nums transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 motion-reduce:transition-none',
														i === stepIndex
															? 'scale-[1.02] bg-violet-500 text-white shadow-[0_10px_28px_-8px_rgba(139,92,246,0.45)]'
															: 'bg-white/6 text-slate-500 hover:bg-white/10 hover:text-slate-300'
													)}
												>
													{i + 1}
												</button>
											))}
										</div>
										<p className="text-[10px] text-slate-600" aria-hidden>
											← → · Home · End · Esc
										</p>
									</nav>

									<div className="flex shrink-0 flex-wrap items-center justify-between gap-2 sm:gap-3">
										<div className="flex flex-wrap items-center gap-1">
											<button
												type="button"
												onClick={() => setStepIndex((i) => (i > 0 ? i - 1 : i))}
												disabled={isFirst}
												className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/45"
											>
												<ChevronLeftIcon className="h-4 w-4" />
												Назад
											</button>
											<button
												type="button"
												onClick={onClose}
												className="rounded-xl px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
											>
												Пропустить
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
													Далее
													<ChevronRightIcon className="h-4 w-4" />
												</button>
											) : (
												<button
													type="button"
													onClick={onClose}
													className="min-w-36 rounded-xl border border-violet-400/42 bg-violet-500/28 px-4 py-2.5 text-sm font-medium text-white shadow-[0_10px_32px_rgba(91,33,182,0.28)] transition-colors hover:bg-violet-500/38 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 sm:min-w-40"
												>
													Завершить тур
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
