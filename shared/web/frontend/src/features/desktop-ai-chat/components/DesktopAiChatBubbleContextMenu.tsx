/**
 * ПКМ по пузырю сообщения Desktop AI Chat — ShellPortalMount (shell body portal).
 */
import { cn } from '@/utils/cn';
import { m, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import { getDesktopShellContextMenuClassName } from '@/pages/Desktop/utils/desktopVisualSystem';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';
import { getContextMenuPositionFromCursor } from '@/pages/Desktop/utils/desktopUi';
import { DocumentDuplicateIcon, TrashIcon } from '@heroicons/react/24/outline';

const LUCIDE_SW = DESKTOP_LUCIDE.stroke;
const MENU_W = 220;
const MENU_H_MAX = 200;

const menuItemClass = cn(
	'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors',
	DESKTOP_TYPOGRAPHY.shellCopy13,
	DESKTOP_CHROME_FOCUS_VISIBLE,
	'outline-none'
);

export type DesktopAiChatBubbleContextPayload = {
	anchor: { clientX: number; clientY: number };
	messageRole: 'user' | 'assistant';
	onCopy?: () => void;
	onDeleteFromHere?: () => void;
};

export function DesktopAiChatBubbleContextMenu({
	open,
	payload,
	onClose,
}: {
	open: boolean;
	payload: DesktopAiChatBubbleContextPayload | null;
	onClose: () => void;
}): JSX.Element | null {
	const { t } = useTranslation('desktopAiChat');
	const shellFrame = useDesktopShellFrame();
	const portalStackBase = useDesktopWindowPortalStackBase();
	const menuRef = useRef<HTMLDivElement | null>(null);
	const baseId = useId();
	const reduceMotion = useReducedMotion();

	const pos =
		open && payload
			? getContextMenuPositionFromCursor({
					clientX: payload.anchor.clientX,
					clientY: payload.anchor.clientY,
					menuWidth: MENU_W,
					menuHeight: MENU_H_MAX,
				})
			: null;

	const menuSurfaceClass = cn(
		getDesktopShellContextMenuClassName(shellFrame, { clipOverflow: true }),
		'min-w-[12.5rem] p-1 origin-top-left w-full'
	);

	useLayoutEffect(() => {
		if (!open || !pos) return;
		const first =
			menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
		queueMicrotask(() => first?.focus());
	}, [open, pos]);

	useEffect(() => {
		if (!open) return;
		const onDoc = (e: MouseEvent) => {
			const el = e.target as Node;
			if (menuRef.current?.contains(el)) return;
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

	if (!open || !payload || !pos || typeof document === 'undefined') {
		return null;
	}

	const hasCopy = Boolean(payload.onCopy);
	const hasDelete = Boolean(payload.onDeleteFromHere);
	if (!hasCopy && !hasDelete) {
		return null;
	}

	const copyLabel =
		payload.messageRole === 'user'
			? t('copyUserMessageTitle')
			: t('copyAnswerTitle');

	const portal = (
		<m.div
			className="fixed text-(--desktop-text-primary)"
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
				aria-label={t('bubbleCtxMenuAria')}
				aria-orientation="vertical"
				className={menuSurfaceClass}
			>
				{hasCopy ? (
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
							payload.onCopy?.();
						}}
					>
						<DocumentDuplicateIcon
							className="h-4 w-4 shrink-0 opacity-90"
							aria-hidden
							strokeWidth={LUCIDE_SW}
						/>
						{copyLabel}
					</button>
				) : null}
				{hasDelete ? (
					<button
						type="button"
						role="menuitem"
						tabIndex={-1}
						className={cn(
							menuItemClass,
							'text-amber-200/95 hover:bg-red-500/12 hover:text-amber-50'
						)}
						onClick={() => {
							onClose();
							payload.onDeleteFromHere?.();
						}}
					>
						<TrashIcon
							className="h-4 w-4 shrink-0 opacity-90"
							aria-hidden
							strokeWidth={LUCIDE_SW}
						/>
						{t('deleteFromHereTitle')}
					</button>
				) : null}
			</div>
		</m.div>
	);

	return <ShellPortalMount>{portal}</ShellPortalMount>;
}
