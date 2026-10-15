/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Fullscreen Empery Nexus Chronicle — cold-open ritual then living atlas.
 *
 * Invariants:
 * - Lazy chunk only for three / R3F / Motion / postprocessing / audio.
 * - Cold-open skippable; reduced-motion jumps to atlas.
 *
 * Related:
 * - documentation/product/EMPERY-NEXUS-CHRONICLE.md
 */

import '@fontsource/cinzel/500.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/600.css';

import { EMPERY_NEXUS_CHRONICLE_NS } from '@/i18n/namespaces';
import type { NavigationHandler } from '@/types/navigation';
import { animate } from 'framer-motion';
import {
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactElement,
} from 'react';
import { useTranslation } from 'react-i18next';
import { chronicleAmbientBus } from './audio/chronicleAmbientBus';
import {
	ChronicleSceneProvider,
	type ChronicleSceneApi,
} from './ChronicleSceneContext';
import {
	chapterById,
	cycleChronicleChapter,
	cycleChronicleDomain,
	type ChronicleChapterId,
} from './data/chronicleChapters';
import {
	findChronicleDomain,
	type ChronicleDomainId,
	type RealityLayerId,
} from './data/chronicleManifest';
import {
	initialChroniclePhase,
	markColdOpenDone,
	type ChroniclePhase,
	useCinematicColdOpen,
} from './motion/useCinematicColdOpen';
import { ChronicleColdOpen } from './ui/ChronicleColdOpen';
import { ChronicleHelpOverlay } from './ui/ChronicleHelpOverlay';
import { ChronicleHud } from './ui/ChronicleHud';
import './ui/chronicleTokens.css';

const ChronicleCanvasLazy = lazy(() =>
	import('./scene/ChronicleCanvas').then((m) => ({
		default: m.ChronicleCanvas,
	}))
);

export type EmperyNexusChroniclePageProps = {
	onNavigate: NavigationHandler;
};

function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined' || !window.matchMedia) return false;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return (
		target.tagName === 'INPUT' ||
		target.tagName === 'TEXTAREA' ||
		target.isContentEditable
	);
}

export function EmperyNexusChroniclePage({
	onNavigate,
}: EmperyNexusChroniclePageProps): ReactElement {
	const { t } = useTranslation(EMPERY_NEXUS_CHRONICLE_NS);
	const [phase, setPhase] = useState<ChroniclePhase>(() =>
		initialChroniclePhase()
	);
	const [coldLineKey, setColdLineKey] = useState('coldOpen.lineHusk');
	const [layer, setLayer] = useState<RealityLayerId>('mask');
	const [pulse, setPulse] = useState(0);
	const [rebirthKey, setRebirthKey] = useState(0);
	const [selectedDomainId, setSelectedDomainId] =
		useState<ChronicleDomainId | null>(null);
	const [chapterId, setChapterIdState] = useState<ChronicleChapterId>('husk');
	const [cinemaMode, setCinemaMode] = useState(false);
	const [helpOpen, setHelpOpen] = useState(false);
	const [muted, setMuted] = useState(() => chronicleAmbientBus.isMuted());
	const [audioNeedsGesture, setAudioNeedsGesture] = useState(() =>
		chronicleAmbientBus.needsGesture()
	);
	const pulseAnimationRef = useRef<{ stop: () => void } | null>(null);
	const pulseResetTimerRef = useRef<number | null>(null);

	const emitPulse = useCallback(() => {
		chronicleAmbientBus.pulseHit();
		pulseAnimationRef.current?.stop();
		if (pulseResetTimerRef.current !== null) {
			window.clearTimeout(pulseResetTimerRef.current);
			pulseResetTimerRef.current = null;
		}
		if (prefersReducedMotion()) {
			setPulse(0.35);
			pulseResetTimerRef.current = window.setTimeout(() => {
				setPulse(0);
				pulseResetTimerRef.current = null;
			}, 400);
			return;
		}
		setPulse(1);
		pulseAnimationRef.current = animate(1, 0, {
			duration: 1.6,
			ease: 'easeOut',
			onUpdate: setPulse,
			onComplete: () => {
				setPulse(0);
				pulseAnimationRef.current = null;
			},
		});
	}, []);

	useEffect(
		() => () => {
			pulseAnimationRef.current?.stop();
			if (pulseResetTimerRef.current !== null) {
				window.clearTimeout(pulseResetTimerRef.current);
			}
		},
		[]
	);

	const replayRebirth = useCallback(() => {
		chronicleAmbientBus.rebirthHit();
		setRebirthKey((k) => k + 1);
	}, []);

	const focusDomain = useCallback((id: ChronicleDomainId | null) => {
		setSelectedDomainId(id);
		if (!id) return;
		const domain = findChronicleDomain(id);
		if (domain) setLayer(domain.layer);
	}, []);

	const cycleDomain = useCallback(
		(direction: 1 | -1) => {
			const next = cycleChronicleDomain(selectedDomainId, direction);
			focusDomain(next);
		},
		[selectedDomainId, focusDomain]
	);

	const setChapterId = useCallback(
		(id: ChronicleChapterId) => {
			setChapterIdState(id);
			setLayer(chapterById(id).layer);
			emitPulse();
		},
		[emitPulse]
	);

	const cycleChapter = useCallback(
		(direction: 1 | -1) => {
			const next = cycleChronicleChapter(chapterId, direction);
			setChapterId(next);
		},
		[chapterId, setChapterId]
	);

	const enterAtlas = useCallback(() => {
		markColdOpenDone();
		setPhase('atlas');
		chronicleAmbientBus.setMode('atlas');
	}, []);

	const skipColdOpen = useCallback(() => {
		void chronicleAmbientBus.unlock();
		enterAtlas();
	}, [enterAtlas]);

	useCinematicColdOpen({
		active: phase === 'coldOpen',
		onBeat: ({ chapter, layer: nextLayer, lineKey }) => {
			setChapterIdState(chapter);
			setLayer(nextLayer);
			setColdLineKey(lineKey);
		},
		onComplete: enterAtlas,
		onRebirth: replayRebirth,
	});

	useEffect(() => {
		chronicleAmbientBus.setMode(phase === 'coldOpen' ? 'coldOpen' : 'atlas');
		return () => {
			chronicleAmbientBus.setMode('off');
		};
	}, [phase]);

	useEffect(() => {
		if (phase !== 'atlas' || prefersReducedMotion()) return;
		const timer = window.setTimeout(() => {
			setRebirthKey((k) => k + 1);
		}, 600);
		return () => window.clearTimeout(timer);
	}, [phase]);

	const unlockAudio = useCallback(async () => {
		await chronicleAmbientBus.unlock();
		if (!chronicleAmbientBus.isMuted()) {
			chronicleAmbientBus.setMode(phase === 'coldOpen' ? 'coldOpen' : 'atlas');
		}
		setAudioNeedsGesture(chronicleAmbientBus.needsGesture());
		setMuted(chronicleAmbientBus.isMuted());
	}, [phase]);

	useEffect(() => {
		const id = window.setInterval(() => {
			setAudioNeedsGesture(chronicleAmbientBus.needsGesture());
		}, 800);
		return () => window.clearInterval(id);
	}, []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (isTypingTarget(e.target)) return;

			if (phase === 'coldOpen') {
				if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					skipColdOpen();
				}
				return;
			}

			if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
				e.preventDefault();
				setHelpOpen((v) => !v);
				return;
			}
			if (e.key === 'h' || e.key === 'H') {
				e.preventDefault();
				setCinemaMode((v) => !v);
				return;
			}
			if (e.key === 'm' || e.key === 'M') {
				e.preventDefault();
				const next = chronicleAmbientBus.toggleMute();
				setMuted(next);
				setAudioNeedsGesture(chronicleAmbientBus.needsGesture());
				if (!next) {
					void unlockAudio();
				}
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				if (helpOpen) {
					setHelpOpen(false);
					return;
				}
				if (cinemaMode) {
					setCinemaMode(false);
					return;
				}
				onNavigate('desktop');
				return;
			}

			if (helpOpen) return;

			if (e.key === '1') setLayer('mask');
			if (e.key === '2') setLayer('muscle');
			if (e.key === '3') setLayer('soul');
			if (e.key === '[' || e.key === 'ArrowLeft') {
				e.preventDefault();
				cycleDomain(-1);
			}
			if (e.key === ']' || e.key === 'ArrowRight') {
				e.preventDefault();
				cycleDomain(1);
			}
			if (e.key === 'n' || e.key === 'N') {
				e.preventDefault();
				cycleChapter(1);
			}
			if (e.key === 'p' || e.key === 'P') {
				e.preventDefault();
				cycleChapter(-1);
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [
		phase,
		onNavigate,
		cycleDomain,
		cycleChapter,
		helpOpen,
		cinemaMode,
		skipColdOpen,
		unlockAudio,
	]);

	const api = useMemo<ChronicleSceneApi>(
		() => ({
			layer,
			setLayer,
			pulse,
			emitPulse,
			rebirthKey,
			replayRebirth,
			selectedDomainId,
			setSelectedDomainId,
			focusDomain,
			cycleDomain,
			chapterId,
			setChapterId,
			cycleChapter,
		}),
		[
			layer,
			pulse,
			emitPulse,
			rebirthKey,
			replayRebirth,
			selectedDomainId,
			focusDomain,
			cycleDomain,
			chapterId,
			setChapterId,
			cycleChapter,
		]
	);

	return (
		<section
			className="empery-nexus-chronicle"
			data-testid="empery-nexus-chronicle"
			data-phase={phase}
			data-chapter={chapterId}
			data-layer={layer}
			data-cinema={cinemaMode ? '1' : '0'}
			aria-label={t('ariaLabel')}
			onPointerDown={() => {
				void unlockAudio();
			}}
		>
			<ChronicleSceneProvider value={api}>
				<Suspense
					fallback={
						<div
							className="empery-nexus-chronicle__awakening"
							role="status"
							aria-live="polite"
						>
							{t('awakening')}
						</div>
					}
				>
					<ChronicleCanvasLazy />
				</Suspense>
				{phase === 'coldOpen' ? (
					<ChronicleColdOpen
						lineKey={coldLineKey}
						onSkip={skipColdOpen}
						audioNeedsGesture={audioNeedsGesture}
						onAwakenAudio={() => {
							void unlockAudio();
						}}
					/>
				) : (
					<ChronicleHud
						onNavigate={onNavigate}
						cinemaMode={cinemaMode}
						muted={muted}
						audioNeedsGesture={audioNeedsGesture}
						onToggleCinema={() => setCinemaMode((v) => !v)}
						onToggleHelp={() => setHelpOpen((v) => !v)}
						onToggleMute={() => {
							const next = chronicleAmbientBus.toggleMute();
							setMuted(next);
							setAudioNeedsGesture(chronicleAmbientBus.needsGesture());
							if (!next) {
								void unlockAudio();
							}
						}}
						onAwakenAudio={() => {
							void unlockAudio();
						}}
					/>
				)}
				<ChronicleHelpOverlay
					open={helpOpen}
					onClose={() => setHelpOpen(false)}
				/>
			</ChronicleSceneProvider>
		</section>
	);
}

export default EmperyNexusChroniclePage;
