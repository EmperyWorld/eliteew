/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Marketing Cabinet dashboard layout HTTP DTOs — OpenAPI SSOT aliases (Wave 4).
 * Widget view configs (`MarketingWidgetConfig`) remain hand in `dashboard-widgets/`.
 *
 * Invariants:
 * - Layout / widget / preset / activate / clone / usage types alias full pilot.
 * - `widget_config` on HTTP wire is OpenAPI object map; parse to view config at UI.
 *
 * Related:
 * - marketingCabinetOpenApi.ts
 * - documentation/api/FRONTEND-BACKEND-HTTP.md §Adoption Wave 4
 */

export type {
	MarketingDashboardGridPosition,
	MarketingDashboardWidget,
	MarketingDashboardLayout,
	MarketingDashboardLayoutListResponse,
	MarketingDashboardPreset,
	MarketingDashboardPresetListResponse,
	MarketingDashboardLayoutCreatePayload,
	MarketingDashboardLayoutUpdatePayload,
	MarketingDashboardWidgetCreatePayload,
	MarketingDashboardWidgetUpdatePayload,
	MarketingDashboardActivateResponse,
	MarketingDashboardCloneResponse,
	MarketingDashboardCleanupDuplicatesResponse,
	MarketingDashboardUsageStats,
} from './marketingCabinetOpenApi';
