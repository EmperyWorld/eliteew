import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from 'react';

import { cn } from '@/utils/cn';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';
import { InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

const POPOVER_MARGIN = 8;

function computePopoverPosition(
	trigger: DOMRect,
	panelW: number,
	panelH: number,
	vw: number,
	vh: number
): { top: number; left: number } {
	const margin = POPOVER_MARGIN;
	const width = Math.min(panelW, vw - margin * 2);
	const height = Math.min(panelH, vh - margin * 2);

	let top = trigger.bottom + margin;
	if (top + height > vh - margin) {
		const aboveTop = trigger.top - height - margin;
		top =
			aboveTop >= margin ? aboveTop : Math.max(margin, vh - height - margin);
	}

	let left = trigger.left + trigger.width / 2 - width / 2;
	if (left + width > vw - margin) {
		left = vw - width - margin;
	}
	if (left < margin) {
		left = margin;
	}

	return { top, left };
}

interface FriendsInfoButtonProps {
	title: string;
	description: string;
	tips?: string[];
	compact?: boolean;
}

export function FriendsInfoButton({
	title,
	description,
	tips = [],
	compact = true,
}: FriendsInfoButtonProps): JSX.Element {
	const portalStackBase = useDesktopWindowPortalStackBase();
	const [open, setOpen] = useState(false);
	const [coords, setCoords] = useState({ top: 0, left: 0 });
	const triggerRef = useRef<HTMLSpanElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);

	const reposition = useCallback(() => {
		const triggerEl = triggerRef.current;
		if (!triggerEl || typeof window === 'undefined') {
			return;
		}

		const triggerRect = triggerEl.getBoundingClientRect();
		const panelWidth = panelRef.current?.offsetWidth || 320;
		const panelHeight = panelRef.current?.offsetHeight || 260;
		setCoords(
			computePopoverPosition(
				triggerRect,
				panelWidth,
				panelHeight,
				window.innerWidth,
				window.innerHeight
			)
		);
	}, []);

	useLayoutEffect(() => {
		if (!open) {
			return;
		}
		reposition();
		const raf = requestAnimationFrame(reposition);
		return () => cancelAnimationFrame(raf);
	}, [open, reposition]);

	useEffect(() => {
		if (!open) {
			return;
		}

		const onPointerDown = (event: MouseEvent) => {
			const target = event.target as Node | null;
			if (
				target &&
				(triggerRef.current?.contains(target) ||
					panelRef.current?.contains(target))
			) {
				return;
			}
			setOpen(false);
		};

		const onEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setOpen(false);
			}
		};

		const onViewportChange = () => reposition();

		document.addEventListener('mousedown', onPointerDown, true);
		document.addEventListener('keydown', onEscape);
		window.addEventListener('resize', onViewportChange);
		window.addEventListener('scroll', onViewportChange, true);

		return () => {
			document.removeEventListener('mousedown', onPointerDown, true);
			document.removeEventListener('keydown', onEscape);
			window.removeEventListener('resize', onViewportChange);
			window.removeEventListener('scroll', onViewportChange, true);
		};
	}, [open, reposition]);

	const panel = open ? (
		<div
			ref={panelRef}
			role="dialog"
			aria-label={title}
			data-desktop-window-ignore-context
			className="fixed w-[min(calc(100vw-1.5rem),22rem)] overflow-hidden rounded-2xl border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(20,30,46,0.96),rgba(8,12,20,0.92))] p-4 text-left text-xs leading-5 text-(--desktop-text-secondary) backdrop-blur-xl shadow-[0_24px_56px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)_inset]"
			style={{ top: coords.top, left: coords.left, zIndex: portalStackBase }}
		>
			<div
				className="absolute inset-x-0 top-0 h-16 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_72%)]"
				aria-hidden
			/>
			<div className="relative mb-3 flex items-start justify-between gap-3 border-b border-white/8 pb-3">
				<div className="flex min-w-0 items-start gap-3">
					<span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
						<InformationCircleIcon className="h-4 w-4" />
					</span>
					<div className="min-w-0">
						<div className="pr-1 text-sm font-semibold text-(--desktop-text-primary)">
							{title}
						</div>
					</div>
				</div>
				<button
					type="button"
					className="shrink-0 rounded-lg p-1.5 text-(--desktop-text-muted) transition-colors hover:bg-white/8 hover:text-(--desktop-text-primary)"
					onClick={() => setOpen(false)}
					aria-label={title}
				>
					<XMarkIcon className="h-4 w-4" />
				</button>
			</div>
			<p className="relative text-[13px] leading-6 text-(--desktop-text-secondary)">
				{description}
			</p>
			{tips.length > 0 ? (
				<ul className="relative mt-3 space-y-2 rounded-xl border border-white/6 bg-white/4 p-3 text-[12px] text-(--desktop-text-muted)">
					{tips.map((tip) => (
						<li key={tip} className="flex gap-2">
							<span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300/80" />
							<span>{tip}</span>
						</li>
					))}
				</ul>
			) : null}
		</div>
	) : null;

	return (
		<>
			<span ref={triggerRef} className="inline-flex shrink-0">
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="icon"
					className={cn(
						'shrink-0 text-(--desktop-text-muted) hover:text-[rgb(var(--desktop-accent-rgb))]',
						open &&
							'border border-cyan-400/20 bg-cyan-500/10 text-cyan-200 shadow-[0_0_0_1px_rgba(34,211,238,0.08)_inset]',
						compact ? 'h-7 w-7' : 'h-8 w-8'
					)}
					aria-expanded={open}
					aria-haspopup="dialog"
					aria-label={title}
					onClick={() => setOpen((value) => !value)}
				>
					<InformationCircleIcon
						className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}
					/>
				</DesktopAppButton>
			</span>
			{panel ? <ShellPortalMount>{panel}</ShellPortalMount> : null}
		</>
	);
}
