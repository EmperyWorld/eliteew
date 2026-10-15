/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Footer toolbar for Notification Hub (mark all read, export, clear all).
 *
 * Invariants:
 * - Export JSON only in window density; clear confirm opens parent modal.
 *
 * Related:
 * - NotificationHubBody.tsx, NotificationHubClearConfirm.tsx
 */

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '../../constants';
import { DesktopAppButton, DesktopAppToolbar } from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import {
	NH_FOOTER_TOOLBAR_CLASS,
	nhToolbarButtonClass,
} from './notificationHubLayoutTokens';
import {
	ArrowDownTrayIcon,
	CheckIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';

export type NotificationHubFooterToolbarProps = {
	density: 'panel' | 'window';
	onMarkAllAsRead: () => void;
	onExportJson?: () => void;
	onRequestClearConfirm: () => void;
};

export const NotificationHubFooterToolbar: React.FC<NotificationHubFooterToolbarProps> =
	memo(({ density, onMarkAllAsRead, onExportJson, onRequestClearConfirm }) => {
		const { t } = useTranslation('desktopUi', {
			keyPrefix: 'notificationHub',
		});

		return (
			<DesktopAppToolbar
				className={NH_FOOTER_TOOLBAR_CLASS}
				{...(density === 'window' ? { 'data-nc-guide': 'footer' } : {})}
			>
				<DesktopChromeTooltip
					content={t('markAllRead')}
					placement="top"
					offsetExtra={4}
				>
					<DesktopAppButton
						variant="neutral"
						size="md"
						onClick={onMarkAllAsRead}
						className={nhToolbarButtonClass(DESKTOP_TYPOGRAPHY.body)}
					>
						<CheckIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
						{t('markAllRead')}
					</DesktopAppButton>
				</DesktopChromeTooltip>
				{density === 'window' && onExportJson ? (
					<DesktopChromeTooltip
						content={t('exportJson')}
						placement="top"
						offsetExtra={4}
					>
						<DesktopAppButton
							variant="neutral"
							size="md"
							onClick={onExportJson}
							className={nhToolbarButtonClass(DESKTOP_TYPOGRAPHY.body)}
							aria-label={t('exportJsonAria')}
						>
							<ArrowDownTrayIcon
								className={DESKTOP_LUCIDE.md}
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
							{t('exportJson')}
						</DesktopAppButton>
					</DesktopChromeTooltip>
				) : null}
				<DesktopChromeTooltip
					content={t('clearAll')}
					placement="top"
					offsetExtra={4}
				>
					<DesktopAppButton
						variant="danger"
						size="md"
						onClick={onRequestClearConfirm}
						className={nhToolbarButtonClass(DESKTOP_TYPOGRAPHY.shellCopy13)}
					>
						<TrashIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
						{t('clearAll')}
					</DesktopAppButton>
				</DesktopChromeTooltip>
			</DesktopAppToolbar>
		);
	});

NotificationHubFooterToolbar.displayName = 'NotificationHubFooterToolbar';
