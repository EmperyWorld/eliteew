import {
	ClipboardDocumentIcon,
	PencilSquareIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import {
	DesktopAppContextMenuTitle,
	DesktopAppMenuDivider,
	DesktopAppMenuItem,
	DesktopAppMenuSurface,
} from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import type { MarketingJobStory } from '../marketingCabinetApi';

export interface JtbdContextMenuPortalProps {
	menuRef: RefObject<HTMLDivElement | null>;
	contextMenu: { job: MarketingJobStory } | null;
	menuPosition: { x: number; y: number } | null;
	allowMarketingWrite: boolean;
	onEditJob: (job: MarketingJobStory) => void;
	onCopyJob: (job: MarketingJobStory) => void;
	onRequestDeleteJob: (job: MarketingJobStory) => void;
	onCloseMenu: () => void;
}

export function JtbdContextMenuPortal({
	menuRef,
	contextMenu,
	menuPosition,
	allowMarketingWrite,
	onEditJob,
	onCopyJob,
	onRequestDeleteJob,
	onCloseMenu,
}: JtbdContextMenuPortalProps) {
	const { t } = useTranslation('marketing');
	const portalStackBase = useDesktopWindowPortalStackBase();

	if (typeof document === 'undefined' || !contextMenu || !menuPosition) {
		return null;
	}

	return createPortal(
		<div
			ref={menuRef}
			role="menu"
			aria-label={t('cabinetPage.jtbd.contextMenuAria')}
			className="fixed py-1 outline-none"
			style={{
				left: menuPosition.x,
				top: menuPosition.y,
				zIndex: portalStackBase,
			}}
			onContextMenu={(e) => e.preventDefault()}
		>
			<DesktopAppMenuSurface className="min-w-[220px] shadow-(--desktop-shadow-panel) ring-1 ring-(--desktop-border-menu)">
				<DesktopAppContextMenuTitle className="truncate">
					{contextMenu.job.title}
				</DesktopAppContextMenuTitle>
				{allowMarketingWrite ? (
					<DesktopAppMenuItem
						type="button"
						role="menuitem"
						icon={
							<PencilSquareIcon
								className={DESKTOP_LUCIDE.md}
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						}
						onClick={() => {
							onEditJob(contextMenu.job);
							onCloseMenu();
						}}
					>
						{t('cabinetPage.jtbd.contextEditJob')}
					</DesktopAppMenuItem>
				) : null}
				<DesktopAppMenuItem
					type="button"
					role="menuitem"
					icon={
						<ClipboardDocumentIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					}
					onClick={() => {
						void onCopyJob(contextMenu.job);
						onCloseMenu();
					}}
				>
					{t('cabinetPage.jtbd.contextCopyJob')}
				</DesktopAppMenuItem>
				{allowMarketingWrite ? (
					<>
						<DesktopAppMenuDivider />
						<DesktopAppMenuItem
							type="button"
							role="menuitem"
							tone="danger"
							icon={
								<TrashIcon
									className={DESKTOP_LUCIDE.md}
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							}
							onClick={() => {
								onRequestDeleteJob(contextMenu.job);
								onCloseMenu();
							}}
						>
							{t('cabinetPage.jtbd.contextDeleteJob')}
						</DesktopAppMenuItem>
					</>
				) : null}
			</DesktopAppMenuSurface>
		</div>,
		document.body
	);
}
