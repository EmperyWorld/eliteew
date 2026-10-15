/**
 * Type definitions for Unified Content Manager
 */

import type { NavigationHandler } from '../../../types/navigation';
import type { AppTheme, AppSettings } from '../../../hooks/useAppState';
import type { User } from '../../../services';

export interface UnifiedContentManagerProps {
	user?: User | null;
	isAuthenticated?: boolean;
	onNavigate?: NavigationHandler;
	theme: AppTheme;
	settings?: AppSettings;
}

/** Aligned with backend api/schemas/unified_content.Content (including nullable fields) */
export interface Content {
	id: string;
	name: string;
	/** Явный заголовок документа в БД; если задан, в CM показываем его вместо `name`. */
	title?: string | null;
	word_count?: number | null;
	character_count?: number | null;
	content_type: string;
	/** Backend may return null if unknown */
	file_size: number | null;
	mime_type: string | null;
	created_at: string;
	updated_at: string;
	user_id: string;
	/** Set by API when thumbnail_path is present (GET /content/{id}/thumbnail) */
	thumbnail_url?: string | null;
	/** Backend field; prefer thumbnail_url for display */
	thumbnail_path?: string | null;
	visibility: string;
	tags: string[];
	processing_status?: string;
	processing_error?: string | null;
	description?: string | null;
	company_id?: string | null;
	project_id?: string | null;
	friend_visibility?: boolean;
	/** When friend_visibility: empty = all mutual friends; else subset of friend user ids */
	shared_with_user_ids?: string[] | null;
	extracted_text?: string | null;
	metadata?: Record<string, unknown>;
	file_path?: string | null;
	file_hash?: string | null;
	// Desktop/ContentManagerPro-specific fields (optional)
	original_filename?: string | null;
	folder_item_id?: string | null;
	/** Permission-aware: set by API from current user vs owner */
	is_owner?: boolean;
	can_edit?: boolean;
	can_delete?: boolean;
	/** Set by GET /content/multi-version: rows in content_versions for this file */
	version_snapshot_count?: number;
	/** POST /content returned existing row by file hash (metadata may have been merged). */
	deduplicated_reused?: boolean;
}

/** Aligned with backend GET /api/v1/content/statistics response */
export interface ContentStats {
	totalFiles: number;
	totalSize: number;
	typeDistribution: Record<string, number>;
	recentActivity: number;
	topTags: Array<{ tag: string; count: number }>;
}

export interface Version {
	version_id: string;
	content_id?: string;
	version_number: number;
	file_size: number;
	file_hash?: string;
	mime_type?: string;
	name?: string;
	description?: string | null;
	tags?: string[];
	metadata?: Record<string, unknown>;
	created_by: string;
	created_by_username?: string;
	created_at: string;
	change_description?: string;
	updated_by?: string;
	updated_by_username?: string;
}

export interface Share {
	id: string;
	content_id: string;
	shared_with?: string;
	shared_by: string;
	permission_level: string;
	expires_at?: string | null;
	accessed_at?: string | null;
	access_count?: number;
	shared_with_user_id?: string;
	shared_by_user_id?: string;
	permission?: string;
	created_at: string;
}

export interface ShareResponse extends Share {
	content_name?: string;
	content_type?: string;
}

export type ViewMode = 'grid' | 'list';
export type SortField = 'name' | 'date' | 'size' | 'type';
export type SortOrder = 'asc' | 'desc';
export type TabType =
	| 'browser'
	| 'file-manager'
	| 'upload'
	| 'analytics'
	| 'versions'
	| 'shared'
	| 'tests';

export interface Company {
	id: string;
	name: string;
}

export interface Project {
	id: string;
	name: string;
	company_id: string;
}

export interface EditForm {
	name: string;
	description: string;
	tags: string[];
	visibility: string;
	company_id: string | null;
	project_id: string | null;
	friend_visibility: boolean;
	/** Friend user ids allowed when sharing with friends (subset); empty = all friends */
	friend_shared_user_ids: string[];
}
