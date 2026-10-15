/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Macro builder form for Voice Command Center (2–5 chained commands).
 *
 * Related:
 * - `VoiceCommandCenter.tsx`, `macros/voiceMacros.ts`
 */

import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import {
	getDesktopShellCheckboxControlClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '@/pages/Desktop/utils/desktopVisualSystem';
import { COMMAND_CATALOG } from '../engine';
import { MIN_STEPS, MAX_STEPS } from '../macros/voiceMacros';

export interface AddMacroFormProps {
	onSave: (name: string, commandIds: string[]) => void;
	onCancel: () => void;
}

export const AddMacroForm: React.FC<AddMacroFormProps> = ({
	onSave,
	onCancel,
}) => {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'voiceCommand' });
	const shellFrame = useDesktopShellFrame();
	const [name, setName] = useState('');
	const [selected, setSelected] = useState<Set<string>>(new Set());

	const macroNameFieldClass = cn(
		getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
		'w-full rounded-(--desktop-radius) px-3 py-2 text-sm text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim)',
		DESKTOP_CHROME_FOCUS_VISIBLE
	);
	const macroCheckboxClass = cn(
		getDesktopShellCheckboxControlClassName(shellFrame),
		'size-4 shrink-0 accent-[rgb(var(--desktop-accent-rgb))]',
		DESKTOP_INTERACTIVE.focusRing
	);

	const toggle = (id: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const canSave =
		name.trim().length > 0 &&
		selected.size >= MIN_STEPS &&
		selected.size <= MAX_STEPS;

	return (
		<div className="mt-3 space-y-3 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4 shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.05)]">
			<input
				type="text"
				value={name}
				onChange={(e) => setName(e.target.value)}
				placeholder={t('addMacro.namePlaceholder')}
				className={macroNameFieldClass}
			/>
			<p className={cn(DESKTOP_TYPOGRAPHY.meta)}>
				{t('addMacro.pickCommands')}
			</p>
			<div className="max-h-36 space-y-1.5 overflow-y-auto">
				{COMMAND_CATALOG.map((cmd) => (
					<label
						key={cmd.id}
						className="flex cursor-pointer items-center gap-2 text-sm text-(--desktop-text-secondary) transition-colors hover:text-(--desktop-text-primary)"
					>
						<input
							type="checkbox"
							checked={selected.has(cmd.id)}
							onChange={() => toggle(cmd.id)}
							className={macroCheckboxClass}
						/>
						<span>{cmd.icon}</span>
						<span>{cmd.command}</span>
					</label>
				))}
			</div>
			<div className="flex gap-2 pt-1">
				<DesktopAppButton
					type="button"
					variant="accent"
					size="sm"
					disabled={!canSave}
					onClick={() => onSave(name.trim(), Array.from(selected))}
				>
					{t('addMacro.save')}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					onClick={onCancel}
				>
					{t('addMacro.cancel')}
				</DesktopAppButton>
			</div>
		</div>
	);
};
