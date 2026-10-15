/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Anchored portal popover for Visual Studio preview hotspot inline editing.
 *
 * Invariants:
 * - One popover at a time; reposition on resize/scroll; Escape and outside-click close.
 *
 * Related:
 * - `DesktopVisualStudioPreviewInteractive.tsx`, `ShellPortalMount`
 */

import { cn } from '@/utils/cn';
import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
	type ReactNode,
	type RefObject,
} from 'react';
import { useDesktopWindowPortalStackBase } from '../../../context/DesktopWindowPortalStackContext';
import { useDesktopPopoverOpenGuard } from '../../../hooks/useDesktopPopoverOpenGuard';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';
import { DESKTOP_TYPOGRAPHY } from '../../../constants';

export function VisualStudioHotspotPopover({
	open,
	anchorRef,
	onClose,
	title,
	children,
	footer,
	width = 300,
}: {
	open: boolean;
	anchorRef: RefObject<HTMLElement | null>;
	onClose: () => void;
	title: string;
	children: ReactNode;
	footer?: ReactNode;
	width?: number;
}) {
	const baseId = useId();
	const portalStackBase = useDesktopWindowPortalStackBase();
	const panelRef = useRef<HTMLDivElement>(null);
	const openClickGuardRef = useDesktopPopoverOpenGuard(open);
	const [panelPos, setPanelPos] = useState<{
		top: number;
		left: number;
		width: number;
	} | null>(null);

	const updatePosition = useCallback(() => {
		const el = anchorRef.current;
		const margin = 8;
		const panelW = Math.min(window.innerWidth - 2 * margin, width);
		if (!el) {
			const left = Math.max(margin, (window.innerWidth - panelW) / 2);
			setPanelPos({
				top: Math.max(margin, Math.round(window.innerHeight * 0.18)),
				left,
				width: panelW,
			});
			return;
		}
		const r = el.getBoundingClientRect();
		let left = r.left + r.width / 2 - panelW / 2;
		if (left < margin) left = margin;
		if (left + panelW > window.innerWidth - margin) {
			left = window.innerWidth - panelW - margin;
		}
		const measuredHeight = panelRef.current?.offsetHeight ?? 0;
		const panelH = measuredHeight > 0 ? measuredHeight : 280;
		let top = r.bottom + 6;
		if (top + panelH > window.innerHeight - margin) {
			top = Math.max(margin, r.top - panelH - 6);
		}
		setPanelPos({ top, left, width: panelW });
	}, [anchorRef, width]);

	useLayoutEffect(() => {
		if (!open || !panelRef.current) return;
		const node = panelRef.current;
		const observer = new ResizeObserver(() => updatePosition());
		observer.observe(node);
		return () => observer.disconnect();
	}, [open, updatePosition]);

	useLayoutEffect(() => {
		if (!open) {
			setPanelPos(null);
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

	useEffect(() => {
		if (!open) return;
		const onDoc = (event: MouseEvent) => {
			if (openClickGuardRef.current) return;
			const target = event.target as Node;
			if (
				anchorRef.current?.contains(target) ||
				panelRef.current?.contains(target)
			) {
				return;
			}
			onClose();
		};
		document.addEventListener('mousedown', onDoc, true);
		return () => document.removeEventListener('mousedown', onDoc, true);
	}, [anchorRef, onClose, open, openClickGuardRef]);

	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [onClose, open]);

	useEffect(() => {
		if (!open || !panelPos) return;
		const titleEl = panelRef.current?.querySelector<HTMLElement>(
			'[data-visual-studio-popover-title]'
		);
		titleEl?.focus({ preventScroll: true });
	}, [open, panelPos]);

	if (!open || !panelPos) return null;

	return (
		<ShellPortalMount>
			<div
				ref={panelRef}
				id={`${baseId}-panel`}
				role="dialog"
				aria-modal="true"
				aria-labelledby={`${baseId}-title`}
				className={cn(
					'fixed max-h-[min(70vh,420px)] overflow-y-auto rounded-(--desktop-radius-lg) text-(--desktop-text-primary)',
					'border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong)/97 p-3 backdrop-blur-md',
					'shadow-lg ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.14)]'
				)}
				style={{
					top: panelPos.top,
					left: panelPos.left,
					width: panelPos.width,
					zIndex: portalStackBase + 2,
				}}
				onPointerDown={(event) => event.stopPropagation()}
			>
				<p
					id={`${baseId}-title`}
					data-visual-studio-popover-title
					tabIndex={-1}
					className={cn(
						DESKTOP_TYPOGRAPHY.captionInherit,
						'mb-2.5 font-semibold text-(--desktop-text-primary) outline-none'
					)}
				>
					{title}
				</p>
				{children}
				{footer ? (
					<div className="mt-3 border-t border-(--desktop-border-subtle)/80 pt-2.5">
						{footer}
					</div>
				) : null}
			</div>
		</ShellPortalMount>
	);
}
