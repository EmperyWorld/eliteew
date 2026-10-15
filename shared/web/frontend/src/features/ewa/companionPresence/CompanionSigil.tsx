/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Inline SVG **sigil-avatar** — one breathing geometric figure per `seed_persona_id` plus a subtle aura halo
 * and a thinking ring while the LLM answers; **`streamPhase`** slows or accelerates breath / ring for waiting vs streaming.
 *
 * Invariants:
 * - Pure visual: never reads from a global store; consumes `personaId`, `presence` and `bond` (0..1) props.
 * - All colors come from the `--companion-*` CSS variables — palette logic lives in `companionMoodPalette.ts`.
 *
 * Related:
 * - src/features/ewa/companionPresence/companionMoodPalette.ts
 * - src/features/ewa/companionPresence/companionPresence.css
 */
import './companionPresence.css';

import { cn } from '@/utils/cn';
import type { EwaPersonaId } from '@/features/ewa/ewaPersonaCatalog';

export type CompanionPresenceState = 'online' | 'thinking' | 'quiet';

/** Finer stream cadence for aura + ring (desktop friend chat). */
export type CompanionStreamPhase = 'idle' | 'waiting' | 'streaming';

export type CompanionSigilSize = 'default' | 'compact';

export type CompanionSigilProps = {
	personaId: EwaPersonaId;
	presence: CompanionPresenceState;
	/** 0..1, drives the bond arc length above the sigil; defaults to a short visible stub. */
	bond?: number;
	/** Waiting for first token vs streaming body — animates thinking ring and breath differently. */
	streamPhase?: CompanionStreamPhase;
	/** Visual footprint: `compact` (72px) for left-rail presence; `default` (144px) legacy centered header. */
	size?: CompanionSigilSize;
	className?: string;
};

const VIEWBOX_SIZE = 144;
const CENTER = VIEWBOX_SIZE / 2;
const ARC_RADIUS = 60;

const RENDER_SIZE: Record<CompanionSigilSize, number> = {
	default: 144,
	compact: 72,
};

function clamp01(value: number | undefined): number {
	if (typeof value !== 'number' || Number.isNaN(value)) return 0.08;
	if (value < 0) return 0;
	if (value > 1) return 1;
	return value;
}

function arcDashOffset(bond: number, length: number): number {
	const visible = Math.max(0.04, bond);
	return Math.round(length * (1 - visible));
}

function PersonaGlyph({ personaId }: { personaId: EwaPersonaId }) {
	switch (personaId) {
		case 'parent':
			return (
				<g
					stroke="var(--companion-aura)"
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
				>
					<circle cx={CENTER} cy={CENTER} r={26} strokeWidth={1.6} />
					<circle
						cx={CENTER}
						cy={CENTER}
						r={17}
						strokeWidth={1.2}
						opacity={0.7}
					/>
					<circle
						cx={CENTER}
						cy={CENTER}
						r={5}
						fill="var(--companion-aura)"
						stroke="none"
					/>
				</g>
			);
		case 'mela':
			return (
				<g
					stroke="var(--companion-aura)"
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
				>
					<path
						d={`M ${CENTER} ${CENTER - 32}
                            C ${CENTER + 16} ${CENTER - 18}, ${CENTER + 16} ${CENTER + 18}, ${CENTER} ${CENTER + 32}
                            C ${CENTER - 16} ${CENTER + 18}, ${CENTER - 16} ${CENTER - 18}, ${CENTER} ${CENTER - 32} Z`}
						strokeWidth={1.6}
					/>
					<path
						d={`M ${CENTER - 18} ${CENTER} L ${CENTER + 18} ${CENTER}`}
						strokeWidth={1.1}
						opacity={0.6}
					/>
					<circle
						cx={CENTER}
						cy={CENTER}
						r={3.5}
						fill="var(--companion-aura)"
						stroke="none"
					/>
				</g>
			);
		case 'zera':
			return (
				<g
					stroke="var(--companion-aura)"
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
				>
					<path
						d={`M ${CENTER - 26} ${CENTER + 4}
                            C ${CENTER - 26} ${CENTER - 18}, ${CENTER - 4} ${CENTER - 22}, ${CENTER} ${CENTER - 6}
                            C ${CENTER + 4} ${CENTER - 22}, ${CENTER + 26} ${CENTER - 18}, ${CENTER + 26} ${CENTER + 4}
                            C ${CENTER + 26} ${CENTER + 18}, ${CENTER} ${CENTER + 30}, ${CENTER} ${CENTER + 30}
                            C ${CENTER} ${CENTER + 30}, ${CENTER - 26} ${CENTER + 18}, ${CENTER - 26} ${CENTER + 4} Z`}
						strokeWidth={1.4}
					/>
					<circle
						cx={CENTER}
						cy={CENTER + 4}
						r={3}
						fill="var(--companion-aura)"
						stroke="none"
					/>
				</g>
			);
		case 'kora':
			return (
				<g
					stroke="var(--companion-aura)"
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
				>
					<polygon
						points={`${CENTER},${CENTER - 28}
                                ${CENTER + 24},${CENTER - 14}
                                ${CENTER + 24},${CENTER + 14}
                                ${CENTER},${CENTER + 28}
                                ${CENTER - 24},${CENTER + 14}
                                ${CENTER - 24},${CENTER - 14}`}
						strokeWidth={1.6}
					/>
					<line
						x1={CENTER - 24}
						y1={CENTER - 14}
						x2={CENTER + 24}
						y2={CENTER + 14}
						strokeWidth={1}
						opacity={0.55}
					/>
					<line
						x1={CENTER + 24}
						y1={CENTER - 14}
						x2={CENTER - 24}
						y2={CENTER + 14}
						strokeWidth={1}
						opacity={0.55}
					/>
				</g>
			);
		case 'tala':
			return (
				<g
					stroke="var(--companion-aura)"
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
				>
					<path
						d={`M ${CENTER - 30} ${CENTER}
                            C ${CENTER - 22} ${CENTER - 16}, ${CENTER - 8} ${CENTER - 16}, ${CENTER} ${CENTER}
                            C ${CENTER + 8} ${CENTER + 16}, ${CENTER + 22} ${CENTER + 16}, ${CENTER + 30} ${CENTER}`}
						strokeWidth={1.7}
					/>
					<path
						d={`M ${CENTER - 30} ${CENTER + 12}
                            C ${CENTER - 22} ${CENTER - 4}, ${CENTER - 8} ${CENTER - 4}, ${CENTER} ${CENTER + 12}
                            C ${CENTER + 8} ${CENTER + 28}, ${CENTER + 22} ${CENTER + 28}, ${CENTER + 30} ${CENTER + 12}`}
						strokeWidth={1.1}
						opacity={0.5}
					/>
				</g>
			);
		case 'feni':
			return (
				<g
					stroke="var(--companion-aura)"
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
				>
					<polygon
						points={`${CENTER},${CENTER - 30} ${CENTER + 26},${CENTER + 22} ${CENTER - 26},${CENTER + 22}`}
						strokeWidth={1.7}
					/>
					<line
						x1={CENTER}
						y1={CENTER - 16}
						x2={CENTER}
						y2={CENTER + 18}
						strokeWidth={1}
						opacity={0.6}
					/>
				</g>
			);
		case 'arlika':
		case 'arlika_v2':
			return (
				<g
					stroke="var(--companion-aura)"
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
				>
					<path
						d={`M ${CENTER} ${CENTER - 34} L ${CENTER + 28} ${CENTER} L ${CENTER} ${CENTER + 34} L ${CENTER - 28} ${CENTER} Z`}
						strokeWidth={1.65}
					/>
					<path
						d={`M ${CENTER - 20} ${CENTER - 20} L ${CENTER + 20} ${CENTER + 20} M ${CENTER + 20} ${CENTER - 20} L ${CENTER - 20} ${CENTER + 20}`}
						strokeWidth={1.1}
						opacity={0.55}
					/>
				</g>
			);
		default:
			return null;
	}
}

export function CompanionSigil({
	personaId,
	presence,
	bond,
	streamPhase = 'idle',
	size = 'default',
	className,
}: CompanionSigilProps) {
	const bondVal = clamp01(bond);
	const renderSize = RENDER_SIZE[size];
	// Half circumference works for an open arc (≈180°) above the sigil.
	const arcLength = Math.PI * ARC_RADIUS;
	const dashOffset = arcDashOffset(bondVal, arcLength);

	return (
		<svg
			viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
			width={renderSize}
			height={renderSize}
			role="img"
			aria-hidden="true"
			className={cn(
				'companion-presence-sigil-wrapper select-none',
				presence === 'quiet' && 'companion-sigil-quiet',
				streamPhase === 'waiting' && 'companion-sigil-waiting',
				streamPhase === 'streaming' && 'companion-sigil-streaming',
				className
			)}
		>
			<defs>
				<radialGradient id="companion-aura-grad" cx="50%" cy="50%" r="50%">
					<stop
						offset="0%"
						stopColor="var(--companion-aura)"
						stopOpacity={0.55}
					/>
					<stop
						offset="60%"
						stopColor="var(--companion-aura)"
						stopOpacity={0.18}
					/>
					<stop
						offset="100%"
						stopColor="var(--companion-aura)"
						stopOpacity={0}
					/>
				</radialGradient>
			</defs>
			<circle
				cx={CENTER}
				cy={CENTER}
				r={66}
				fill="url(#companion-aura-grad)"
				className="companion-sigil-aura"
			/>
			<g className="companion-sigil">
				<PersonaGlyph personaId={personaId} />
			</g>
			{presence === 'thinking' ? (
				<circle
					cx={CENTER}
					cy={CENTER}
					r={50}
					fill="none"
					strokeWidth={1.2}
					className="companion-sigil-thinking-ring"
				/>
			) : null}
			{/* Bond arc — visible fill tracks **`companion_revision`** growth (shared chat depth), not mood; see tooltip copy in `EwaCompanionChatPanel`. */}
			<path
				d={`M ${CENTER - ARC_RADIUS} ${CENTER} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 ${CENTER + ARC_RADIUS} ${CENTER}`}
				fill="none"
				stroke="var(--companion-aura-soft)"
				strokeWidth={1.4}
				strokeLinecap="round"
				strokeDasharray={arcLength}
				strokeDashoffset={dashOffset}
				className="companion-bond-arc"
			/>
		</svg>
	);
}
