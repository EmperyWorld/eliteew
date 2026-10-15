/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Text-free opening ritual when the EWA desktop window is opened fresh (not session restore): only companion visuals,
 * no generic EliteEW progress bar or quote inside the EWA window.
 *
 * Invariants:
 * - Lazy-loaded from `EwaDesktopApp`; skipped when `openedFromSessionRestore`.
 * - Holds on parent finale until `contentReady` then fades out; no user interaction.
 * - Must render only companion sigil/visual canvas, never the shared ElitePreloaderPanel progress/quote.
 *
 * Related:
 * - src/features/ewa/ewaOpeningPreloaderSequence.ts
 * - src/features/ewa/companionPresence/CompanionSigil.tsx
 */
import './ewaOpeningPreloader.css';

import { CompanionSigil } from '@/features/ewa/companionPresence/CompanionSigil';
import { buildCompanionPresencePalette } from '@/features/ewa/companionPresence/companionMoodPalette';
import type { EwaPersonaId } from '@/features/ewa/ewaPersonaCatalog';
import {
	buildEwaOpeningPhases,
	type EwaOpeningPhase,
	phaseDurationMs,
} from '@/features/ewa/ewaOpeningPreloaderSequence';
import { cn } from '@/utils/cn';
import { getRemainingPreloaderMinMs } from '@/utils/appPreloader';
import { useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export type EwaOpeningPreloaderProps = {
	/** Companion profile gate still loading — hold finale frame until false. */
	contentReady: boolean;
	onDismiss: () => void;
};

type SigilFrameProps = {
	personaId: EwaPersonaId;
	className?: string;
	sizeClass?: string;
};

function SigilFrame({
	personaId,
	className,
	sizeClass = 'ewa-opening-preloader__sigil',
}: SigilFrameProps) {
	const palette = useMemo(
		() => buildCompanionPresencePalette(personaId, null),
		[personaId]
	);
	const openVars = useMemo(
		() =>
			({
				'--ewa-open-aura': palette['--companion-aura'],
				'--ewa-open-glow': palette['--companion-glow'],
				'--ewa-open-bg-glow': palette['--companion-bg'],
				'--ewa-open-bg-deep': palette['--companion-divider'],
				...palette,
			}) as CSSProperties,
		[palette]
	);

	return (
		<div className={className} style={openVars}>
			<CompanionSigil
				personaId={personaId}
				presence="quiet"
				bond={0.1}
				className={sizeClass}
			/>
		</div>
	);
}

function renderPhaseBody(phase: EwaOpeningPhase, visible: boolean): ReactNode {
	if (phase.kind === 'persona') {
		return (
			<SigilFrame
				personaId={phase.personaId}
				className={cn(
					'ewa-opening-preloader__sigil',
					visible
						? 'ewa-opening-preloader__sigil--visible'
						: 'ewa-opening-preloader__sigil--enter'
				)}
			/>
		);
	}

	if (phase.kind === 'arlika_veil') {
		return (
			<div
				className={cn(
					'ewa-opening-preloader__arlika-veil',
					visible ? 'opacity-100' : 'opacity-0',
					'motion-safe:transition-opacity motion-safe:duration-500 motion-reduce:transition-none'
				)}
			>
				<div className="ewa-opening-preloader__arlika-ghost ewa-opening-preloader__arlika-ghost--a">
					<SigilFrame personaId="arlika" sizeClass="h-36 w-36" />
				</div>
				<div className="ewa-opening-preloader__arlika-ghost ewa-opening-preloader__arlika-ghost--b">
					<SigilFrame personaId="arlika_v2" sizeClass="h-36 w-36" />
				</div>
			</div>
		);
	}

	return (
		<div className="ewa-opening-preloader__finale">
			<div className="ewa-opening-preloader__finale-orbit" aria-hidden />
			<div className="ewa-opening-preloader__finale-ring" aria-hidden />
			<div
				className="ewa-opening-preloader__finale-ring ewa-opening-preloader__finale-ring--delay"
				aria-hidden
			/>
			<div className="ewa-opening-preloader__finale-shimmer" aria-hidden />
			<SigilFrame
				personaId="parent"
				className="ewa-opening-preloader__finale-sigil"
				sizeClass="h-full w-full"
			/>
		</div>
	);
}

export function EwaOpeningPreloader({
	contentReady,
	onDismiss,
}: EwaOpeningPreloaderProps) {
	const reduceMotion = useReducedMotion();
	const phases = useMemo(
		() => buildEwaOpeningPhases(Boolean(reduceMotion)),
		[reduceMotion]
	);
	const [phaseIndex, setPhaseIndex] = useState(0);
	const [phaseVisible, setPhaseVisible] = useState(true);
	const [sequenceDone, setSequenceDone] = useState(false);
	const [exiting, setExiting] = useState(false);
	const dismissRef = useRef(onDismiss);
	const dismissScheduledRef = useRef(false);
	dismissRef.current = onDismiss;

	const currentPhase = phases[phaseIndex] ?? phases[phases.length - 1];

	const rootPersonaId: EwaPersonaId = useMemo(() => {
		if (!currentPhase) return 'parent';
		if (currentPhase.kind === 'persona') return currentPhase.personaId;
		if (currentPhase.kind === 'arlika_veil') return 'arlika';
		return 'parent';
	}, [currentPhase]);

	const requestDismiss = useCallback(() => {
		if (exiting || dismissScheduledRef.current) return;
		dismissScheduledRef.current = true;
		const remainingMs = getRemainingPreloaderMinMs();
		window.setTimeout(() => {
			setExiting(true);
			window.setTimeout(() => {
				dismissRef.current();
			}, 480);
		}, remainingMs);
	}, [exiting]);

	useEffect(() => {
		if (sequenceDone) return;
		const phase = phases[phaseIndex];
		if (!phase) {
			setSequenceDone(true);
			return;
		}

		const holdMs = phaseDurationMs(phase, Boolean(reduceMotion));
		const fadeMs = phase.kind === 'parent_finale' ? 0 : 280;

		const fadeTimer = window.setTimeout(
			() => {
				if (phaseIndex < phases.length - 1) {
					setPhaseVisible(false);
				}
			},
			Math.max(0, holdMs - fadeMs)
		);

		const advanceTimer = window.setTimeout(() => {
			if (phaseIndex >= phases.length - 1) {
				setSequenceDone(true);
				return;
			}
			setPhaseIndex((i) => i + 1);
			setPhaseVisible(true);
		}, holdMs);

		return () => {
			window.clearTimeout(fadeTimer);
			window.clearTimeout(advanceTimer);
		};
	}, [phaseIndex, phases, reduceMotion, sequenceDone]);

	useEffect(() => {
		if (!sequenceDone || !contentReady) return;
		requestDismiss();
	}, [contentReady, requestDismiss, sequenceDone]);

	const palette = buildCompanionPresencePalette(rootPersonaId, null);
	const rootStyle = {
		'--ewa-open-aura': palette['--companion-aura'],
		'--ewa-open-glow': palette['--companion-glow'],
		'--ewa-open-bg-glow': palette['--companion-bg'],
		'--ewa-open-bg-deep': palette['--companion-divider'],
	} as CSSProperties;

	return (
		<div
			className={cn(
				'ewa-opening-preloader',
				exiting && 'ewa-opening-preloader--exit'
			)}
			style={rootStyle}
			role="presentation"
			aria-hidden="true"
		>
			<div className="ewa-opening-preloader__canvas">
				{currentPhase ? renderPhaseBody(currentPhase, phaseVisible) : null}
			</div>
		</div>
	);
}
