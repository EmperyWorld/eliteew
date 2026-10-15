import type { StoreAppResponse } from '../../../services/desktopApi';

export function storeAppFixture(
	overrides: Partial<StoreAppResponse> &
		Pick<StoreAppResponse, 'app_id' | 'name'>
): StoreAppResponse {
	return {
		app_component: 'TestApp',
		category: 'productivity',
		description: '',
		gradient: null,
		color: null,
		sort_order: 0,
		allow_multiple_windows: false,
		max_window_instances: 1,
		installed: false,
		is_system: false,
		is_factory: false,
		can_uninstall: true,
		ew_monthly_price: 0,
		trial_duration_days: 0,
		billing_exempt: false,
		is_featured_new: false,
		show_new_badge: false,
		maintenance_mode: false,
		icon_url: null,
		icon_url_2x: null,
		preview_url: null,
		preview_url_2x: null,
		...overrides,
	};
}
