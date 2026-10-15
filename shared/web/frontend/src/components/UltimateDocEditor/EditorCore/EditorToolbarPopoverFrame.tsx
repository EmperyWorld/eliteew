/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * ShellPortalMount-framed animated popover panel for Ultimate Doc Editor toolbar
 * insert dialogs (link, image, table, font family).
 *
 * Invariants:
 * - Renders via ShellPortalMount so --desktop-* theme tokens apply on body mount.
 *
 * Related:
 * - EditorToolbar.tsx, ultimateDocEditorBodyPortals.theme.contract.test.ts
 */
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type * as React from 'react';
import { XCircleIcon } from '@heroicons/react/24/outline';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { cn } from '@/utils/cn';
import { DesktopAppButton } from '../../../pages/Desktop/components/DesktopAppChrome';
import { ShellPortalMount } from '../../../pages/Desktop/shell/shellPortal';
import type { EditorToolbarPopoverId } from './useEditorToolbarPopovers';

export interface EditorToolbarPopoverFrameProps {
	id: EditorToolbarPopoverId;
	popoverRef: React.RefObject<HTMLDivElement | null>;
	header: { icon: React.ReactNode; title: string; subtitle: string };
	children: React.ReactNode;
	activePopover: EditorToolbarPopoverId | null;
	popoverPosition: { x: number; y: number } | null;
	closePopover: () => void;
	closePanelAriaLabel: string;
}

export function EditorToolbarPopoverFrame({
	id,
	popoverRef,
	header,
	children,
	activePopover,
	popoverPosition,
	closePopover,
	closePanelAriaLabel,
}: EditorToolbarPopoverFrameProps) {
	const reduceMotion = useReducedMotion();
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();

	if (typeof document === 'undefined') {
		return null;
	}

	return (
		<ShellPortalMount>
			<AnimatePresence>
				{activePopover === id && popoverPosition && (
					<motion.div
						key={id}
						ref={popoverRef}
						initial={
							reduceMotion
								? { opacity: 1, y: 0, scale: 1 }
								: { opacity: 0, y: -8, scale: 0.96 }
						}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={
							reduceMotion
								? { opacity: 1, y: 0, scale: 1 }
								: { opacity: 0, y: -8, scale: 0.96 }
						}
						transition={{
							duration: reduceMotion ? 0 : 0.18,
							ease: 'easeOut',
						}}
						className="fixed w-[320px] rounded-3xl border border-(--desktop-border-strong) bg-(--desktop-surface-panel-strong) p-5 shadow-(--desktop-shadow-panel) backdrop-blur-2xl"
						style={{
							zIndex: embeddedModalZ.content,
							left: `${popoverPosition.x}px`,
							top: `${popoverPosition.y}px`,
						}}
					>
						<div className="flex items-start justify-between gap-3 border-b border-(--desktop-border-subtle) pb-3">
							<div className="flex items-center gap-3">
								<div className="rounded-2xl border border-[rgb(var(--desktop-accent-rgb))]/30 bg-(--desktop-surface-accent) p-2 text-white">
									{header.icon}
								</div>
								<div className="space-y-1">
									<p className="text-sm font-semibold text-(--desktop-text-primary)">
										{header.title}
									</p>
									<p className={cn(DESKTOP_TYPOGRAPHY.meta)}>
										{header.subtitle}
									</p>
								</div>
							</div>
							<DesktopAppButton
								type="button"
								onClick={closePopover}
								variant="ghost"
								size="icon"
								className="h-8 w-8"
								aria-label={closePanelAriaLabel}
							>
								<XCircleIcon width={20} height={20} />
							</DesktopAppButton>
						</div>
						<div className="mt-4 space-y-4">{children}</div>
					</motion.div>
				)}
			</AnimatePresence>
		</ShellPortalMount>
	);
}
