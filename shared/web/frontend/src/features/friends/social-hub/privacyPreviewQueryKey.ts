/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared React Query key for Social Hub privacy-preview invalidation after privacy PATCH.
 *
 * Invariants:
 * - Preview panel and ProfilePrivacySection must use the same key.
 *
 * Related:
 * - ../../components/SocialHubPrivacyPreviewPanel.tsx
 * - @/components/profile/ProfilePrivacySection.tsx
 */

export const SOCIAL_HUB_PRIVACY_PREVIEW_QUERY_KEY = [
	'social-hub',
	'privacy-preview',
] as const;
