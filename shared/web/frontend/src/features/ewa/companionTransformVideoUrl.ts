/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map companion SSE / sync **`transform_event_kind`** to a **public** short mp4 path under `public/ewa/` for the
 * dramatic transform modal (`EwaCompanionChatPanel`).
 *
 * Invariants:
 * - Unknown kinds fall back to the v1 forward clip (`arly_transform.mp4`).
 * - `ewa_restore` and `arly_to_ewa` share the same soft-return asset per product spec.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 * - api/ewa_platform/companion/turn/chat_turn.py (`_companion_transform_sse_payload`)
 */
export function companionTransformVideoUrl(
	kind: string | null | undefined
): string {
	const k = (kind || '').trim().toLowerCase();
	const raw = import.meta.env.BASE_URL || '/';
	const base = raw.endsWith('/') ? raw.slice(0, -1) : raw;
	if (k === 'ewa_restore' || k === 'arly_to_ewa')
		return `${base}/ewa/arly_to_ewa.mp4`;
	if (k === 'ewa_to_arly') return `${base}/ewa/ewa_to_arly.mp4`;
	return `${base}/ewa/arly_transform.mp4`;
}
