/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * ⌘K command palette (cmdk) orchestrator — system/power actions without app catalog.
 *
 * Invariants:
 * - Hotkey Ctrl/Cmd+K; closes on Esc or repeat toggle.
 * - P12: no Apps / Open-{name} group from desktop items (Start owns the catalog).
 * - Escape clears search first, then closes palette (`ModalAdvanced` search escape props).
 *
 * Related:
 * - commandPalette/useCommandPaletteModel.ts
 * - commandPalette/useCommandPaletteKeyboard.ts
 * - utils/desktopShellKeyboardCapture.ts
 * - components/ui/ModalAdvanced.tsx
 */

import { ModalAdvanced } from '@/components/ui/ModalAdvanced';
import { cn } from '@/utils/cn';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '../constants';
import { Command } from 'cmdk';
import * as React from 'react';
import { applyDesktopContextMenuPolicy } from '../utils/desktopContextMenuPolicy';
import {
	getDesktopShellHeaderStripClassName,
	getDesktopShellPanelClassName,
} from '../utils/desktopVisualSystem';
import { DesktopAppButton } from './DesktopAppChrome';
import { DesktopChromeTooltip } from './DesktopChromeTooltip';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { commandPaletteStyles } from './commandPalette/commandPaletteStyles';
import { CommandPaletteGroups } from './commandPalette/CommandPaletteGroups';
import { useCommandPaletteKeyboard } from './commandPalette/useCommandPaletteKeyboard';
import { useCommandPaletteModel } from './commandPalette/useCommandPaletteModel';
import type { CommandPaletteProps } from './commandPalette/types';

export type { CommandPaletteProps } from './commandPalette/types';

export const CommandPalette: React.FC<CommandPaletteProps> = ({
	isOpen,
	onClose,
	onAction,
	shellWindowStyle = 'glass',
}) => {
	const {
		t,
		search,
		setSearch,
		containerRef,
		handleClose,
		runAction,
		togglePaletteShortcutLabel,
		systemCommands,
		quickActions,
	} = useCommandPaletteModel({ isOpen, onClose, onAction });

	const handleContainerKeyDown = useCommandPaletteKeyboard(containerRef);

	return (
		<ModalAdvanced
			isOpen={isOpen}
			onClose={handleClose}
			searchEscapeValue={search}
			onSearchEscapeClear={() => setSearch('')}
			title=""
			size="md"
			variant="desktop"
			showCloseButton={false}
			trapFocus={false}
			className={cn(
				'max-w-[640px] w-full',
				getDesktopShellPanelClassName(shellWindowStyle, 'strong')
			)}
		>
			<style>{commandPaletteStyles}</style>
			<div
				ref={containerRef}
				role="application"
				data-desktop-shell-keyboard-surface=""
				aria-label={t('commandPalette.dialogLabel')}
				tabIndex={-1}
				onKeyDown={handleContainerKeyDown}
				onContextMenu={(e) =>
					applyDesktopContextMenuPolicy(e, { stopPropagation: false })
				}
			>
				<div
					className={cn(
						'shrink-0 px-4 py-3 sm:px-5 sm:py-3.5',
						getDesktopShellHeaderStripClassName(shellWindowStyle)
					)}
				>
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<div className={DESKTOP_TYPOGRAPHY.sectionOverlineStrong}>
								{t('commandPalette.roleTitle')}
							</div>
							<p
								className={cn(DESKTOP_TYPOGRAPHY.meta, 'mt-1 leading-relaxed')}
							>
								{t('commandPalette.roleDescription')}
							</p>
						</div>
						<div className="flex shrink-0 items-center gap-2">
							<span
								className={cn(
									DESKTOP_TYPOGRAPHY.sectionPill,
									'rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) px-2 py-1'
								)}
								aria-hidden
							>
								{t('commandPalette.roleBadge')}
							</span>
							<DesktopChromeTooltip
								content={`Esc · ${t('commandPalette.footerHintClose')}`}
								placement="top"
								offsetExtra={4}
							>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="icon"
									onClick={handleClose}
									aria-label={t('commandPalette.closeAria')}
								>
									<XMarkIcon
										className={DESKTOP_LUCIDE.lg}
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
								</DesktopAppButton>
							</DesktopChromeTooltip>
						</div>
					</div>
				</div>
				<Command
					value={search}
					onValueChange={setSearch}
					filter={(value, search) => {
						if (value.toLowerCase().includes(search.toLowerCase())) return 1;
						return 0;
					}}
				>
					<Command.Input
						placeholder={t('commandPalette.searchPlaceholder')}
						autoFocus
					/>

					<CommandPaletteGroups
						t={t}
						systemCommands={systemCommands}
						quickActions={quickActions}
						runAction={runAction}
					/>

					<div
						className={cn(
							'flex items-center justify-between px-4 py-2 border-t border-(--desktop-border-subtle)',
							DESKTOP_TYPOGRAPHY.meta,
							'text-(--desktop-text-dim)'
						)}
					>
						<div className="flex items-center gap-4">
							<span className="flex items-center gap-1">
								<kbd className={DESKTOP_TYPOGRAPHY.shellKbdGlyph}>↑↓</kbd>
								{t('commandPalette.footerHintNav')}
							</span>
							<span className="flex items-center gap-1">
								<kbd className={DESKTOP_TYPOGRAPHY.shellKbdGlyph}>↵</kbd>
								{t('commandPalette.footerHintSelect')}
							</span>
							<span className="flex items-center gap-1">
								<kbd className={DESKTOP_TYPOGRAPHY.shellKbdGlyph}>Esc</kbd>
								{t('commandPalette.footerHintClose')}
							</span>
						</div>
						<span className={DESKTOP_TYPOGRAPHY.matchHighlight}>
							{togglePaletteShortcutLabel}
						</span>
					</div>
				</Command>
			</div>
		</ModalAdvanced>
	);
};

export default CommandPalette;
