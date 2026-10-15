/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * DEV-only role preset selector for POEMMA ACL smoke in local builds.
 *
 * Invariants:
 * - Render only when import.meta.env.DEV; caller also gates by owner/platform-admin ACL.
 *
 * Related:
 * - src/features/poemma/PoemmaApp.tsx
 * - src/features/poemma/poemmaRoleChangeAcl.ts
 */

import type { PoemmaUserRole } from '../poemmaDomain';
import { PoemmaEyebrowLabel } from './PoemmaEyebrowLabel';

export type PoemmaDevRolePreset = {
	role: PoemmaUserRole;
	displayName: string;
	roleLabel: string;
};

export type PoemmaDevRoleSelectProps = {
	presets: PoemmaDevRolePreset[];
	value: PoemmaUserRole;
	onChange: (role: PoemmaUserRole) => void;
	className?: string;
};

export function PoemmaDevRoleSelect({
	presets,
	value,
	onChange,
	className,
}: PoemmaDevRoleSelectProps) {
	return (
		<label className={className ?? 'grid min-w-32 gap-0.5'}>
			<PoemmaEyebrowLabel tone="muted">Роль</PoemmaEyebrowLabel>
			<select
				aria-label="Выбрать роль Poemma"
				className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1 text-xs font-semibold text-(--desktop-text-primary)"
				value={value}
				onChange={(event) => onChange(event.target.value as PoemmaUserRole)}
			>
				{presets.map((item) => (
					<option key={item.role} value={item.role}>
						{item.displayName} · {item.roleLabel}
					</option>
				))}
			</select>
		</label>
	);
}
