/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Parse GAF message metadata for admin-sent desktop app open buttons (`kind: desktop_app_link`).
 *
 * Invariants:
 * - Only structured metadata validated on the server is trusted for `open_app_component`.
 *
 * Related:
 * - api/gaf_chat/admin_desktop_app_link.py; GafChatDesktopAppLinkBlock.tsx
 */

export type GafDesktopAppLinkMeta = {
	kind: 'desktop_app_link';
	app_id: string;
	app_name: string;
	open_app_component: string;
	button_label: string;
};

export function getGafDesktopAppLinkMeta(
	metadata: unknown
): GafDesktopAppLinkMeta | null {
	if (!metadata || typeof metadata !== 'object') return null;
	const m = metadata as Record<string, unknown>;
	if (m.kind !== 'desktop_app_link') return null;
	const component = String(m.open_app_component ?? '').trim();
	if (!component) return null;
	const appId = String(m.app_id ?? '').trim();
	const appName = String(m.app_name ?? '').trim();
	const label = String(m.button_label ?? appName ?? component).trim();
	return {
		kind: 'desktop_app_link',
		app_id: appId,
		app_name: appName || component,
		open_app_component: component,
		button_label: label || component,
	};
}
