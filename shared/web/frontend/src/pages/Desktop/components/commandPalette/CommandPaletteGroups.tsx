/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * cmdk result groups for Command Palette (P26 extract from CommandPalette.tsx).
 *
 * Invariants:
 * - Info rows stay read-only; actionable rows call runAction on select.
 *
 * Related:
 * - components/CommandPalette.tsx
 * - useCommandPaletteModel.ts
 */

import { Command } from 'cmdk';
import type { TFunction } from 'i18next';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import { cn } from '@/utils/cn';
import type { CommandItem, CommandPaletteGroupKind } from './types';

export type CommandPaletteGroupsProps = {
	t: TFunction<'desktopUi'>;
	systemCommands: CommandItem[];
	quickActions: CommandItem[];
	runAction: (action: () => void) => void;
};

function CommandPaletteActionableItem({
	cmd,
	runAction,
}: {
	cmd: CommandItem;
	runAction: (action: () => void) => void;
}) {
	return (
		<Command.Item
			value={`${cmd.name} ${cmd.description ?? ''}`}
			onSelect={() => runAction(cmd.action)}
		>
			{cmd.icon}
			<div className="flex-1">
				<div>{cmd.name}</div>
				{cmd.description && (
					<div
						className={cn(DESKTOP_TYPOGRAPHY.meta, 'text-(--desktop-text-dim)')}
					>
						{cmd.description}
					</div>
				)}
			</div>
			{cmd.shortcut && (
				<kbd
					className={cn(
						DESKTOP_TYPOGRAPHY.kbd,
						'px-2 py-0.5 rounded border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-muted)'
					)}
				>
					{cmd.shortcut}
				</kbd>
			)}
		</Command.Item>
	);
}

function CommandPaletteGroupSection({
	heading,
	groupKind,
	commands,
	runAction,
}: {
	heading: string;
	groupKind: CommandPaletteGroupKind;
	commands: CommandItem[];
	runAction: (action: () => void) => void;
}) {
	const items = commands.filter((c) => c.groupKind === groupKind);
	if (items.length === 0) return null;

	return (
		<>
			<Command.Group heading={heading}>
				{items.map((cmd) => (
					<CommandPaletteActionableItem
						key={cmd.id}
						cmd={cmd}
						runAction={runAction}
					/>
				))}
			</Command.Group>
			<Command.Separator />
		</>
	);
}

export function CommandPaletteGroups({
	t,
	systemCommands,
	quickActions,
	runAction,
}: CommandPaletteGroupsProps) {
	return (
		<Command.List>
			<Command.Empty>
				<div className="flex flex-col items-center gap-2">
					<MagnifyingGlassIcon className="w-8 h-8 text-(--desktop-text-dim)" />
					<span>{t('commandPalette.emptyTitle')}</span>
					<span className={cn(DESKTOP_TYPOGRAPHY.meta)}>
						{t('commandPalette.emptyHint')}
					</span>
				</div>
			</Command.Empty>

			<CommandPaletteGroupSection
				heading={t('commandPalette.groupActions')}
				groupKind="actions"
				commands={systemCommands}
				runAction={runAction}
			/>
			<CommandPaletteGroupSection
				heading={t('commandPalette.groupSystem')}
				groupKind="system"
				commands={systemCommands}
				runAction={runAction}
			/>
			<CommandPaletteGroupSection
				heading={t('commandPalette.groupVirtualDesktops')}
				groupKind="virtualDesktops"
				commands={systemCommands}
				runAction={runAction}
			/>
			<CommandPaletteGroupSection
				heading={t('commandPalette.groupTools')}
				groupKind="tools"
				commands={systemCommands}
				runAction={runAction}
			/>

			<Command.Group heading={t('commandPalette.groupInfo')}>
				{quickActions.map((cmd) => (
					<Command.Item
						key={cmd.id}
						value={`${cmd.name} ${cmd.searchExtra ?? ''} ${cmd.description ?? ''} ${cmd.infoHint ?? ''}`}
						data-info-row="true"
						aria-disabled
						onSelect={() => {
							/* info-only — keep palette open */
						}}
					>
						{cmd.icon}
						<div className="flex-1">
							<div>{cmd.name}</div>
							{cmd.description && (
								<div
									className={cn(
										DESKTOP_TYPOGRAPHY.meta,
										'text-(--desktop-text-dim)'
									)}
								>
									{cmd.description}
								</div>
							)}
							{cmd.infoHint && (
								<div
									className={cn(
										DESKTOP_TYPOGRAPHY.meta,
										'text-(--desktop-text-muted)'
									)}
								>
									{cmd.infoHint}
								</div>
							)}
						</div>
					</Command.Item>
				))}
			</Command.Group>
		</Command.List>
	);
}
