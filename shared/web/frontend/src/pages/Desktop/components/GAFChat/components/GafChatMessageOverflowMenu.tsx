/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact overflow for message actions via useShellPortal (fixed layer above feed).
 *
 * Invariants:
 * - No createPortal / DesktopShellFloatingPortal in this module.
 *
 * Related:
 * - pages/Desktop/shell/shellPortal.tsx
 */
import { cn } from '@/utils/cn';
import { m, useReducedMotion } from 'framer-motion';
import * as React from 'react';
import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { useShellPortal } from '@/pages/Desktop/shell/shellPortal';
import { useDesktopShellFrame } from '../../../context/DesktopShellFrameContext';
import { getGafChatOverflowMenuSurfaceClassName } from '../../../utils/desktopVisualSystem';
import {
	EllipsisVerticalIcon,
	PencilIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';

import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
} from '../../DesktopAppChrome';
import { GafChatDesktopIconTooltip } from '../gafChatDesktopIconTooltip';

const LUCIDE_SW = DESKTOP_LUCIDE.stroke;

export function GafChatMessageOverflowMenu({
	canEdit,
	canDeleteForEveryone,
	onEdit,
	onDeleteForMe,
	onDeleteForEveryone,
	buttonClassName,
}: {
	canEdit: boolean;
	canDeleteForEveryone: boolean;
	onEdit: () => void;
	onDeleteForMe: () => void;
	onDeleteForEveryone?: () => void;
	buttonClassName: string;
}): JSX.Element {
	const { Portal } = useShellPortal({
		layer: 'shell_global',
		dismissOnEscape: false,
		trapFocus: false,
	});

	const { t } = useTranslation('gafChat');
	const shellFrame = useDesktopShellFrame();
	const portalStackBase = useDesktopWindowPortalStackBase();
	const [open, setOpen] = useState(false);
	const anchorRef = useRef<HTMLDivElement | null>(null);
	const menuRef = useRef<HTMLDivElement | null>(null);
	const baseId = useId();
	const reduceMotion = useReducedMotion();

	const [menuPos, setMenuPos] = useState<{
		top: number;
		left: number;
		width: number;
	} | null>(null);

	const MENU_MIN_W = 200;

	const updatePosition = useCallback(() => {
		const el = anchorRef.current;
		if (!el) return;
		const r = el.getBoundingClientRect();
		const w = MENU_MIN_W;
		let left = r.right - w;
		const margin = 8;
		if (left < margin) left = margin;
		if (left + w > window.innerWidth - margin) {
			left = window.innerWidth - w - margin;
		}
		setMenuPos({ top: r.bottom + 4, left, width: w });
	}, []);

	useLayoutEffect(() => {
		if (!open) {
			setMenuPos(null);
			return;
		}
		updatePosition();
		const onScrollOrResize = () => updatePosition();
		window.addEventListener('resize', onScrollOrResize);
		window.addEventListener('scroll', onScrollOrResize, true);
		return () => {
			window.removeEventListener('resize', onScrollOrResize);
			window.removeEventListener('scroll', onScrollOrResize, true);
		};
	}, [open, updatePosition]);

	const menuSurfaceClass = cn(
		getGafChatOverflowMenuSurfaceClassName(shellFrame),
		'min-w-[12.5rem] p-1 origin-top w-full'
	);

	const menuItemClass = cn(
		'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors',
		DESKTOP_TYPOGRAPHY.shellCopy13,
		DESKTOP_CHROME_FOCUS_VISIBLE,
		'outline-none'
	);

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
		if (!open || !menuPos) return;
		const first =
			menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
		queueMicrotask(() => first?.focus());
	}, [open, menuPos]);

	useEffect(() => {
		if (!open) return;
		const onDoc = (e: MouseEvent) => {
			const target = e.target as Node;
			if (
				anchorRef.current?.contains(target) ||
				menuRef.current?.contains(target)
			) {
				return;
			}
			setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setOpen(false);
		};
		document.addEventListener('mousedown', onDoc, true);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onDoc, true);
			document.removeEventListener('keydown', onKey);
		};
	}, [open]);

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
			const last = items?.[items.length - 1];
			last?.focus();
		}
	};

	const menuPortal =
		open && menuPos && typeof document !== 'undefined' ? (
			<m.div
				className="fixed"
				style={{
					top: menuPos.top,
					left: menuPos.left,
					width: menuPos.width,
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
					id={`${baseId}-menu`}
					role="menu"
					aria-orientation="vertical"
					className={menuSurfaceClass}
					onKeyDown={onMenuKeyDown}
				>
					{canEdit ? (
						<button
							type="button"
							role="menuitem"
							tabIndex={-1}
							className={cn(
								menuItemClass,
								'text-(--desktop-text-primary) hover:bg-(--desktop-surface-soft-hover)'
							)}
							onClick={() => {
								setOpen(false);
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
					<button
						type="button"
						role="menuitem"
						tabIndex={-1}
						className={cn(
							menuItemClass,
							'text-(--desktop-text-primary) hover:bg-(--desktop-surface-soft-hover)'
						)}
						onClick={() => {
							setOpen(false);
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
								setOpen(false);
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
		) : null;

	return (
		<div className="relative shrink-0" ref={anchorRef}>
			<GafChatDesktopIconTooltip content={t('messageActionsAria')}>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="icon"
					className={buttonClassName}
					aria-expanded={open}
					aria-haspopup="menu"
					aria-controls={`${baseId}-menu`}
					aria-label={t('messageActionsAria')}
					onPointerDown={(e) => e.stopPropagation()}
					onClick={(e) => {
						e.stopPropagation();
						setOpen((v) => !v);
					}}
				>
					<EllipsisVerticalIcon
						className="h-4 w-4"
						aria-hidden
						strokeWidth={LUCIDE_SW}
					/>
				</DesktopAppButton>
			</GafChatDesktopIconTooltip>
			{menuPortal ? <Portal>{menuPortal}</Portal> : null}
		</div>
	);
}
