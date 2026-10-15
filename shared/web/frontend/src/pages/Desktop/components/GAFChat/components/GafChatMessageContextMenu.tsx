/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * ПКМ по пузырю сообщения — actions via useShellPortal (above feed).
 *
 * Invariants:
 * - No createPortal / DesktopShellFloatingPortal.
 *
 * Related:
 * - pages/Desktop/shell/shellPortal.tsx
 */
import type { DesktopWindowStyle } from '@/types/profile';
import { cn } from '@/utils/cn';
import { m, useReducedMotion } from 'framer-motion';
import * as React from 'react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { useShellPortal } from '@/pages/Desktop/shell/shellPortal';
import { useDesktopShellFrame } from '../../../context/DesktopShellFrameContext';
import { getDesktopShellContextMenuClassName } from '../../../utils/desktopVisualSystem';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '../../DesktopAppChrome';
import { getContextMenuPositionFromCursor } from '../../../utils/desktopUi';
import {
	ArrowUturnLeftIcon,
	DocumentDuplicateIcon,
	PencilIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';

const LUCIDE_SW = DESKTOP_LUCIDE.stroke;
const MENU_W = 220;
/** Верхняя оценка высоты при всех пунктах; нужна для flip/clamp в getContextMenuPositionFromCursor */
const MENU_H_MAX = 320;

/** Полезная нагрузка для singleton-провайдера: якорь + колбэки на одно открытие меню. */
export type GafChatMessageContextMenuPayload = {
	anchor: { clientX: number; clientY: number };
	onCopy: () => void;
	showReply: boolean;
	onReply?: () => void;
	canEdit: boolean;
	onEdit?: () => void;
	onDeleteForMe?: () => void;
	canDeleteForEveryone: boolean;
	onDeleteForEveryone?: () => void;
};

function getMessageContextMenuSurfaceClass(shellFrame: DesktopWindowStyle) {
	return cn(
		getDesktopShellContextMenuClassName(shellFrame, { clipOverflow: true }),
		'min-w-[12.5rem] p-1 origin-top-left w-full'
	);
}

const menuItemClass = cn(
	'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors',
	DESKTOP_TYPOGRAPHY.shellCopy13,
	DESKTOP_CHROME_FOCUS_VISIBLE,
	'outline-none'
);

export function GafChatMessageContextMenu({
	open,
	anchor,
	onClose,
	onCopy,
	showReply,
	onReply,
	canEdit,
	onEdit,
	onDeleteForMe,
	canDeleteForEveryone,
	onDeleteForEveryone,
}: {
	open: boolean;
	anchor: { clientX: number; clientY: number } | null;
	onClose: () => void;
	onCopy: () => void;
	showReply: boolean;
	onReply?: () => void;
	canEdit: boolean;
	onEdit?: () => void;
	/** Как overflow: только если есть «удалить у меня» */
	onDeleteForMe?: () => void;
	canDeleteForEveryone: boolean;
	onDeleteForEveryone?: () => void;
}): JSX.Element | null {
	const { Portal } = useShellPortal({
		layer: 'shell_global',
		dismissOnEscape: false,
		trapFocus: false,
	});
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
					menuHeight: MENU_H_MAX,
				})
			: null;

	const focusItemByDelta = useCallback((delta: number) => {
		const root = menuRef.current;
		if (!root) return;
		const items = [...root.querySelectorAll<HTMLElement>('[role="menuitem"]')];
		if (items.length === 0) return;
		const active = document.activeElement;
		let idx = items.indexOf(active as HTMLElement);
		if (idx < 0) idx = 0;
		const next = (idx + delta + items.length) % items.length;
		items[next]?.focus();
	}, []);

	useLayoutEffect(() => {
		if (!open || !pos) return;
		const first =
			menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
		queueMicrotask(() => first?.focus());
	}, [open, pos]);

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

	const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			focusItemByDelta(1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			focusItemByDelta(-1);
		} else if (e.key === 'Home') {
			e.preventDefault();
			const first =
				menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
			first?.focus();
		} else if (e.key === 'End') {
			e.preventDefault();
			const items =
				menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
			items?.[items.length - 1]?.focus();
		}
	};

	const menuSurfaceClass = getMessageContextMenuSurfaceClass(shellFrame);

	if (!open || !pos || typeof document === 'undefined') return null;

	const hasSecondBlock = Boolean(
		(canEdit && onEdit) ||
			onDeleteForMe ||
			(canDeleteForEveryone && onDeleteForEveryone)
	);

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
				id={`${baseId}-ctx-menu`}
				role="menu"
				aria-orientation="vertical"
				className={menuSurfaceClass}
				onKeyDown={onMenuKeyDown}
			>
				<button
					type="button"
					role="menuitem"
					tabIndex={-1}
					className={cn(
						menuItemClass,
						'text-(--desktop-text-primary) hover:bg-(--desktop-surface-soft-hover)'
					)}
					onClick={() => {
						onClose();
						onCopy();
					}}
				>
					<DocumentDuplicateIcon
						className="h-4 w-4 shrink-0 opacity-90"
						aria-hidden
						strokeWidth={LUCIDE_SW}
					/>
					{t('copyMessageTitle')}
				</button>
				{showReply && onReply ? (
					<button
						type="button"
						role="menuitem"
						tabIndex={-1}
						className={cn(
							menuItemClass,
							'text-(--desktop-text-primary) hover:bg-(--desktop-surface-soft-hover)'
						)}
						onClick={() => {
							onClose();
							onReply();
						}}
					>
						<ArrowUturnLeftIcon
							className="h-4 w-4 shrink-0 opacity-90"
							aria-hidden
							strokeWidth={LUCIDE_SW}
						/>
						{t('replyToMessage')}
					</button>
				) : null}
				{hasSecondBlock ? (
					<hr className="my-1 border-0 border-t border-(--desktop-border-subtle)/80" />
				) : null}
				{canEdit && onEdit ? (
					<button
						type="button"
						role="menuitem"
						tabIndex={-1}
						className={cn(
							menuItemClass,
							'text-(--desktop-text-primary) hover:bg-(--desktop-surface-soft-hover)'
						)}
						onClick={() => {
							onClose();
							onEdit();
						}}
					>
						<PencilIcon
							className="h-4 w-4 shrink-0 opacity-90"
							aria-hidden
							strokeWidth={LUCIDE_SW}
						/>
						{t('messageEdit')}
					</button>
				) : null}
				{onDeleteForMe ? (
					<button
						type="button"
						role="menuitem"
						tabIndex={-1}
						className={cn(
							menuItemClass,
							'text-(--desktop-text-primary) hover:bg-(--desktop-surface-soft-hover)'
						)}
						onClick={() => {
							onClose();
							onDeleteForMe();
						}}
					>
						<TrashIcon
							className="h-4 w-4 shrink-0 opacity-80"
							aria-hidden
							strokeWidth={LUCIDE_SW}
						/>
						{t('messageDeleteForMe')}
					</button>
				) : null}
				{canDeleteForEveryone && onDeleteForEveryone ? (
					<button
						type="button"
						role="menuitem"
						tabIndex={-1}
						className={cn(
							menuItemClass,
							'text-red-600 hover:bg-red-500/12 dark:text-red-300/95 dark:hover:bg-red-500/18'
						)}
						onClick={() => {
							onClose();
							onDeleteForEveryone();
						}}
					>
						<TrashIcon
							className="h-4 w-4 shrink-0"
							aria-hidden
							strokeWidth={LUCIDE_SW}
						/>
						{t('messageDeleteForEveryone')}
					</button>
				) : null}
			</div>
		</m.div>
	);

	return <Portal>{portal}</Portal>;
}
