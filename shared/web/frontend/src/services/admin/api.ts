import { api, apiClient } from '../api';

export interface DocEditorAdminPlugin {
	id: string;
	name: string;
	description: string;
	version: string;
	author: string;
	category: string;
	rating: number;
	downloads: number;
	tags: string[];
	icon: string;
	permissions: string[];
	isOfficial: boolean;
	isGPUAccelerated: boolean;
	price: number | null;
	lastUpdated: string | null;
	isEnabled: boolean;
	sortOrder: number;
}

export interface DocEditorAdminPluginUpsertPayload {
	id?: string;
	name: string;
	description: string;
	version: string;
	author: string;
	category: string;
	rating: number;
	downloads: number;
	tags: string[];
	icon: string;
	permissions: string[];
	is_official: boolean;
	is_gpu_accelerated: boolean;
	price: number | null;
	is_enabled: boolean;
	sort_order: number;
}

export const adminApi = {
	async cleanupCache(): Promise<void> {
		await apiClient.post('/api/v1/cache/cleanup');
	},

	async listDocEditorPlugins(): Promise<DocEditorAdminPlugin[]> {
		const out = await apiClient.get<{ plugins?: DocEditorAdminPlugin[] }>(
			'/api/v1/doc-editor/plugins/admin'
		);
		return out.data?.plugins ?? [];
	},

	async createDocEditorPlugin(
		payload: DocEditorAdminPluginUpsertPayload
	): Promise<void> {
		await apiClient.post('/api/v1/doc-editor/plugins/admin', payload);
	},

	async updateDocEditorPlugin(
		pluginId: string,
		payload: Partial<DocEditorAdminPluginUpsertPayload>
	): Promise<void> {
		await apiClient.patch(
			`/api/v1/doc-editor/plugins/admin/${pluginId}`,
			payload
		);
	},

	async disableDocEditorPlugin(pluginId: string): Promise<void> {
		await apiClient.delete(`/api/v1/doc-editor/plugins/admin/${pluginId}`);
	},

	async enableDocEditorPlugin(pluginId: string): Promise<void> {
		await apiClient.post(`/api/v1/doc-editor/plugins/admin/${pluginId}/enable`);
	},

	async getSystemGafInstruction(locale = 'ru'): Promise<{
		locale: string;
		welcome_text: string;
		thanks_text: string;
		steps: unknown[];
		updated_at?: string | null;
		updated_by?: string | null;
	}> {
		const loc = encodeURIComponent(locale.trim() || 'ru');
		return api.get<{
			locale: string;
			welcome_text: string;
			thanks_text: string;
			steps: unknown[];
			updated_at?: string | null;
			updated_by?: string | null;
		}>(`/api/v1/desktop/admin/system-gaf/instruction?locale=${loc}`);
	},

	async putSystemGafInstruction(body: {
		locale?: string;
		welcome_text: string;
		thanks_text: string;
		steps: Array<{
			title: string;
			body: string;
			open_app_component?: string | null;
			button_label?: string | null;
		}>;
	}): Promise<void> {
		await api.put('/api/v1/desktop/admin/system-gaf/instruction', body);
	},

	async postSystemGafSendTest(
		locale = 'ru'
	): Promise<{ ok: boolean; message_id?: string }> {
		const loc = encodeURIComponent(locale.trim() || 'ru');
		return api.post<{ ok: boolean; message_id?: string }>(
			`/api/v1/desktop/admin/system-gaf/send-test?locale=${loc}`
		);
	},

	async postSystemGafSend(body: {
		user_id?: string;
		user_ids?: string[];
		use_template?: boolean;
		dry_run?: boolean;
		locale?: string;
	}): Promise<{
		sent: string[];
		skipped: string[];
		dry_run: boolean;
		locale?: string;
	}> {
		return api.post<{
			sent: string[];
			skipped: string[];
			dry_run: boolean;
		}>('/api/v1/desktop/admin/system-gaf/send', body);
	},

	async getSystemGafBroadcastPreview(): Promise<{ recipient_count: number }> {
		return api.get<{ recipient_count: number }>(
			'/api/v1/desktop/admin/system-gaf/broadcast-preview'
		);
	},

	async postSystemGafSendBroadcast(body: {
		confirm: string;
		locale?: string;
	}): Promise<{
		queued: boolean;
		task_id: string;
		confirm_phrase?: string;
		hint?: string;
	}> {
		return api.post<{
			queued: boolean;
			task_id: string;
			confirm_phrase?: string;
			hint?: string;
		}>('/api/v1/desktop/admin/system-gaf/send-broadcast', body);
	},

	async getPresenceOnline(): Promise<{
		redis_available: boolean;
		total: number;
		users: Array<{
			user_id: string;
			email?: string | null;
			display_name?: string | null;
			full_name?: string | null;
			username?: string | null;
			avatar_url?: string | null;
			role?: string | null;
			is_active?: boolean | null;
			last_login_at?: string | null;
			connected_at?: string | null;
			last_seen_at?: string | null;
			sessions: number;
		}>;
	}> {
		return api.get<{
			redis_available: boolean;
			total: number;
			users: Array<{
				user_id: string;
				email?: string | null;
				display_name?: string | null;
				full_name?: string | null;
				username?: string | null;
				avatar_url?: string | null;
				role?: string | null;
				is_active?: boolean | null;
				last_login_at?: string | null;
				connected_at?: string | null;
				last_seen_at?: string | null;
				sessions: number;
			}>;
		}>('/api/v1/desktop/admin/presence/online');
	},

	async postPresenceCommand(body: {
		user_id: string;
		action: 'logout' | 'reload';
	}): Promise<{ ok: boolean; delivered: number }> {
		return api.post<{ ok: boolean; delivered: number }>(
			'/api/v1/desktop/admin/presence/command',
			body
		);
	},

	async getUsersDirectory(params: {
		page?: number;
		per_page?: number;
		search?: string;
		role?: string;
		is_active?: boolean | null;
		is_trusted?: boolean | null;
		is_verified?: boolean | null;
		online_only?: boolean;
		/** UUID группы магазина; `__none__` — без группы */
		app_access_group_id?: string;
		presence_anomaly_only?: boolean;
		sso_browser_active_only?: boolean;
		sso_mobile_active_only?: boolean;
		sso_desktop_active_only?: boolean;
		sso_fofline_active_only?: boolean;
		channel_mismatch_only?: boolean;
		sort_by?: string;
		sort_dir?: 'asc' | 'desc';
	}): Promise<{
		redis_available: boolean;
		total: number;
		page: number;
		per_page: number;
		users: Array<{
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
		}>;
		summary?: {
			online_matching_total: number | null;
			presence_anomaly_matching_total: number | null;
			sso_browser_active_matching_total: number | null;
			sso_mobile_active_matching_total: number | null;
			sso_desktop_active_matching_total: number | null;
			sso_fofline_active_matching_total: number | null;
			channel_mismatch_matching_total: number | null;
		} | null;
	}> {
		const sp = new URLSearchParams();
		if (params.page != null) sp.set('page', String(params.page));
		if (params.per_page != null) sp.set('per_page', String(params.per_page));
		if (params.search?.trim()) sp.set('search', params.search.trim());
		if (params.role?.trim()) sp.set('role', params.role.trim());
		if (params.is_active === true) sp.set('is_active', 'true');
		if (params.is_active === false) sp.set('is_active', 'false');
		if (params.is_trusted === true) sp.set('is_trusted', 'true');
		if (params.is_trusted === false) sp.set('is_trusted', 'false');
		if (params.is_verified === true) sp.set('is_verified', 'true');
		if (params.is_verified === false) sp.set('is_verified', 'false');
		if (params.online_only === true) sp.set('online_only', 'true');
		if (params.app_access_group_id?.trim()) {
			sp.set('app_access_group_id', params.app_access_group_id.trim());
		}
		if (params.presence_anomaly_only === true) {
			sp.set('presence_anomaly_only', 'true');
		}
		if (params.sso_browser_active_only === true) {
			sp.set('sso_browser_active_only', 'true');
		}
		if (params.sso_mobile_active_only === true) {
			sp.set('sso_mobile_active_only', 'true');
		}
		if (params.sso_desktop_active_only === true) {
			sp.set('sso_desktop_active_only', 'true');
		}
		if (params.sso_fofline_active_only === true) {
			sp.set('sso_fofline_active_only', 'true');
		}
		if (params.channel_mismatch_only === true) {
			sp.set('channel_mismatch_only', 'true');
		}
		if (params.sort_by?.trim()) sp.set('sort_by', params.sort_by.trim());
		if (params.sort_dir === 'asc' || params.sort_dir === 'desc') {
			sp.set('sort_dir', params.sort_dir);
		}
		const q = sp.toString();
		return api.get(`/api/v1/desktop/admin/users/directory${q ? `?${q}` : ''}`);
	},

	async getUserSsoOverview(
		userId: string,
		historyLimit = 50
	): Promise<{
		user_id: string;
		sessions: Array<{
			client_class: 'browser' | 'mobile' | 'desktop';
			client_id: string;
			session_id: string;
			active: boolean;
			live?: boolean;
			first_seen_at?: string | null;
			last_seen_at?: string | null;
			ip_address?: string | null;
			user_agent?: string | null;
			replaced_at?: string | null;
			previous_session_id?: string | null;
		}>;
		history: Array<{
			event_type: string;
			client_class?: string | null;
			client_id?: string | null;
			session_id?: string | null;
			replaced_session_id?: string | null;
			ip_address?: string | null;
			user_agent?: string | null;
			details?: Record<string, unknown>;
			created_at?: string | null;
		}>;
	}> {
		const sp = new URLSearchParams();
		if (historyLimit > 0) sp.set('history_limit', String(historyLimit));
		const q = sp.toString();
		return api.get(
			`/api/v1/desktop/admin/users/${encodeURIComponent(userId)}/sso-overview${q ? `?${q}` : ''}`
		);
	},
};
