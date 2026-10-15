import { apiClient, adminApiClient } from '@services/api/client';
import { getSiteStudioAdminSessionPostPath } from '@services/api/siteStudioProxy';
import { clearAdminToken, setAdminToken } from '@services/api/authStorage';
import { create } from 'zustand';

interface AdminUser {
	id: string;
	email: string;
	name: string;
	role: string;
}

interface AdminMePayload {
	id: string;
	email: string;
	name?: string;
	role: string;
}

interface AdminState {
	adminUser: AdminUser | null;
	isAuthenticated: boolean;
	sessionChecked: boolean;
	login: (
		_password: string,
		options?: { forceRefresh?: boolean }
	) => Promise<boolean>;
	logout: () => void;
	ensureSession: (force?: boolean) => Promise<void>;
	changePassword: (
		currentPassword: string,
		newPassword: string
	) => Promise<boolean>;
}

const PROXY_SESSION_TOKEN = 'site-studio-proxy-session';
let pendingAdminConnection: Promise<AdminUser> | null = null;

function mapAdminUser(data: AdminMePayload): AdminUser {
	return {
		id: data.id,
		email: data.email,
		name: data.name || 'Site Admin',
		role: data.role,
	};
}

async function fetchAdminProfile(): Promise<AdminUser> {
	setAdminToken(PROXY_SESSION_TOKEN);
	const { data } = await adminApiClient.get('/auth/me');
	return mapAdminUser(data);
}

async function connectAdminSession(options?: {
	forceRefresh?: boolean;
}): Promise<AdminUser> {
	if (pendingAdminConnection) {
		return pendingAdminConnection;
	}

	pendingAdminConnection = (async () => {
		if (options?.forceRefresh) {
			await apiClient.post(getSiteStudioAdminSessionPostPath());
			return await fetchAdminProfile();
		}
		try {
			return await fetchAdminProfile();
		} catch {
			await apiClient.post(getSiteStudioAdminSessionPostPath());
			return await fetchAdminProfile();
		}
	})();

	try {
		return await pendingAdminConnection;
	} finally {
		pendingAdminConnection = null;
	}
}

export const useAdminStore = create<AdminState>()((set, get) => ({
	adminUser: null,
	isAuthenticated: false,
	sessionChecked: false,

	login: async (_password, options) => {
		try {
			const adminUser = await connectAdminSession(
				options?.forceRefresh ? { forceRefresh: true } : undefined
			);
			set({ adminUser, isAuthenticated: true, sessionChecked: true });
			return true;
		} catch {
			clearAdminToken();
			set({ adminUser: null, isAuthenticated: false, sessionChecked: true });
			return false;
		}
	},

	logout: () => {
		clearAdminToken();
		set({ adminUser: null, isAuthenticated: false, sessionChecked: true });
	},

	ensureSession: async (force = false) => {
		const state = get();
		// Без force: не дергать сеть, если уже проверили и залогинены.
		// Если sessionChecked, но не залогинены — нужно переподключение (иначе экран «Подключить снова» бесполезен).
		if (state.sessionChecked && !force && state.isAuthenticated) {
			return;
		}
		try {
			const adminUser = await connectAdminSession();
			set({ adminUser, isAuthenticated: true, sessionChecked: true });
		} catch {
			clearAdminToken();
			set({ adminUser: null, isAuthenticated: false, sessionChecked: true });
		}
	},

	changePassword: async (currentPassword: string, newPassword: string) => {
		try {
			await adminApiClient.post('/auth/change-password', {
				currentPassword,
				newPassword,
			});
			setAdminToken(PROXY_SESSION_TOKEN);
			return true;
		} catch {
			return false;
		}
	},
}));
