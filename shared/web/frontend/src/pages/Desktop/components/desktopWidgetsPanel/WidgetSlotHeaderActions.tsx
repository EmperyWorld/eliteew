/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Secondary «Open app» header actions after a live widget body.
 *
 * Invariants:
 * - Shown for slots that have a full app window; never replaces the live body.
 *
 * Related:
 * - FreeWidgetsPanelLayout.tsx
 * - StackedWidgetsPanelLayout.tsx
 */

import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import type { DesktopWidgetLayoutSlot } from '../../types/desktopExpansion.types';
import { DesktopAppButton } from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';

export function WidgetSlotHeaderActions({
	slot,
	onOpenEwDesk,
	onOpenMusicPlayer,
	onOpenWidgetSlotExpanded,
	shrink = false,
}: {
	slot: DesktopWidgetLayoutSlot;
	onOpenEwDesk: () => void;
	onOpenMusicPlayer: () => void;
	onOpenWidgetSlotExpanded?: (type: DesktopWidgetLayoutSlot['type']) => void;
	shrink?: boolean;
}) {
	const { t } = useTranslation('desktopUi');

	const pillClass = cn(
		DESKTOP_TYPOGRAPHY.sectionPill,
		'h-auto min-h-0 px-2 py-0.5',
		shrink && 'shrink-0'
	);

	if (slot.type === 'ewdesk') {
		return (
			<DesktopChromeTooltip
				content={t('settingsPanel.widgetsPanel.openApp')}
				placement="top"
				offsetExtra={4}
			>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					className={pillClass}
					onClick={onOpenEwDesk}
				>
					{t('settingsPanel.widgetsPanel.openApp')}
				</DesktopAppButton>
			</DesktopChromeTooltip>
		);
	}

	if (slot.type === 'now-playing') {
		return (
			<DesktopChromeTooltip
				content={t('settingsPanel.widgetsPanel.openApp')}
				placement="top"
				offsetExtra={4}
			>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					className={pillClass}
					onClick={onOpenMusicPlayer}
				>
					{t('settingsPanel.widgetsPanel.openApp')}
				</DesktopAppButton>
			</DesktopChromeTooltip>
		);
	}

	if (
		(slot.type === 'assistant-plan' || slot.type === 'agenda') &&
		onOpenWidgetSlotExpanded
	) {
		return (
			<DesktopChromeTooltip
				content={t('settingsPanel.widgetsPanel.openAssistant')}
				placement="top"
				offsetExtra={4}
			>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					className={pillClass}
					onClick={() => onOpenWidgetSlotExpanded(slot.type)}
				>
					{t('settingsPanel.widgetsPanel.openApp')}
				</DesktopAppButton>
			</DesktopChromeTooltip>
		);
	}

	return null;
}
