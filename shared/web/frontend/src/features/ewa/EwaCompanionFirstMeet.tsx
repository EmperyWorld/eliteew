/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * One-time first-meet preference quiz and birth-video bootstrap for the desktop friend (`seed_persona_id`).
 * Calm scene questions resolve a hidden companion seed; the final screen uses one obvious primary CTA before the birth visual.
 *
 * Invariants:
 * - Calls **`POST /api/v1/ewa/companion-profile/initialize`** at most once after legend completion and birth-video end/continue.
 * - The birth video is not mounted or preloaded before the legend has produced a complete `seed_persona_id`.
 * - The default `seed_persona_id` is hidden from visible UI; per-user trait jitter happens on the backend.
 * - All UI strings come from the `marketing` i18n namespace; no hard-coded labels.
 * - Final confirm is a single primary CTA (`data-ewa-first-meet-confirm`); secondary only edits answers.
 *
 * Related:
 * - src/features/ewa/EwaDesktopApp.tsx (gate `pick`)
 * - src/features/ewa/EwaCompanionFirstMeetRitualProgress.tsx
 * - src/features/ewa/ewaPersonaCatalog.ts (wire ids)
 * - api/ewa_platform/companion/persona/character.py (`initial_character_for_principal`)
 */
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';
import {
	EWA_INITIALIZABLE_PERSONA_IDS,
	type EwaInitializablePersonaId,
} from '@/features/ewa/ewaPersonaCatalog';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { initializeEwaCompanionProfile } from '@/services/ewa/ewaCompanionProfileApi';
import { cn } from '@/utils/cn';
import { type SyntheticEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MOBILE_EMBEDDED_EWA_FIRST_MEET_CHOICE_GRID_CLASS } from '@/components/mobileEmbedded/mobileEmbeddedLayoutTokens';
import { EwaCompanionFirstMeetRitualProgress } from '@/features/ewa/EwaCompanionFirstMeetRitualProgress';

const FIRST_MEET_SCENE_IDS = [
	'threshold',
	'light',
	'storm',
	'work',
	'vow',
] as const;

export type FirstMeetLegendSceneId = (typeof FIRST_MEET_SCENE_IDS)[number];
export type FirstMeetLegendChoiceId =
	| 'hearth'
	| 'blade'
	| 'water'
	| 'spark'
	| 'thread'
	| 'lantern'
	| 'shelter'
	| 'map'
	| 'needle'
	| 'file'
	| 'image'
	| 'song'
	| 'remember'
	| 'move'
	| 'watch';
export type FirstMeetLegendAnswers = Partial<
	Record<FirstMeetLegendSceneId, FirstMeetLegendChoiceId>
>;

type PersonaWeights = Partial<Record<EwaInitializablePersonaId, number>>;

type LegendChoice = {
	id: FirstMeetLegendChoiceId;
	weights: PersonaWeights;
};

type LegendScene = {
	id: FirstMeetLegendSceneId;
	choices: readonly LegendChoice[];
};

const LEGEND_SCENES: readonly LegendScene[] = [
	{
		id: 'threshold',
		choices: [
			{ id: 'hearth', weights: { mela: 3, zera: 2, tala: 1 } },
			{ id: 'blade', weights: { feni: 3, kora: 2, parent: 1 } },
			{ id: 'water', weights: { tala: 3, zera: 2, parent: 1 } },
		],
	},
	{
		id: 'light',
		choices: [
			{ id: 'spark', weights: { mela: 3, feni: 1, kora: 1 } },
			{ id: 'thread', weights: { kora: 3, parent: 2, zera: 1 } },
			{ id: 'lantern', weights: { zera: 3, tala: 2, mela: 1 } },
		],
	},
	{
		id: 'storm',
		choices: [
			{ id: 'shelter', weights: { zera: 3, mela: 1, tala: 1 } },
			{ id: 'map', weights: { kora: 3, parent: 2, feni: 1 } },
			{ id: 'needle', weights: { feni: 3, tala: 1, kora: 1 } },
		],
	},
	{
		id: 'work',
		choices: [
			{ id: 'file', weights: { kora: 2, parent: 2, feni: 1 } },
			{ id: 'image', weights: { mela: 2, zera: 2, tala: 1 } },
			{ id: 'song', weights: { mela: 3, tala: 2, zera: 1 } },
		],
	},
	{
		id: 'vow',
		choices: [
			{ id: 'remember', weights: { zera: 3, mela: 2, parent: 1 } },
			{ id: 'move', weights: { feni: 3, kora: 2, parent: 1 } },
			{ id: 'watch', weights: { parent: 3, tala: 2, kora: 1 } },
		],
	},
];

function choiceFor(
	scene: LegendScene,
	choiceId: FirstMeetLegendChoiceId | undefined
): LegendChoice | null {
	if (!choiceId) return null;
	return scene.choices.find((choice) => choice.id === choiceId) ?? null;
}

export function resolvePersonaFromLegendAnswers(
	answers: FirstMeetLegendAnswers
): EwaInitializablePersonaId | null {
	const scores = new Map<EwaInitializablePersonaId, number>(
		EWA_INITIALIZABLE_PERSONA_IDS.map((id) => [id, 0])
	);
	for (const scene of LEGEND_SCENES) {
		const choice = choiceFor(scene, answers[scene.id]);
		if (!choice) return null;
		for (const [personaId, points] of Object.entries(choice.weights)) {
			const id = personaId as EwaInitializablePersonaId;
			scores.set(id, (scores.get(id) ?? 0) + Number(points || 0));
		}
	}
	let best: EwaInitializablePersonaId = EWA_INITIALIZABLE_PERSONA_IDS[0];
	let bestScore = scores.get(best) ?? 0;
	for (const id of EWA_INITIALIZABLE_PERSONA_IDS) {
		const score = scores.get(id) ?? 0;
		if (score > bestScore) {
			best = id;
			bestScore = score;
		}
	}
	return best;
}

export function firstMeetBirthVideoUrl(
	personaId: EwaInitializablePersonaId
): string {
	const raw = import.meta.env.BASE_URL || '/';
	const base = raw.endsWith('/') ? raw.slice(0, -1) : raw;
	return `${base}/ewa/first-meet/${personaId}.mp4`;
}

function firstMeetBirthCaptionsUrl(): string {
	const raw = import.meta.env.BASE_URL || '/';
	const base = raw.endsWith('/') ? raw.slice(0, -1) : raw;
	return `${base}/ewa/first-meet/birth-captions.vtt`;
}

const FIRST_MEET_PANEL_CLASS = cn(
	'relative min-h-0 flex-1 overflow-hidden rounded-3xl border border-(--desktop-border-subtle)',
	'bg-black shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.06),0_18px_42px_rgba(0,0,0,0.22)]'
);

export function EwaCompanionFirstMeet({
	onCommitted,
	embeddedMobile = false,
}: {
	onCommitted: () => Promise<void>;
	/** MobileAndroid embedded WebView — single-column tiles, no `md:` grid. */
	embeddedMobile?: boolean;
}) {
	const { t, i18n } = useTranslation('marketing');
	const captionLang = (i18n.language || 'ru').split('-')[0] || 'ru';

	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState<string | null>(null);
	const [answers, setAnswers] = useState<FirstMeetLegendAnswers>({});
	const [sceneIndex, setSceneIndex] = useState(0);
	const [birthStarted, setBirthStarted] = useState(false);
	const [birthVideoFailed, setBirthVideoFailed] = useState(false);
	const [birthVideoNeedsControls, setBirthVideoNeedsControls] = useState(false);
	const committedRef = useRef(false);

	const currentScene = LEGEND_SCENES[sceneIndex] ?? null;
	const legendComplete = sceneIndex >= LEGEND_SCENES.length;
	const selectedPersonaId = resolvePersonaFromLegendAnswers(answers);

	const selectChoice = (choiceId: FirstMeetLegendChoiceId) => {
		if (!currentScene || birthStarted || busy) return;
		setAnswers((prev) => ({ ...prev, [currentScene.id]: choiceId }));
		setSceneIndex((prev) => Math.min(prev + 1, LEGEND_SCENES.length));
	};

	const stepBack = () => {
		if (birthStarted || sceneIndex <= 0) return;
		const previousScene = LEGEND_SCENES[sceneIndex - 1];
		setAnswers((prev) => {
			const next = { ...prev };
			if (previousScene) delete next[previousScene.id];
			return next;
		});
		setSceneIndex((prev) => Math.max(0, prev - 1));
	};

	const changeSign = () => {
		if (birthStarted) return;
		const previousScene = LEGEND_SCENES[LEGEND_SCENES.length - 1];
		setAnswers((prev) => {
			const next = { ...prev };
			delete next[previousScene.id];
			return next;
		});
		setSceneIndex(Math.max(0, LEGEND_SCENES.length - 1));
	};

	const startBirthVideo = () => {
		if (!selectedPersonaId || busy) return;
		setBirthVideoFailed(false);
		setBirthVideoNeedsControls(false);
		setErr(null);
		setBirthStarted(true);
	};

	const commitProfile = async () => {
		if (!selectedPersonaId || busy) return;
		setBusy(true);
		setErr(null);
		try {
			await initializeEwaCompanionProfile({
				seed_persona_id: selectedPersonaId,
			});
			await onCommitted();
		} catch (e: unknown) {
			committedRef.current = false;
			const msg =
				e && typeof e === 'object' && 'message' in e
					? String((e as { message: unknown }).message)
					: String(e);
			setErr(msg);
		} finally {
			setBusy(false);
		}
	};

	const commitAfterBirthVideo = () => {
		if (committedRef.current) return;
		committedRef.current = true;
		void commitProfile();
	};

	const handleBirthVideoCanPlay = async (
		event: SyntheticEvent<HTMLVideoElement>
	) => {
		try {
			await event.currentTarget.play();
			setBirthVideoNeedsControls(false);
		} catch (err) {
			ewaCompanionDegradeDebug(
				'companion_first_meet_birth_video',
				'autoplay blocked; showing controls',
				err
			);
			setBirthVideoNeedsControls(true);
		}
	};

	return (
		<div
			className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col gap-3 overflow-hidden px-0.5 py-0.5"
			data-ewa-first-meet="1"
		>
			<div className={FIRST_MEET_PANEL_CLASS}>
				{birthStarted && selectedPersonaId ? (
					<>
						<video
							className="h-full w-full object-cover"
							src={firstMeetBirthVideoUrl(selectedPersonaId)}
							autoPlay
							playsInline
							preload="auto"
							controls={birthVideoNeedsControls}
							onCanPlay={handleBirthVideoCanPlay}
							onEnded={commitAfterBirthVideo}
							onError={() => {
								setBirthVideoFailed(true);
								setBirthVideoNeedsControls(true);
							}}
						>
							<track
								kind="captions"
								src={firstMeetBirthCaptionsUrl()}
								srcLang={captionLang}
								label={t('ewaCompanion.firstMeetLegend.videoCaptionsLabel')}
							/>
						</video>
						{birthVideoFailed ? (
							<div className="absolute inset-0 flex items-center justify-center bg-black/75 p-6 text-center">
								<div className="max-w-sm rounded-2xl border border-white/10 bg-white/6 p-4 text-white">
									<p className="text-sm">
										{t('ewaCompanion.firstMeetLegend.videoFailed')}
									</p>
									<DesktopAppButton
										type="button"
										variant="accent"
										size="sm"
										className="mt-3"
										disabled={busy}
										onClick={commitAfterBirthVideo}
									>
										{busy
											? t('ewaCompanion.firstMeetLegend.saving')
											: t('ewaCompanion.firstMeetLegend.videoContinue')}
									</DesktopAppButton>
								</div>
							</div>
						) : null}
					</>
				) : (
					<div className="flex h-full min-h-0 flex-col justify-between gap-5 overflow-auto bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.16),transparent_28%),radial-gradient(circle_at_82%_78%,rgba(168,85,247,0.22),transparent_34%)] p-5 text-white">
						<div className="space-y-2">
							<p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55">
								{legendComplete
									? t('ewaCompanion.firstMeetLegend.finalKicker')
									: t('ewaCompanion.firstMeetLegend.progress', {
											current: sceneIndex + 1,
											total: LEGEND_SCENES.length,
										})}
							</p>
							{sceneIndex === 0 && !legendComplete ? (
								<>
									<p
										className="max-w-2xl text-sm leading-6 text-white/70"
										data-ewa-first-meet-intro="1"
									>
										{t('ewaCompanion.firstMeetLegend.intro')}
									</p>
									<p className="max-w-2xl text-xs leading-5 text-white/45 italic">
										{t('ewaCompanion.firstMeetLegend.trustAnchor')}
									</p>
								</>
							) : null}
						</div>

						{currentScene ? (
							<div
								key={currentScene.id}
								className="space-y-5"
								aria-live="polite"
								aria-atomic="true"
								data-ewa-first-meet-scene={currentScene.id}
							>
								<div className="space-y-2">
									<h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">
										{t(
											`ewaCompanion.firstMeetLegend.scenes.${currentScene.id}.title`
										)}
									</h2>
									<p className="max-w-2xl text-sm leading-6 text-white/72">
										{t(
											`ewaCompanion.firstMeetLegend.scenes.${currentScene.id}.body`
										)}
									</p>
								</div>
								<div
									className={cn(
										embeddedMobile
											? MOBILE_EMBEDDED_EWA_FIRST_MEET_CHOICE_GRID_CLASS
											: 'grid gap-3 md:grid-cols-3'
									)}
								>
									{currentScene.choices.map((choice) => {
										const baseKey = `ewaCompanion.firstMeetLegend.scenes.${currentScene.id}.choices.${choice.id}`;
										return (
											<button
												key={choice.id}
												type="button"
												disabled={busy}
												className={cn(
													'group rounded-2xl border border-white/12 bg-white/8 p-4 text-left',
													'motion-safe:transition motion-reduce:transition-none',
													'hover:border-white/28 hover:bg-white/13 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70',
													'disabled:pointer-events-none disabled:opacity-50',
													embeddedMobile && 'min-h-11'
												)}
												onClick={() => selectChoice(choice.id)}
											>
												<span className="mb-3 inline-flex rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">
													{t(`${baseKey}.token`)}
												</span>
												<span className="block text-sm font-semibold text-white">
													{t(`${baseKey}.label`)}
												</span>
												<span className="mt-2 block text-xs leading-5 text-white/65">
													{t(`${baseKey}.detail`)}
												</span>
											</button>
										);
									})}
								</div>
							</div>
						) : (
							<div
								className="flex min-h-0 flex-1 flex-col justify-between gap-6"
								aria-live="polite"
								aria-atomic="true"
								data-ewa-first-meet-scene="final"
							>
								<div className="space-y-4">
									<div className="space-y-2">
										<h2 className="text-2xl font-semibold tracking-[-0.03em] text-white md:text-3xl">
											{t('ewaCompanion.firstMeetLegend.finalTitle')}
										</h2>
										<p className="max-w-2xl text-sm leading-6 text-white/72 md:text-base">
											{t('ewaCompanion.firstMeetLegend.finalBody')}
										</p>
										<p className="max-w-2xl text-xs leading-5 text-white/50">
											{t('ewaCompanion.firstMeetForever')}
										</p>
									</div>
									<div className="space-y-2">
										<p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
											{t('ewaCompanion.firstMeetLegend.finalSummaryLabel')}
										</p>
										<div className="flex flex-wrap gap-2">
											{FIRST_MEET_SCENE_IDS.map((sceneId) => {
												const answerId = answers[sceneId];
												if (!answerId) return null;
												return (
													<span
														key={sceneId}
														className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-xs text-white/80"
													>
														{t(
															`ewaCompanion.firstMeetLegend.scenes.${sceneId}.choices.${answerId}.label`
														)}
													</span>
												);
											})}
										</div>
									</div>
								</div>
								<div className="space-y-3 border-t border-white/10 pt-4">
									<p className="text-sm font-medium text-white/85">
										{t('ewaCompanion.firstMeetLegend.finalCtaHint')}
									</p>
									<DesktopAppButton
										type="button"
										variant="accent"
										disabled={!selectedPersonaId || busy}
										className="min-h-12 w-full justify-center px-6 text-base font-semibold"
										data-ewa-first-meet-confirm="1"
										onClick={startBirthVideo}
									>
										{busy
											? t('ewaCompanion.firstMeetLegend.saving')
											: t('ewaCompanion.firstMeetLegend.confirm')}
									</DesktopAppButton>
									<div className="flex justify-center">
										<DesktopAppButton
											type="button"
											variant="ghost"
											size="sm"
											disabled={busy}
											onClick={changeSign}
										>
											{t('ewaCompanion.firstMeetLegend.change')}
										</DesktopAppButton>
									</div>
								</div>
							</div>
						)}

						{!legendComplete ? (
							<div className="space-y-3">
								<EwaCompanionFirstMeetRitualProgress
									current={sceneIndex + 1}
									total={LEGEND_SCENES.length}
									ariaLabel={t(
										'ewaCompanion.firstMeetLegend.progressAriaLabel',
										{
											current: sceneIndex + 1,
											total: LEGEND_SCENES.length,
										}
									)}
								/>
								<div className="flex min-h-8 items-center justify-between gap-3">
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										className={sceneIndex > 0 ? undefined : 'invisible'}
										disabled={sceneIndex <= 0 || busy}
										onClick={stepBack}
									>
										{t('ewaCompanion.firstMeetLegend.back')}
									</DesktopAppButton>
								</div>
							</div>
						) : null}
					</div>
				)}
			</div>
			{err ? (
				<p className="text-xs text-red-600 dark:text-red-400 wrap-break-word">
					{err}
				</p>
			) : null}
		</div>
	);
}
