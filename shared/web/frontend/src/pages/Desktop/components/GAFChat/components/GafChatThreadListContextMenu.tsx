/**
 * ПКМ по строке списка диалогов: открыть чат, закрепить/открепить (если доступно).
 */
import { cn } from '@/utils/cn';
import { m, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { useDesktopShellFrame } from '../../../context/DesktopShellFrameContext';
import { getDesktopShellContextMenuClassName } from '../../../utils/desktopVisualSystem';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '../../DesktopAppChrome';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';
import { getContextMenuPositionFromCursor } from '../../../utils/desktopUi';
import {
	ChatBubbleLeftRightIcon,
	MapPinIcon,
} from '@heroicons/react/24/outline';

const LUCIDE_SW = DESKTOP_LUCIDE.stroke;
const MENU_W = 208;
const MENU_H = 120;

const menuItemClass = cn(
	'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors',
	DESKTOP_TYPOGRAPHY.shellCopy13,
	DESKTOP_CHROME_FOCUS_VISIBLE,
	'outline-none'
);

export function GafChatThreadListContextMenu({
	open,
	anchor,
	onClose,
	onOpenChat,
	showPin,
	pinned,
	onTogglePin,
}: {
	open: boolean;
	anchor: { clientX: number; clientY: number } | null;
	onClose: () => void;
	onOpenChat: () => void;
	showPin: boolean;
	pinned?: boolean;
	onTogglePin?: () => void;
}): JSX.Element | null {
	const { t } = useTranslation('gafChat');
	const shellFrame = useDesktopShellFrame();
	const portalStackBase = useDesktopWindowPortalStackBase();
	const menuRef = useRef<HTMLDivElement | null>(null);
	const baseId = useId();
	const reduceMotion = useReducedMotion();

	const pos =
		open && anchor
			? getContextMenuPositionFromCursor({
					clientX: anchor.clientX,
					clientY: anchor.clientY,
					menuWidth: MENU_W,
					menuHeight: MENU_H,
				})
			: null;

	useEffect(() => {
		if (!open) return;
		const onDoc = (e: MouseEvent) => {
			const t = e.target as Node;
			if (menuRef.current?.contains(t)) return;
			onClose();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		document.addEventListener('mousedown', onDoc, true);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onDoc, true);
			document.removeEventListener('keydown', onKey);
		};
	}, [open, onClose]);

	const menuSurfaceClass = cn(
		getDesktopShellContextMenuClassName(shellFrame, { clipOverflow: true }),
		'min-w-[13rem] p-1 origin-top-left w-full'
	);

	if (!open || !pos || typeof document === 'undefined') return null;

	const portal = (
		<m.div
			className="fixed"
			style={{
				top: pos.y,
				left: pos.x,
				width: MENU_W,
				zIndex: portalStackBase,
			}}
			onPointerDown={(e) => e.stopPropagation()}
			initial={reduceMotion ? false : { opacity: 0, y: -4, scale: 0.98 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{
				duration: reduceMotion ? 0 : 0.14,
				ease: [0.16, 1, 0.3, 1],
			}}
		>
			<div
				ref={menuRef}
				id={`${baseId}-thread-ctx`}
				role="menu"
				aria-orientation="vertical"
				className={menuSurfaceClass}
			>
				<button
					type="button"
					role="menuitem"
					className={cn(
						menuItemClass,
						'text-(--desktop-text-primary) hover:bg-(--desktop-surface-soft-hover)'
					)}
					onClick={() => {
						onClose();
						onOpenChat();
					}}
				>
					<ChatBubbleLeftRightIcon
						className="h-4 w-4 shrink-0 opacity-90"
						aria-hidden
						strokeWidth={LUCIDE_SW}
					/>
					{t('threadContextOpen')}
				</button>
				{showPin && onTogglePin ? (
					<button
						type="button"
						role="menuitem"
						className={cn(
							menuItemClass,
							'text-(--desktop-text-primary) hover:bg-(--desktop-surface-soft-hover)'
						)}
						onClick={() => {
							onClose();
							onTogglePin();
						}}
					>
						<MapPinIcon
							className={cn(
								'h-4 w-4 shrink-0 text-(--desktop-text-dim)',
								pinned &&
									'fill-[rgb(var(--desktop-accent-rgb)/0.35)] text-[rgb(var(--desktop-accent-rgb))]'
							)}
							aria-hidden
							strokeWidth={LUCIDE_SW}
						/>
						{pinned ? t('threadContextUnpin') : t('threadContextPin')}
					</button>
				) : null}
			</div>
		</m.div>
	);

	return <ShellPortalMount>{portal}</ShellPortalMount>;
}
