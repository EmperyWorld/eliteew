/**
 * EWDesk news: template ids and markdown helpers (same link scheme as Assistant).
 */
import { ASSISTANT_DESKTOP_LINK_PATH_PREFIX } from '../Desktop/utils/assistantDesktopLinkComponents';

export const EW_DESK_NEWS_TEMPLATE_IDS = [
	'blank',
	'announcement',
	'feature_list',
	'apps_update',
] as const;

export type EwDeskNewsTemplateId = (typeof EW_DESK_NEWS_TEMPLATE_IDS)[number];

export function markdownDesktopAppLink(
	appComponent: string,
	label: string
): string {
	return `[${label}](${ASSISTANT_DESKTOP_LINK_PATH_PREFIX}${appComponent})`;
}
