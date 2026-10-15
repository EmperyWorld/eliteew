/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared admin directory user row contract used by the Users hub, detail panel,
 * CSV export, and diagnostic report helpers.
 *
 * Invariants:
 * - Presence fields describe Socket.IO channel state; SSO fields describe
 *   Keycloak registry state and must remain distinct.
 *
 * Related:
 * - AdminUserDetailPanel.tsx
 * - AdminUsersHubSection.tsx
 * ---
 */

export type AdminDirectoryUserRow = {
	id: string;
	username: string;
	email: string;
	role: string;
	full_name?: string | null;
	avatar_url?: string | null;
	is_active: boolean;
	is_verified: boolean;
	is_trusted: boolean;
	created_at: string;
	updated_at?: string | null;
	last_login_at?: string | null;
	login_count: number;
	ugs_credits: number;
	ew_balance: number;
	app_access_group_id?: string | null;
	app_access_group_name?: string | null;
	presence_online: boolean;
	presence_sessions: number;
	presence_sessions_web?: number;
	presence_sessions_mobile?: number;
	presence_connected_at?: string | null;
	presence_last_seen_at?: string | null;
	sso_browser_active?: boolean;
	sso_mobile_active?: boolean;
	sso_desktop_active?: boolean;
	sso_fofline_active?: boolean;
	sso_browser_live?: boolean;
	sso_mobile_live?: boolean;
	sso_desktop_live?: boolean;
	sso_fofline_live?: boolean;
	sso_browser_client_id?: string | null;
	sso_mobile_client_id?: string | null;
	sso_desktop_client_id?: string | null;
	sso_fofline_client_id?: string | null;
	sso_browser_last_seen_at?: string | null;
	sso_mobile_last_seen_at?: string | null;
	sso_desktop_last_seen_at?: string | null;
	sso_fofline_last_seen_at?: string | null;
	sso_browser_ip?: string | null;
	sso_mobile_ip?: string | null;
	sso_desktop_ip?: string | null;
	sso_fofline_ip?: string | null;
	sso_browser_user_agent?: string | null;
	sso_mobile_user_agent?: string | null;
	sso_desktop_user_agent?: string | null;
	sso_fofline_user_agent?: string | null;
	desktop_license_id?: string | null;
	desktop_license_label?: string | null;
	desktop_license_mode?: string | null;
	desktop_license_status?: string | null;
	desktop_peer_slug?: string | null;
	desktop_peer_status?: string | null;
	desktop_peer_assigned_ip?: string | null;
	desktop_app_version?: string | null;
	desktop_wg_up?: boolean | null;
	desktop_build_channel?: string | null;
	desktop_updater_pubkey_baked?: boolean | null;
	desktop_report_ip?: string | null;
	desktop_reported_at?: string | null;
};
