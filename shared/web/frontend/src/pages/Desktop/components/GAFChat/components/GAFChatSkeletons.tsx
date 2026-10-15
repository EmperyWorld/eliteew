import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppSkeleton,
	DesktopAppToolbar,
} from '../../DesktopAppChrome';
import { useDesktopShellFrame } from '../../../context/DesktopShellFrameContext';
import {
	getDesktopShellHeaderStripClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '../../../utils/desktopVisualSystem';
import { DESKTOP_TYPOGRAPHY } from '../../../constants';

/**
 * Header-region skeletons mirror `GAFChatApp.tsx` chrome (main toolbar, sidebar search, partner strip).
 * Keep padding / avatar sizes in sync when editing the live headers.
 */

const SIDEBAR_SKELETON_IDS = [
	'sb1',
	'sb2',
	'sb3',
	'sb4',
	'sb5',
	'sb6',
] as const;

/** Narrow list column on app surface — soft opacity sweep (see `.ew-skeleton-pulse` in global styles). */
const sidebarSkeletonMotion =
	'ew-skeleton-pulse motion-reduce:animate-none motion-reduce:opacity-80';

/** Message pane on panel surface — standard pulse; pairs with `DesktopAppSkeleton` default animation. */
const messageSkeletonMotion =
	'motion-reduce:animate-none motion-reduce:opacity-80 animate-pulse';

/** Matches `GAFChatApp` root `<DesktopAppToolbar>` (title block + action cluster). */
export const GAFChatMainToolbarSkeleton: React.FC = () => {
	const shellFrame = useDesktopShellFrame();
	return (
		<DesktopAppToolbar
			className={cn(
				getDesktopShellHeaderStripClassName(shellFrame),
				'pointer-events-none flex min-w-0 items-center justify-between gap-3 px-3 py-2'
			)}
			aria-hidden
			data-testid="gaf-chat-main-toolbar-skeleton"
		>
			<div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
				<div
					className={cn(
						'h-5 w-5 shrink-0 rounded bg-(--desktop-surface-soft)',
						sidebarSkeletonMotion
					)}
				/>
				<div className="min-w-0 space-y-1">
					<div
						className={cn(
							'h-4 max-w-[220px] rounded bg-(--desktop-surface-soft)',
							sidebarSkeletonMotion
						)}
					/>
					<div
						className={cn(
							'h-2.5 max-w-[280px] rounded bg-(--desktop-surface-soft)/75',
							sidebarSkeletonMotion
						)}
					/>
				</div>
			</div>
			<div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
				<div
					className={cn(
						'h-7 min-w-34 rounded-(--desktop-radius) bg-(--desktop-surface-soft)/80',
						sidebarSkeletonMotion
					)}
				/>
				<div
					className={cn(
						'h-9 w-9 shrink-0 rounded-(--desktop-radius) bg-(--desktop-surface-soft)',
						sidebarSkeletonMotion
					)}
				/>
				<div
					className={cn(
						'h-8 min-w-17 rounded-(--desktop-radius) bg-(--desktop-surface-soft)/80',
						sidebarSkeletonMotion
					)}
				/>
				<div
					className={cn(
						'h-8 min-w-15 rounded-(--desktop-radius) bg-(--desktop-surface-soft)/80',
						sidebarSkeletonMotion
					)}
				/>
				<div
					className={cn(
						'h-8 min-w-18 rounded-(--desktop-radius) bg-(--desktop-surface-soft)/80',
						sidebarSkeletonMotion
					)}
				/>
				<div
					className={cn(
						'h-9 min-w-25 rounded-(--desktop-radius) bg-(--desktop-surface-soft)',
						sidebarSkeletonMotion
					)}
				/>
			</div>
		</DesktopAppToolbar>
	);
};

/** Matches sidebar search strip: icon + `DesktopAppInput` with `py-2`. */
export const GAFChatSidebarSearchSkeleton: React.FC = () => {
	const shellFrame = useDesktopShellFrame();
	return (
		<div
			className={cn(
				'flex items-center gap-2 p-2',
				getDesktopShellHeaderStripClassName(shellFrame)
			)}
			aria-hidden
			data-testid="gaf-chat-sidebar-search-skeleton"
		>
			<div
				className={cn(
					'h-4 w-4 shrink-0 rounded bg-(--desktop-surface-soft)',
					sidebarSkeletonMotion
				)}
			/>
			<div
				className={cn(
					'min-h-9 flex-1 rounded-(--desktop-radius) border border-transparent bg-(--desktop-surface-soft)/90 py-2',
					sidebarSkeletonMotion
				)}
			/>
		</div>
	);
};

/** Matches partner strip: `DesktopAppToolbar` + avatar row + in-thread search (`sm:min-w-[220px]`). */
export const GAFChatPartnerToolbarSkeleton: React.FC = () => {
	const shellFrame = useDesktopShellFrame();
	return (
		<DesktopAppToolbar
			className={cn(
				'pointer-events-none shrink-0 flex-col items-stretch gap-3 px-3 py-3 sm:flex-row sm:items-center sm:px-4',
				getDesktopShellHeaderStripClassName(shellFrame)
			)}
			aria-hidden
			data-testid="gaf-chat-partner-toolbar-skeleton"
		>
			<div className="flex min-w-0 flex-1 items-center gap-3">
				<div
					className={cn(
						'h-9 w-9 shrink-0 rounded-full bg-(--desktop-surface-soft)',
						sidebarSkeletonMotion
					)}
				/>
				<div className="min-w-0 flex-1 space-y-1.5">
					<div
						className={cn(
							'h-4 max-w-[min(55%,14rem)] rounded bg-(--desktop-surface-soft)',
							sidebarSkeletonMotion
						)}
					/>
					<div
						className={cn(
							'h-3 max-w-[min(85%,22rem)] rounded bg-(--desktop-surface-soft)/80',
							sidebarSkeletonMotion
						)}
					/>
					<div className="mt-0.5 flex flex-wrap gap-2">
						<div
							className={cn(
								'h-5 min-w-28 rounded-full bg-(--desktop-surface-soft)/70',
								sidebarSkeletonMotion
							)}
						/>
					</div>
				</div>
			</div>
			<div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto sm:max-w-md sm:flex-none">
				<div
					className={cn(
						'flex min-h-10 w-full items-center gap-2 rounded-(--desktop-radius) px-2 py-1 sm:min-w-[220px]',
						getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
						sidebarSkeletonMotion
					)}
				>
					<div
						className={cn(
							'h-4 w-4 shrink-0 rounded bg-(--desktop-surface-soft)/80',
							sidebarSkeletonMotion
						)}
					/>
					<div
						className={cn(
							'min-h-9 min-w-0 flex-1 rounded-(--desktop-radius) bg-(--desktop-surface-soft)/65',
							sidebarSkeletonMotion
						)}
					/>
				</div>
			</div>
		</DesktopAppToolbar>
	);
};

/** Single chat row — mirrors GAFChatSidebarRow (DesktopAppListRow + inner flex + badge slot) */
const SidebarRowSkeleton: React.FC<{
	id: (typeof SIDEBAR_SKELETON_IDS)[number];
}> = ({ id }) => (
	<div
		className={cn(
			DESKTOP_APP_STYLE_CONTRACT.listRow,
			'pointer-events-none rounded-none border-b border-(--desktop-border-subtle)'
		)}
		aria-hidden
		data-testid={`gaf-chat-sidebar-row-skeleton-${id}`}
	>
		<div className="flex w-full items-center gap-3">
			<div
				className={cn(
					'h-10 w-10 shrink-0 rounded-full bg-(--desktop-surface-soft)',
					sidebarSkeletonMotion
				)}
			/>
			<div className="min-w-0 flex-1">
				<div
					className={cn(
						'h-4 max-w-[72%] rounded bg-(--desktop-surface-soft)',
						sidebarSkeletonMotion
					)}
				/>
				<div
					className={cn(
						'mt-0.5 h-3 max-w-[55%] rounded bg-(--desktop-surface-soft)/80',
						sidebarSkeletonMotion
					)}
				/>
			</div>
			<div
				className={cn(
					DESKTOP_APP_STYLE_CONTRACT.counterBadge,
					'hidden h-5 min-w-[22px] shrink-0 border-transparent bg-(--desktop-surface-soft)/70 px-2 py-0.5 sm:inline-flex',
					sidebarSkeletonMotion
				)}
			/>
		</div>
	</div>
);

export const GAFChatSidebarSkeleton: React.FC = () => {
	const { t } = useTranslation('gafChat');
	const label = t('skeletonSidebarAria');
	const busy = t('skeletonSidebarBusy');
	return (
		<div
			className="flex min-h-[220px] flex-1 flex-col"
			role="status"
			aria-busy="true"
			aria-live="polite"
			aria-label={label}
			aria-relevant="additions text"
			data-testid="gaf-chat-sidebar-skeleton"
		>
			<span className="sr-only">{busy}</span>
			{SIDEBAR_SKELETON_IDS.map((sid) => (
				<SidebarRowSkeleton key={sid} id={sid} />
			))}
		</div>
	);
};

/** Same shell as live date pill: `counterBadge` + `px-2.5 py-1` (`GAFChatApp` message groups). */
const dateBadgeSkeletonClass = cn(
	DESKTOP_APP_STYLE_CONTRACT.counterBadge,
	'min-w-[5.5rem] border-transparent bg-(--desktop-surface-soft) px-2.5 py-1',
	'motion-reduce:animate-none motion-reduce:opacity-80'
);

/** Partner bubble (left column) — matches GAFChatMessageBubble partner lane + avatar notch */
const PartnerBubbleSkeleton: React.FC = () => (
	<div className="flex items-end justify-end">
		<div className="relative max-w-full">
			<div
				className={cn(
					'pointer-events-none absolute -right-4 -top-4 h-8 w-8 overflow-hidden rounded-full border border-(--desktop-border-strong) bg-(--desktop-surface-app) shadow-sm',
					messageSkeletonMotion
				)}
				aria-hidden
			/>
			<DesktopAppSkeleton
				className={cn(
					'relative min-w-36 max-w-full rounded-2xl rounded-bl-sm border border-(--desktop-border-strong)',
					'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_90%,transparent)] px-4 py-2.5',
					DESKTOP_TYPOGRAPHY.shellCopy15,
					'shadow-(--desktop-shadow-soft) backdrop-blur-md',
					'motion-reduce:animate-none motion-reduce:opacity-80'
				)}
				aria-hidden
			>
				<div className="space-y-2">
					<div className="h-3.5 w-[88%] max-w-[220px] rounded bg-(--desktop-text-primary)/10 motion-reduce:opacity-80" />
					<div className="h-3.5 w-[64%] max-w-[180px] rounded bg-(--desktop-text-primary)/10 motion-reduce:opacity-80" />
					<div className="mt-1.5 flex items-center justify-between gap-2">
						<div className="h-2.5 w-10 rounded bg-(--desktop-text-dim)/25 motion-reduce:opacity-80" />
						<div className="h-2.5 w-6 rounded bg-(--desktop-text-dim)/15 motion-reduce:opacity-80" />
					</div>
				</div>
			</DesktopAppSkeleton>
		</div>
	</div>
);

/** Own message bubble (right column) — matches accent lane + bottom-left avatar notch */
const OwnBubbleSkeleton: React.FC = () => (
	<div className="flex items-end justify-start">
		<div className="relative max-w-full">
			<div
				className={cn(
					'pointer-events-none absolute -bottom-4 -left-4 h-8 w-8 overflow-hidden rounded-full border border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-(--desktop-surface-app) shadow-sm',
					messageSkeletonMotion
				)}
				aria-hidden
			/>
			<DesktopAppSkeleton
				className={cn(
					'relative min-w-36 max-w-full rounded-2xl rounded-br-sm',
					'border border-[rgb(var(--desktop-accent-rgb)/0.38)]',
					'bg-[color-mix(in_srgb,var(--desktop-surface-panel-strong)_92%,transparent)] px-4 py-2.5',
					DESKTOP_TYPOGRAPHY.shellCopy15,
					'shadow-[0_2px_20px_rgba(var(--desktop-accent-rgb),0.14)] backdrop-blur-md',
					'motion-reduce:animate-none motion-reduce:opacity-80'
				)}
				aria-hidden
			>
				<div className="space-y-2">
					<div className="h-3.5 w-[78%] max-w-[200px] rounded bg-(--desktop-text-primary)/12 motion-reduce:opacity-80" />
					<div className="h-3.5 w-[52%] max-w-[140px] rounded bg-(--desktop-text-primary)/10 motion-reduce:opacity-80" />
					<div className="mt-1.5 flex items-center justify-between gap-2">
						<div className="h-2.5 w-10 rounded bg-(--desktop-text-dim)/25 motion-reduce:opacity-80" />
						<div className="h-2.5 w-6 rounded bg-(--desktop-text-dim)/20 motion-reduce:opacity-80" />
					</div>
				</div>
			</DesktopAppSkeleton>
		</div>
	</div>
);

const MESSAGE_GROUP_KEYS = ['g1', 'g2'] as const;

const MessageGroupSkeleton: React.FC<{
	groupKey: (typeof MESSAGE_GROUP_KEYS)[number];
}> = ({ groupKey }) => (
	<div
		className="space-y-5"
		data-testid={`gaf-chat-message-group-skeleton-${groupKey}`}
	>
		<div className="flex justify-center">
			<DesktopAppSkeleton
				className={dateBadgeSkeletonClass}
				aria-hidden
				data-testid={`gaf-chat-date-badge-skeleton-${groupKey}`}
			/>
		</div>
		<div className="space-y-5">
			<div className="py-2">
				<div className="flex justify-center">
					<div className="grid w-full max-w-6xl grid-cols-2 gap-x-6">
						<PartnerBubbleSkeleton />
						<div />
					</div>
				</div>
			</div>
			<div className="py-2">
				<div className="flex justify-center">
					<div className="grid w-full max-w-6xl grid-cols-2 gap-x-6">
						<div />
						<OwnBubbleSkeleton />
					</div>
				</div>
			</div>
		</div>
	</div>
);

export const GAFChatMessagesSkeleton: React.FC = () => {
	const { t } = useTranslation('gafChat');
	const label = t('skeletonMessagesAria');
	const busy = t('skeletonMessagesBusy');
	return (
		<div
			className="w-full min-w-0 space-y-7"
			role="status"
			aria-busy="true"
			aria-live="polite"
			aria-label={label}
			aria-relevant="additions text"
			data-testid="gaf-chat-messages-skeleton"
		>
			<span className="sr-only">{busy}</span>
			{MESSAGE_GROUP_KEYS.map((key) => (
				<MessageGroupSkeleton key={key} groupKey={key} />
			))}
		</div>
	);
};
