/**
 * Floating Widgets Service
 * API client for managing floating (window) widgets.
 * Types aligned with backend api/models/floating_widgets.py (FloatingWidgetResponse, etc.)
 */

import { apiClient } from '../api';

// ============================================================================
// TYPES
// ============================================================================

export interface FloatingWidgetIconConfig {
	icon_type: 'default' | 'custom' | 'emoji' | 'image';
	icon_name?: string;
	icon_size: 16 | 20 | 24 | 32 | 48;
	icon_color?: string;
	image_url?: string;
}

export interface FloatingWidgetDataConfig {
	data_type: 'default' | 'custom' | 'api' | 'static';
	data_source?: string;
	data_config: Record<string, unknown>;
}

export interface FloatingWidgetDisplayConfig {
	display_mode: 'collapsed' | 'mini' | 'expanded';
	size_config: Record<string, unknown>;
}

export interface FloatingWidget {
	id: string;
	user_id: string;
	widget_type: string;
	widget_key: string;
	title?: string;
	position_x?: number;
	position_y?: number;
	is_collapsed: boolean;
	is_visible: boolean;
	icon_config: FloatingWidgetIconConfig;
	data_config: FloatingWidgetDataConfig;
	display_config: FloatingWidgetDisplayConfig;
	settings: Record<string, unknown>;
	created_at: string;
	updated_at: string;
}

export interface FloatingWidgetCreate {
	widget_type: string;
	widget_key: string;
	title?: string;
	position_x?: number;
	position_y?: number;
	is_collapsed?: boolean;
	is_visible?: boolean;
	icon_config: FloatingWidgetIconConfig;
	data_config: FloatingWidgetDataConfig;
	display_config: FloatingWidgetDisplayConfig;
	settings?: Record<string, unknown>;
}

export interface FloatingWidgetUpdate {
	title?: string;
	position_x?: number;
	position_y?: number;
	is_collapsed?: boolean;
	is_visible?: boolean;
	icon_config?: FloatingWidgetIconConfig;
	data_config?: FloatingWidgetDataConfig;
	display_config?: FloatingWidgetDisplayConfig;
	settings?: Record<string, unknown>;
}

export interface FloatingWidgetTemplate {
	id: string;
	widget_type: string;
	name: string;
	description?: string;
	category: 'system' | 'monitoring' | 'content' | 'ai' | 'custom';
	default_icon_type: string;
	default_icon_name?: string;
	default_icon_size: number;
	default_icon_color?: string;
	default_data_type: string;
	default_data_source?: string;
	default_data_config: Record<string, unknown>;
	default_display_mode: string;
	default_size_config: Record<string, unknown>;
	available_icon_types: string[];
	available_icon_sizes: number[];
	available_data_types: string[];
	available_display_modes: string[];
	is_system: boolean;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface CreateWidgetFromTemplateRequest {
	widget_type: string;
	widget_key: string;
	title?: string;
	icon_config?: FloatingWidgetIconConfig;
	data_config?: FloatingWidgetDataConfig;
	display_config?: FloatingWidgetDisplayConfig;
	settings?: Record<string, unknown>;
}

// ============================================================================
// API SERVICE
// ============================================================================

class FloatingWidgetsService {
	private baseUrl = '/api/v1/floating-widgets';

	/**
	 * Get all visible floating widgets for current user
	 */
	async getUserWidgets(): Promise<FloatingWidget[]> {
		const response = await apiClient.get<FloatingWidget[]>(this.baseUrl);
		return response.data;
	}

	/**
	 * Get specific widget by ID
	 */
	async getWidget(widgetId: string): Promise<FloatingWidget> {
		const response = await apiClient.get<FloatingWidget>(
			`${this.baseUrl}/${widgetId}`
		);
		return response.data;
	}

	/**
	 * Create new floating widget
	 */
	async createWidget(widget: FloatingWidgetCreate): Promise<FloatingWidget> {
		const response = await apiClient.post<FloatingWidget>(this.baseUrl, widget);
		return response.data;
	}

	/**
	 * Create widget from template
	 */
	async createWidgetFromTemplate(
		request: CreateWidgetFromTemplateRequest
	): Promise<FloatingWidget> {
		const response = await apiClient.post<FloatingWidget>(
			`${this.baseUrl}/from-template`,
			request
		);
		return response.data;
	}

	/**
	 * Update floating widget (partial update)
	 */
	async updateWidget(
		widgetId: string,
		updates: FloatingWidgetUpdate
	): Promise<FloatingWidget> {
		const response = await apiClient.patch<FloatingWidget>(
			`${this.baseUrl}/${widgetId}`,
			updates
		);
		return response.data;
	}

	/**
	 * Delete floating widget
	 */
	async deleteWidget(widgetId: string): Promise<void> {
		await apiClient.delete(`${this.baseUrl}/${widgetId}`);
	}

	/**
	 * Get widget templates
	 */
	async getTemplates(
		category?: string,
		activeOnly = true
	): Promise<FloatingWidgetTemplate[]> {
		const params = new URLSearchParams();
		if (category) {
			params.append('category', category);
		}
		if (activeOnly !== undefined) {
			params.append('active_only', String(activeOnly));
		}

		const response = await apiClient.get<FloatingWidgetTemplate[]>(
			`${this.baseUrl}/templates?${params.toString()}`
		);
		return response.data;
	}

	/**
	 * Get specific template by widget type
	 */
	async getTemplate(widgetType: string): Promise<FloatingWidgetTemplate> {
		const response = await apiClient.get<FloatingWidgetTemplate>(
			`${this.baseUrl}/templates/${widgetType}`
		);
		return response.data;
	}
}

export const floatingWidgetsService = new FloatingWidgetsService();
