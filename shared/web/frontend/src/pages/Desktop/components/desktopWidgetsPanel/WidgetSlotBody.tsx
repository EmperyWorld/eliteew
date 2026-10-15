/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Renders widget slot inner body by slot type with live content (never a placeholder).
 *
 * Invariants:
 * - Density is compact vs roomy, never expanded-as-open-app-only.
 * - Plan/agenda use companion-plans projection, not widget-todos.
 * - Heavy apps (EWDesk) open via deep link or callback, not inline embed.
 *
 * Related:
 * - DesktopWidgetsPanel.tsx
 * - documentation/product/desktop/DESKTOP-WIDGETS-AND-AGENDA.md
 */

import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import type { DesktopAssistantPlanProjection } from '../../hooks/useDesktopAssistantPlanProjection';
import type { DesktopWidgetLayoutSlot } from '../../types/desktopExpansion.types';
import { requestOpenDesktopApp } from '../../utils/desktopDeepLink';
import { DashboardFavoritesSlotBody } from '../DashboardFavoritesSlotBody';
import { DesktopAppButton } from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { EwDeskWidgetPreview } from '../ewDesk/EwDeskWidgetPreview';
import { slotEffectiveCompact } from './constants';
import { AgendaSlotBody } from './AgendaSlotBody';
import { AssistantPlanSlotBody } from './AssistantPlanSlotBody';
import { NotesSlotBody } from './NotesSlotBody';
import { PanelNowPlaying } from './PanelNowPlaying';
import { ProjectShortcutsSlotBody } from './ProjectShortcutsSlotBody';
import { RecentContentSlotBody } from './RecentContentSlotBody';
import { TodosSlotBody } from './TodosSlotBody';
import type { DesktopWidgetsPanelProps } from './types';

type WidgetSlotBodyProps = Pick<
	DesktopWidgetsPanelProps,
	| 'compactWidgetsGlobal'
	| 'appCollections'
	| 'contentShortcuts'
	| 'recentOpened'
	| 'desktopUnreadCount'
	| 'markAllAsRead'
	| 'onOpenNotificationCenter'
	| 'onOpenEwDesk'
	| 'onOpenMusicPlayer'
	| 'onOpenContentShortcut'
	| 'onOpenAppCollection'
	| 'onOpenRecentFile'
	| 'onOpenWidgetSlotExpanded'
> & {
	assistantPlan: DesktopAssistantPlanProjection;
};

export function WidgetSlotBody({
	slot,
	...props
}: WidgetSlotBodyProps & { slot: DesktopWidgetLayoutSlot }) {
	const { t } = useTranslation('desktopUi');
	const compact = slotEffectiveCompact(slot, props.compactWidgetsGlobal);
	const openExpanded = props.onOpenWidgetSlotExpanded;

	return (
		<div className="flex flex-col gap-2">
			{slot.type === 'assistant-plan' ? (
				<AssistantPlanSlotBody
					compact={compact}
					projection={props.assistantPlan}
					onOpenAssistant={() => openExpanded?.('assistant-plan')}
				/>
			) : null}
			{slot.type === 'agenda' ? (
				<AgendaSlotBody
					compact={compact}
					projection={props.assistantPlan}
					onOpenAssistant={() => openExpanded?.('agenda')}
				/>
			) : null}
			{slot.type === 'notes' ? <NotesSlotBody compact={compact} /> : null}
			{slot.type === 'todos' ? <TodosSlotBody compact={compact} /> : null}
			{slot.type === 'favorites' ? (
				<DashboardFavoritesSlotBody compact={compact} />
			) : null}
			{slot.type === 'ewdesk' ? (
				<EwDeskWidgetPreview
					compact={compact}
					onOpenEwDesk={props.onOpenEwDesk}
					onOpenPost={(postId) => {
						requestOpenDesktopApp({
							appComponent: 'EWDeskApp',
							initialPayload: { ewDeskNewsId: postId },
						});
					}}
				/>
			) : null}
			{slot.type === 'notifications' ? (
				<div className="flex flex-col gap-2">
					<p className={DESKTOP_TYPOGRAPHY.caption}>
						{t('settingsPanel.widgetsPanel.notificationsSummary', {
							count: props.desktopUnreadCount,
						})}
					</p>
					<div className="flex flex-wrap gap-2">
						<DesktopChromeTooltip
							content={t('settingsPanel.widgetsPanel.openCenter')}
							placement="top"
							offsetExtra={4}
						>
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								onClick={props.onOpenNotificationCenter}
							>
								{t('settingsPanel.widgetsPanel.openCenter')}
							</DesktopAppButton>
						</DesktopChromeTooltip>
						{props.desktopUnreadCount > 0 ? (
							<DesktopChromeTooltip
								content={t('settingsPanel.widgetsPanel.markAllRead')}
								placement="top"
								offsetExtra={4}
							>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="sm"
									onClick={props.markAllAsRead}
								>
									{t('settingsPanel.widgetsPanel.markAllRead')}
								</DesktopAppButton>
							</DesktopChromeTooltip>
						) : null}
					</div>
				</div>
			) : null}
			{slot.type === 'now-playing' ? (
				<PanelNowPlaying
					compact={compact}
					onOpenMusicPlayer={props.onOpenMusicPlayer}
				/>
			) : null}
			{slot.type === 'project-shortcuts' ? (
				<ProjectShortcutsSlotBody
					compact={compact}
					appCollections={props.appCollections}
					contentShortcuts={props.contentShortcuts}
					onOpenContentShortcut={props.onOpenContentShortcut}
					onOpenAppCollection={props.onOpenAppCollection}
				/>
			) : null}
			{slot.type === 'recent-content' ? (
				<RecentContentSlotBody
					compact={compact}
					recentOpened={props.recentOpened}
					onOpenRecentFile={props.onOpenRecentFile}
				/>
			) : null}
		</div>
	);
}
