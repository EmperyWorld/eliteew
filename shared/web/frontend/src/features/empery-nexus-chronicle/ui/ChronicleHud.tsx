/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Living-atlas HUD — hierarchy, chapters, layers, domain inspector, exit.
 *
 * Invariants:
 * - Primary CTA is Return to World; cinema keeps exit + restore.
 * - All user-facing copy from emperyNexusChronicle i18n.
 *
 * Related:
 * - EmperyNexusChroniclePage.tsx
 */

import { EMPERY_NEXUS_CHRONICLE_NS } from '@/i18n/namespaces';
import type { NavigationHandler } from '@/types/navigation';
import { useTranslation } from 'react-i18next';
import { useChronicleScene } from '../ChronicleSceneContext';
import { CHRONICLE_CHAPTERS } from '../data/chronicleChapters';
import {
	CHRONICLE_MANIFEST,
	findChronicleDomain,
	type RealityLayerId,
} from '../data/chronicleManifest';

type ChronicleHudProps = {
	onNavigate: NavigationHandler;
	cinemaMode: boolean;
	muted: boolean;
	audioNeedsGesture: boolean;
	onToggleCinema: () => void;
	onToggleHelp: () => void;
	onToggleMute: () => void;
	onAwakenAudio: () => void;
};

const LAYER_IDS = [
	'mask',
	'muscle',
	'soul',
] as const satisfies RealityLayerId[];

export function ChronicleHud({
	onNavigate,
	cinemaMode,
	muted,
	audioNeedsGesture,
	onToggleCinema,
	onToggleHelp,
	onToggleMute,
	onAwakenAudio,
}: ChronicleHudProps) {
	const { t, i18n } = useTranslation(EMPERY_NEXUS_CHRONICLE_NS);
	const {
		layer,
		setLayer,
		emitPulse,
		replayRebirth,
		selectedDomainId,
		focusDomain,
		chapterId,
		setChapterId,
		cycleChapter,
	} = useChronicleScene();
	const locale = i18n.resolvedLanguage?.startsWith('en') ? 'en-US' : 'ru-RU';
	const selected = findChronicleDomain(selectedDomainId);

	if (cinemaMode) {
		return (
			<div className="empery-nexus-chronicle__hud empery-nexus-chronicle__hud--cinema">
				<div className="empery-nexus-chronicle__cinema-bar">
					<p className="empery-nexus-chronicle__hint">{t('hints.cinema')}</p>
					<div className="empery-nexus-chronicle__controls">
						<button
							type="button"
							className="empery-nexus-chronicle__btn"
							onClick={onToggleMute}
						>
							{muted ? t('actions.toggleUnmute') : t('actions.toggleMute')}
						</button>
						<button
							type="button"
							className="empery-nexus-chronicle__btn"
							onClick={onToggleCinema}
						>
							{t('actions.toggleCinema')}
						</button>
						<button
							type="button"
							className="empery-nexus-chronicle__btn empery-nexus-chronicle__btn--primary"
							onClick={() => onNavigate('desktop')}
						>
							{t('actions.return')}
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="empery-nexus-chronicle__hud">
			<header>
				<p className="empery-nexus-chronicle__brand">{t('brand')}</p>
				<p className="empery-nexus-chronicle__subtitle-archaic">
					{t('subtitleArchaic')}
				</p>
				<p className="empery-nexus-chronicle__subtitle">
					{t('tagline', { title: t('title') })}
				</p>

				<nav
					className="empery-nexus-chronicle__hierarchy"
					aria-label={t('hierarchy.ariaLabel')}
					data-testid="empery-nexus-hierarchy"
				>
					<span>{t('hierarchy.empery')}</span>
					<span aria-hidden="true">→</span>
					<span>{t('hierarchy.world')}</span>
					<span aria-hidden="true">→</span>
					<span className="empery-nexus-chronicle__hierarchy-active">
						{t('hierarchy.nexus')}
					</span>
					<span aria-hidden="true">→</span>
					<span>{t('hierarchy.eliteew')}</span>
				</nav>
				<p className="empery-nexus-chronicle__hint">{t('hierarchy.hint')}</p>

				<details className="empery-nexus-chronicle__stats-disclosure">
					<summary>{t('mythicScaleCaption')}</summary>
					<div className="empery-nexus-chronicle__stats" aria-live="polite">
						<span>
							<strong>
								{(CHRONICLE_MANIFEST.measuredLinesOfCode / 1_000_000).toFixed(
									2
								)}
								M
							</strong>{' '}
							{t('stats.measuredLoc')}
						</span>
						<span>
							<strong>{CHRONICLE_MANIFEST.commits30d}</strong>{' '}
							{t('stats.commits30d')}
						</span>
						<span>
							<strong>
								{CHRONICLE_MANIFEST.fileCountMeasuredTrees.toLocaleString(
									locale
								)}
							</strong>{' '}
							{t('stats.files')}
						</span>
						<span>
							<strong>{CHRONICLE_MANIFEST.governance.rules}</strong>{' '}
							{t('stats.agentRules')}
						</span>
					</div>
				</details>

				<section
					className="empery-nexus-chronicle__chapters"
					data-testid="empery-nexus-chapters"
					aria-label={t('chapters.railTitle')}
				>
					<p className="empery-nexus-chronicle__inspector-title">
						{t('chapters.railTitle')}
					</p>
					<div className="empery-nexus-chronicle__chapter-tabs">
						{CHRONICLE_CHAPTERS.map((chapter) => (
							<button
								key={chapter.id}
								type="button"
								className={`empery-nexus-chronicle__btn${
									chapterId === chapter.id
										? ' empery-nexus-chronicle__btn--active'
										: ''
								}`}
								onClick={() => setChapterId(chapter.id)}
							>
								{t(`chapters.${chapter.id}.title`)}
							</button>
						))}
					</div>
					<p className="empery-nexus-chronicle__chapter-body">
						{t(`chapters.${chapterId}.body`)}
					</p>
					<div className="empery-nexus-chronicle__controls">
						<button
							type="button"
							className="empery-nexus-chronicle__btn"
							aria-label={t('actions.prevChapter')}
							onClick={() => cycleChapter(-1)}
						>
							←
						</button>
						<button
							type="button"
							className="empery-nexus-chronicle__btn"
							aria-label={t('actions.nextChapter')}
							onClick={() => cycleChapter(1)}
						>
							→
						</button>
					</div>
				</section>
			</header>

			<div className="empery-nexus-chronicle__hud-bottom">
				<aside
					className="empery-nexus-chronicle__inspector"
					data-testid="empery-nexus-domain-inspector"
					aria-live="polite"
				>
					<p className="empery-nexus-chronicle__inspector-title">
						{t('inspector.title')}
					</p>
					{selected ? (
						<>
							<p className="empery-nexus-chronicle__layer-title">
								{t(`domains.${selected.id}.label`)}
							</p>
							<p className="empery-nexus-chronicle__subtitle">
								{t(`domains.${selected.id}.role`)}
							</p>
							<p className="empery-nexus-chronicle__chapter-body">
								{t(`domains.${selected.id}.lore`)}
							</p>
							<p className="empery-nexus-chronicle__inspector-meta">
								{t('inspector.linesOfCode', {
									count: selected.linesOfCode.toLocaleString(locale),
								})}
							</p>
							<p className="empery-nexus-chronicle__inspector-meta">
								{t('inspector.layerBadge', {
									layer: t(`layers.${selected.layer}.short`),
								})}
							</p>
							<button
								type="button"
								className="empery-nexus-chronicle__btn"
								onClick={() => focusDomain(null)}
							>
								{t('actions.clearDomain')}
							</button>
						</>
					) : (
						<p className="empery-nexus-chronicle__hint">
							{t('inspector.empty')}
						</p>
					)}
				</aside>

				{audioNeedsGesture ? (
					<button
						type="button"
						className="empery-nexus-chronicle__btn empery-nexus-chronicle__btn--primary empery-nexus-chronicle__audio-unlock"
						data-testid="empery-nexus-audio-unlock"
						onClick={onAwakenAudio}
					>
						{t('actions.awakenAudio')}
					</button>
				) : null}

				<div>
					<p className="empery-nexus-chronicle__layer-title">
						{t(`layers.${layer}.title`)}
					</p>
					<p
						className="empery-nexus-chronicle__subtitle"
						style={{ marginTop: 6 }}
					>
						{t(`layers.${layer}.subtitle`)}
					</p>
					<div
						className="empery-nexus-chronicle__controls"
						style={{ marginTop: '1rem' }}
					>
						{LAYER_IDS.map((id) => (
							<button
								key={id}
								type="button"
								className={`empery-nexus-chronicle__btn${
									layer === id ? ' empery-nexus-chronicle__btn--active' : ''
								}`}
								onClick={() => setLayer(id)}
							>
								{t(`layers.${id}.short`)}
							</button>
						))}
						<button
							type="button"
							className="empery-nexus-chronicle__btn"
							onClick={() => emitPulse()}
						>
							{t('actions.pulse')}
						</button>
						<button
							type="button"
							className="empery-nexus-chronicle__btn"
							onClick={() => replayRebirth()}
						>
							{t('actions.rebirth')}
						</button>
						<button
							type="button"
							className="empery-nexus-chronicle__btn"
							onClick={onToggleMute}
						>
							{muted ? t('actions.toggleUnmute') : t('actions.toggleMute')}
						</button>
						<button
							type="button"
							className="empery-nexus-chronicle__btn"
							onClick={onToggleCinema}
						>
							{t('actions.toggleCinema')}
						</button>
						<button
							type="button"
							className="empery-nexus-chronicle__btn"
							onClick={onToggleHelp}
						>
							{t('actions.toggleHelp')}
						</button>
						<button
							type="button"
							className="empery-nexus-chronicle__btn empery-nexus-chronicle__btn--primary"
							onClick={() => onNavigate('desktop')}
						>
							{t('actions.return')}
						</button>
					</div>
					<p className="empery-nexus-chronicle__hint">{t('hints.controls')}</p>
					<p className="empery-nexus-chronicle__hint">{t('hints.domain')}</p>
					{audioNeedsGesture ? (
						<p className="empery-nexus-chronicle__hint">
							{t('hints.audioUnlock')}
						</p>
					) : null}
				</div>
			</div>
		</div>
	);
}
