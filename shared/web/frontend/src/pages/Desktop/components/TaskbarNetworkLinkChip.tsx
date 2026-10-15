/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Always-visible taskbar chip for physical host link (ethernet / wifi / modem).
 * Green = active, red = inactive or unavailable. No IP/DNS/gateway UI.
 *
 * Invariants:
 * - Always mounted on primary rail (not «Ещё»).
 * - Does not open launcher network mutate; display-only.
 * - Browser / non-host: red unavailable (not hidden; never browser reachability as link).
 * - EmpiierOS: `EmperyDesktopNetworkLink.getLinkSnapshot` (wifi association, else up ethernet).
 *
 * Related:
 * - utils/hostNetworkLinkSnapshot.ts
 * - TaskbarRightToolbar.tsx
 * - documentation/product/desktop/DESKTOP-TASKBAR-ARCHITECTURE.md
 */

import { DesktopChromeTooltip } from './DesktopChromeTooltip';
import { cn } from '@/utils/cn';
import { m } from 'framer-motion';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SignalIcon, WifiIcon } from '@heroicons/react/24/outline';
import {
	fetchHostLinkSnapshot,
	type HostLinkKind,
	type HostLinkSnapshotView,
	unavailableHostLinkSnapshot,
} from '../utils/hostNetworkLinkSnapshot';
import { useFinePointerHover } from '../hooks/useFinePointerHover';

const POLL_MS = 8_000;

export type TaskbarNetworkLinkChipProps = {
	taskbarButtonSurface: string;
	reduceMotion: boolean | null;
};

function LinkKindIcon({ kind }: { kind: HostLinkKind | null }) {
	const className = 'h-4 w-4 shrink-0';
	if (kind === 'wifi') {
		return <WifiIcon className={className} aria-hidden />;
	}
	if (kind === 'modem') {
		return <SignalIcon className={className} aria-hidden />;
	}
	// ethernet + unknown → cable glyph (simple SVG; no Heroicons ethernet)
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.75"
			aria-hidden
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M8 4h8v4h2v4h-2v8H8v-8H6V8h2V4zm2 4h4M9 20h6M10 12h4"
			/>
		</svg>
	);
}

function kindLabelKey(kind: HostLinkKind | null): string {
	switch (kind) {
		case 'wifi':
			return 'taskbar.networkLinkKindWifi';
		case 'modem':
			return 'taskbar.networkLinkKindModem';
		case 'ethernet':
			return 'taskbar.networkLinkKindEthernet';
		default:
			return 'taskbar.networkLinkKindUnknown';
	}
}

export const TaskbarNetworkLinkChip = memo(function TaskbarNetworkLinkChip({
	taskbarButtonSurface,
	reduceMotion,
}: TaskbarNetworkLinkChipProps) {
	const { t } = useTranslation('desktopUi');
	const finePointerHover = useFinePointerHover();
	const [snap, setSnap] = useState<HostLinkSnapshotView>(() =>
		unavailableHostLinkSnapshot('boot')
	);

	useEffect(() => {
		let cancelled = false;
		let timer: ReturnType<typeof setInterval> | undefined;

		const refresh = async () => {
			const next = await fetchHostLinkSnapshot();
			if (!cancelled) setSnap(next);
		};

		void refresh();
		timer = setInterval(() => {
			void refresh();
		}, POLL_MS);

		const onFocus = () => {
			void refresh();
		};
		window.addEventListener('focus', onFocus);

		return () => {
			cancelled = true;
			if (timer) clearInterval(timer);
			window.removeEventListener('focus', onFocus);
		};
	}, []);

	const active = snap.ok && snap.active;
	const color = active ? 'rgb(34 197 94)' : 'rgb(220 38 38)';
	const glow = active ? 'rgba(34,197,94,0.35)' : 'rgba(220,38,38,0.32)';
	const statusKey = active
		? 'taskbar.networkLinkActive'
		: 'taskbar.networkLinkInactive';
	const aria = `${t(kindLabelKey(snap.kind))}: ${t(statusKey)}`;

	return (
		<DesktopChromeTooltip
			content={
				<span className="flex max-w-[220px] flex-col gap-0.5 text-left text-xs">
					<span className="font-semibold text-(--desktop-text-primary)">
						{t(kindLabelKey(snap.kind))}
					</span>
					<span className="text-(--desktop-text-secondary)">
						{t(statusKey)}
					</span>
				</span>
			}
			placement="top"
			offsetExtra={12}
		>
			<m.button
				type="button"
				data-taskbar-interactive="true"
				data-testid="taskbar-network-link-chip"
				data-network-link-kind={snap.kind ?? 'unknown'}
				data-network-link-active={active ? '1' : '0'}
				aria-label={aria}
				className={cn(
					taskbarButtonSurface,
					'relative flex h-8 w-8 items-center justify-center rounded-md',
					finePointerHover && 'transition-colors'
				)}
				style={{ color }}
				animate={
					reduceMotion
						? undefined
						: {
								boxShadow: [`0 0 0 0 ${glow}`, `0 0 0 4px transparent`],
							}
				}
				transition={
					reduceMotion
						? undefined
						: { duration: active ? 2.6 : 1.4, repeat: Infinity }
				}
			>
				<LinkKindIcon kind={snap.kind} />
			</m.button>
		</DesktopChromeTooltip>
	);
});
