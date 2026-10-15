/**
 * Profile API Service – all API calls for user profile management.
 * No built-in loading/error state; callers must add UI (e.g. useQuery or local loading/error state).
 */

import type {
	ActiveSession,
	ActivityLogResponse,
	AvatarHistoryItem,
	AvatarUploadResponse,
	DataExportRequest,
	DataExportResponse,
	Enable2FAResponse,
	ExtendedSecuritySettings,
	Language,
	PasswordChangeData,
	ProfilePrivacySettings,
	ProfilePrivacyUpdate,
	ProfileUpdateData,
	SecurityEvent,
	SecuritySettings,
	UserPreferences,
	UserPreferencesUpdate,
	UserProfileResponse,
	UserSessionInfo,
	UserStatistics,
} from '../types/profile';
import { apiClient, unwrapApiData } from './api/client';
import { API_PATHS } from './api/config';
import type { NotificationCenterApiItem } from '@/notifications/notificationCenterMerge';

const API_BASE = API_PATHS.PROFILE;

export type { NotificationCenterApiItem } from '@/notifications/notificationCenterMerge';

export interface NotificationCenterGetResponse {
	items: NotificationCenterApiItem[];
	updated_at: string | null;
	dismissed_ids: string[];
}

/** React Query key for GET /profile/me — AuthContext и кэш профиля. */
export const PROFILE_ME_QUERY_KEY = ['profile', 'me'] as const;

/** React Query key for GET /profile/preferences. */
export const PROFILE_PREFERENCES_QUERY_KEY = [
	'profile',
	'preferences',
] as const;

/** React Query key for GET /profile/notification-center. */
export const PROFILE_NOTIFICATION_CENTER_QUERY_KEY = [
	'profile',
	'notification-center',
] as const;

function asProfileRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object') {
		return null;
	}
	return value as Record<string, unknown>;
}

function readOptionalString(value: unknown): string | null {
	if (value == null) {
		return null;
	}
	return typeof value === 'string' ? value : String(value);
}

function normalizeUserProfilePayload(raw: unknown): UserProfileResponse {
	let payload = asProfileRecord(unwrapApiData(raw)) ?? {};
	// Прокси/обёртка без флага success: { data: { full_name, ... } }
	if (
		'data' in payload &&
		payload.data &&
		typeof payload.data === 'object' &&
		!('full_name' in payload) &&
		!('username' in payload)
	) {
		const inner = asProfileRecord(payload.data);
		if (
			inner &&
			('full_name' in inner || 'fullName' in inner || 'email' in inner)
		) {
			payload = inner;
		}
	}
	const full =
		readOptionalString(payload.full_name) ??
		readOptionalString(payload.fullName);
	const preferences = asProfileRecord(payload.preferences) ?? {};
	return {
		id: String(payload.id ?? ''),
		username: String(payload.username ?? ''),
		email: String(payload.email ?? ''),
		full_name: full,
		bio: readOptionalString(payload.bio),
		avatar_url: readOptionalString(payload.avatar_url),
		role: String(payload.role ?? ''),
		is_active: Boolean(payload.is_active),
		is_verified: Boolean(payload.is_verified),
		...(payload.is_trusted == null
			? {}
			: { is_trusted: Boolean(payload.is_trusted) }),
		...(payload.admin_badge_label === undefined
			? {}
			: { admin_badge_label: readOptionalString(payload.admin_badge_label) }),
		...(payload.admin_badge_hint === undefined
			? {}
			: { admin_badge_hint: readOptionalString(payload.admin_badge_hint) }),
		preferences,
		created_at: String(payload.created_at ?? ''),
		last_login_at: readOptionalString(payload.last_login_at),
		login_count: Number(payload.login_count ?? 0) || 0,
	};
}

/** Backend returns 404 when the user has no avatar — not an error for the UI. */
const EMPTY_AVATAR_INFO: AvatarUploadResponse = {
	avatar_url: '',
	file_size: 0,
	mime_type: 'application/octet-stream',
	created_at: '1970-01-01T00:00:00.000Z',
	content_id: null,
	thumbnail_256_url: null,
	thumbnail_64_url: null,
};

/** In-memory cache so many <SecureAvatar useProfileApi /> mounts share one GET /profile/avatar. */
let avatarInfoCache: AvatarUploadResponse | null = null;
let avatarInfoInflight: Promise<AvatarUploadResponse> | null = null;

/** Shared object URLs for protected avatar downloads (dedupe across message list rows). */
const avatarBlobObjectUrlByPath = new Map<string, string>();
const avatarBlobInflight = new Map<string, Promise<string>>();

/**
 * Fetch blob once per download path; reuse object URL for all SecureAvatar instances.
 */
export async function getAvatarDownloadObjectUrl(
	downloadUrl: string
): Promise<string> {
	const hit = avatarBlobObjectUrlByPath.get(downloadUrl);
	if (hit) {
		return hit;
	}
	let inflight = avatarBlobInflight.get(downloadUrl);
	if (!inflight) {
		inflight = apiClient
			.get<Blob>(downloadUrl, { responseType: 'blob' })
			.then((res) => {
				const objectUrl = URL.createObjectURL(res.data);
				avatarBlobObjectUrlByPath.set(downloadUrl, objectUrl);
				avatarBlobInflight.delete(downloadUrl);
				return objectUrl;
			})
			.catch((e) => {
				avatarBlobInflight.delete(downloadUrl);
				throw e;
			});
		avatarBlobInflight.set(downloadUrl, inflight);
	}
	return inflight;
}

/** Clears cached avatar metadata (e.g. after delete or cross-session identity change). */
export function invalidateAvatarInfoCache(): void {
	avatarInfoCache = null;
	avatarInfoInflight = null;
	for (const url of avatarBlobObjectUrlByPath.values()) {
		URL.revokeObjectURL(url);
	}
	avatarBlobObjectUrlByPath.clear();
	avatarBlobInflight.clear();
}

// ============================================================================
// Profile Management
// ============================================================================

/**
 * Get current user profile
 */
export async function getProfile(options?: {
	signal?: AbortSignal;
}): Promise<UserProfileResponse> {
	const { data } = await apiClient.get(`${API_BASE}/me`, {
		headers: {
			'Cache-Control': 'no-store',
			Pragma: 'no-cache',
		},
		signal: options?.signal,
	});
	return normalizeUserProfilePayload(data);
}

function normalizeNotificationCenterResponse(
	data: NotificationCenterGetResponse
): NotificationCenterGetResponse {
	return {
		...data,
		items: data.items ?? [],
		dismissed_ids: data.dismissed_ids ?? [],
	};
}

export async function getNotificationCenter(): Promise<NotificationCenterGetResponse> {
	const { data } = await apiClient.get<unknown>(
		`${API_BASE}/notification-center`,
		{
			headers: {
				'Cache-Control': 'no-store',
				Pragma: 'no-cache',
			},
		}
	);
	return normalizeNotificationCenterResponse(
		unwrapApiData<NotificationCenterGetResponse>(data)
	);
}

export async function putNotificationCenter(body: {
	items: NotificationCenterApiItem[];
	dismissed_ids?: string[];
}): Promise<NotificationCenterGetResponse> {
	const { data } = await apiClient.put<unknown>(
		`${API_BASE}/notification-center`,
		body
	);
	return normalizeNotificationCenterResponse(
		unwrapApiData<NotificationCenterGetResponse>(data)
	);
}

/**
 * Update user profile
 * @param data - Profile update data (full_name, bio)
 */
export async function updateProfile(
	data: ProfileUpdateData
): Promise<UserProfileResponse> {
	const { data: resData } = await apiClient.patch<UserProfileResponse>(
		`${API_BASE}/me`,
		data
	);
	return resData;
}

export async function getProfilePrivacy(): Promise<ProfilePrivacySettings> {
	const { data } = await apiClient.get<ProfilePrivacySettings>(
		`${API_BASE}/me/privacy`
	);
	return data;
}

export async function updateProfilePrivacy(
	patch: ProfilePrivacyUpdate
): Promise<ProfilePrivacySettings> {
	const { data } = await apiClient.patch<ProfilePrivacySettings>(
		`${API_BASE}/me/privacy`,
		patch
	);
	return data;
}

// ============================================================================
// Avatar Management
// ============================================================================

/**
 * Upload user avatar
 * @param file - Image file (max 5MB, JPEG/PNG/WEBP)
 */
export async function uploadAvatar(file: File): Promise<AvatarUploadResponse> {
	const formData = new FormData();
	formData.append('file', file);

	const { data } = await apiClient.post<AvatarUploadResponse>(
		`${API_BASE}/avatar`,
		formData,
		{
			headers: {
				'Content-Type': 'multipart/form-data',
			},
		}
	);
	avatarInfoCache = data;
	return data;
}

/**
 * Get current avatar info
 */
export async function getAvatar(): Promise<AvatarUploadResponse> {
	if (avatarInfoCache) {
		return avatarInfoCache;
	}
	if (!avatarInfoInflight) {
		avatarInfoInflight = apiClient
			.get<AvatarUploadResponse>(`${API_BASE}/avatar`, {
				validateStatus: (status) => status === 200 || status === 404,
			})
			.then((res) => {
				const data = res.status === 404 ? EMPTY_AVATAR_INFO : res.data;
				avatarInfoCache = data;
				return data;
			})
			.finally(() => {
				avatarInfoInflight = null;
			});
	}
	return avatarInfoInflight;
}

/**
 * Delete current avatar
 */
export async function deleteAvatar(): Promise<void> {
	await apiClient.delete(`${API_BASE}/avatar`);
	invalidateAvatarInfoCache();
}

/**
 * Get avatar upload history (last 50)
 */
export async function getAvatarHistory(): Promise<AvatarHistoryItem[]> {
	const { data } = await apiClient.get<AvatarHistoryItem[]>(
		`${API_BASE}/avatar/history`
	);
	return data;
}

// ============================================================================
// Preferences Management
// ============================================================================

/**
 * Get user preferences
 * No HTTP/browser caching — source of truth is always the server response.
 */
export async function getPreferences(): Promise<UserPreferences> {
	const { data } = await apiClient.get<UserPreferences>(
		`${API_BASE}/preferences`,
		{
			headers: {
				'Cache-Control': 'no-store',
				Pragma: 'no-cache',
			},
		}
	);
	return data;
}

/**
 * Update user preferences
 * @param data - Partial preferences update
 */
export async function updatePreferences(
	data: UserPreferencesUpdate
): Promise<UserPreferences> {
	const { data: resData } = await apiClient.patch<UserPreferences>(
		`${API_BASE}/preferences`,
		data
	);
	return resData;
}

/**
 * Update only language preference
 * @param language - New language code
 */
export async function updateLanguage(
	language: Language
): Promise<UserPreferences> {
	const { data: resData } = await apiClient.patch<UserPreferences>(
		`${API_BASE}/preferences/language`,
		{
			language,
		}
	);
	return resData;
}

// ============================================================================
// Security Management
// ============================================================================

/**
 * Get security settings
 */
export async function getSecuritySettings(): Promise<SecuritySettings> {
	const { data } = await apiClient.get<SecuritySettings>(
		`${API_BASE}/security`
	);
	return data;
}

/**
 * Change user password
 * @param data - Current and new password
 */
export async function changePassword(data: PasswordChangeData): Promise<void> {
	await apiClient.post(`${API_BASE}/change-password`, data);
}

/**
 * Get all active sessions
 */
export async function getSessions(): Promise<UserSessionInfo[]> {
	const { data } = await apiClient.get<UserSessionInfo[]>(
		`${API_BASE}/sessions`
	);
	return data;
}

/**
 * Revoke a specific session
 * @param sessionId - Session ID to revoke
 */
export async function revokeSession(sessionId: string): Promise<void> {
	await apiClient.delete(`${API_BASE}/sessions/${sessionId}`);
}

/**
 * Revoke all other sessions (keep current)
 */
export async function revokeAllSessions(): Promise<void> {
	await apiClient.post(`${API_BASE}/sessions/revoke-all`);
}

/**
 * Get extended security settings with sessions and events
 */
export async function getExtendedSecuritySettings(): Promise<ExtendedSecuritySettings> {
	const { data } = await apiClient.get<ExtendedSecuritySettings>(
		`${API_BASE}/security/extended`
	);
	return data;
}

/**
 * Get active sessions with detailed info
 */
export async function getActiveSessions(): Promise<ActiveSession[]> {
	const { data } = await apiClient.get<ActiveSession[]>(
		`${API_BASE}/security/sessions`
	);
	return data;
}

/**
 * Get security events log
 */
export async function getSecurityEvents(limit = 50): Promise<SecurityEvent[]> {
	const { data } = await apiClient.get<SecurityEvent[]>(
		`${API_BASE}/security/events`,
		{
			params: { limit },
		}
	);
	return data;
}

/**
 * Enable 2FA and get setup data
 */
export async function enable2FA(): Promise<Enable2FAResponse> {
	const { data } = await apiClient.post<Enable2FAResponse>(
		`${API_BASE}/security/2fa/enable`
	);
	return data;
}

/**
 * Verify and activate 2FA
 */
export async function verify2FA(code: string): Promise<void> {
	await apiClient.post(`${API_BASE}/security/2fa/verify`, { code });
}

/**
 * Disable 2FA
 */
export async function disable2FA(password: string): Promise<void> {
	await apiClient.post(`${API_BASE}/security/2fa/disable`, { password });
}

/**
 * Regenerate 2FA backup codes
 */
export async function regenerate2FABackupCodes(
	password: string
): Promise<string[]> {
	const { data } = await apiClient.post<{ backup_codes: string[] }>(
		`${API_BASE}/security/2fa/backup-codes/regenerate`,
		{ password }
	);
	return data.backup_codes;
}

// ============================================================================
// Statistics & Activity
// ============================================================================

/**
 * Get user statistics
 */
export async function getStatistics(): Promise<UserStatistics> {
	const { data } = await apiClient.get<UserStatistics>(
		`${API_BASE}/statistics`
	);
	return data;
}

/**
 * Get activity log with pagination
 * @param page - Page number (1-indexed)
 * @param perPage - Items per page (default: 50)
 */
export async function getActivityLog(
	page = 1,
	perPage = 50
): Promise<ActivityLogResponse> {
	const { data } = await apiClient.get<unknown>(`${API_BASE}/activity`, {
		params: { page, per_page: perPage },
	});
	const raw = unwrapApiData<Partial<ActivityLogResponse>>(data);
	return {
		activities: Array.isArray(raw.activities) ? raw.activities : [],
		total: typeof raw.total === 'number' ? raw.total : 0,
		page: typeof raw.page === 'number' ? raw.page : page,
		per_page: typeof raw.per_page === 'number' ? raw.per_page : perPage,
		total_pages: typeof raw.total_pages === 'number' ? raw.total_pages : 0,
	};
}

// ============================================================================
// Data Export
// ============================================================================

/**
 * Request data export
 * @param request - Export configuration
 */
export async function requestDataExport(
	request: DataExportRequest
): Promise<DataExportResponse> {
	const { data } = await apiClient.post<DataExportResponse>(
		`${API_BASE}/export`,
		request
	);
	return data;
}

/**
 * Get export status
 * @param exportId - Export ID
 */
export async function getExportStatus(
	exportId: string
): Promise<DataExportResponse> {
	const { data } = await apiClient.get<DataExportResponse>(
		`${API_BASE}/export/${exportId}`
	);
	return data;
}

/**
 * Get all export history
 */
export async function getExportHistory(): Promise<DataExportResponse[]> {
	const { data } = await apiClient.get<DataExportResponse[]>(
		`${API_BASE}/export/history`
	);
	return data;
}

/**
 * Download export file
 * @param exportId - Export ID
 */
export async function downloadExport(exportId: string): Promise<Blob> {
	const { data } = await apiClient.get(
		`${API_BASE}/export/${exportId}/download`,
		{
			responseType: 'blob',
		}
	);
	return data;
}

/**
 * Delete export file
 * @param exportId - Export ID
 */
export async function deleteExport(exportId: string): Promise<void> {
	await apiClient.delete(`${API_BASE}/export/${exportId}`);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate avatar file before upload
 * @param file - File to validate
 * @returns Error message or null if valid
 */
export function validateAvatarFile(file: File): string | null {
	const maxSize = 5 * 1024 * 1024; // 5MB
	const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

	if (!allowedTypes.includes(file.type)) {
		return 'Допустимые форматы: JPEG, PNG, WEBP';
	}

	if (file.size > maxSize) {
		return 'Максимальный размер файла: 5 МБ';
	}

	return null;
}

/**
 * Create avatar preview URL from File
 * @param file - Image file
 * @returns Object URL for preview
 */
export function createAvatarPreview(file: File): string {
	return URL.createObjectURL(file);
}

/**
 * Revoke avatar preview URL to free memory
 * @param url - Object URL to revoke
 */
export function revokeAvatarPreview(url: string): void {
	URL.revokeObjectURL(url);
}

// ============================================================================
// Export all functions
// ============================================================================

export const profileService = {
	// Profile
	getProfile,
	updateProfile,
	getProfilePrivacy,
	updateProfilePrivacy,

	// Notification center (server inbox)
	getNotificationCenter,
	putNotificationCenter,

	// Avatar
	uploadAvatar,
	getAvatar,
	deleteAvatar,
	invalidateAvatarInfoCache,
	getAvatarDownloadObjectUrl,
	getAvatarHistory,

	// Preferences
	getPreferences,
	updatePreferences,
	updateLanguage,

	// Security
	getSecuritySettings,
	getExtendedSecuritySettings,
	getActiveSessions,
	getSecurityEvents,
	changePassword,
	getSessions,
	revokeSession,
	revokeAllSessions,
	enable2FA,
	verify2FA,
	disable2FA,
	regenerate2FABackupCodes,

	// Statistics
	getStatistics,
	getActivityLog,

	// Data Export
	requestDataExport,
	getExportStatus,
	getExportHistory,
	downloadExport,
	deleteExport,

	// Utilities
	validateAvatarFile,
	createAvatarPreview,
	revokeAvatarPreview,
};

export default profileService;
