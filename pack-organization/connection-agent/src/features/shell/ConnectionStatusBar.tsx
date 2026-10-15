/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact connection / license / update chips for the shell dashboard.
 *
 * Invariants:
 * - Tone is derived from honest status props — never paints success without ok.
 *
 * Related:
 * - lib/ui/statusCopy.ts
 */

type ChipTone = 'ok' | 'warn' | 'danger' | 'neutral';

type Chip = {
	label: string;
	value: string;
	tone: ChipTone;
};

type ConnectionStatusBarProps = {
	chips: Chip[];
};

export function ConnectionStatusBar({ chips }: ConnectionStatusBarProps) {
	return (
		<ul className="status-chips" aria-label="Состояние подключения">
			{chips.map((chip) => (
				<li key={chip.label} className={`status-chip tone-${chip.tone}`}>
					<span className="status-chip-label">{chip.label}</span>
					<span className="status-chip-value">{chip.value}</span>
				</li>
			))}
		</ul>
	);
}
