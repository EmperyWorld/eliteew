/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Best-effort client reports for Professional Worlds cross-app draft lifecycle from destination apps.
 *
 * Invariants:
 * - Fire-and-forget; failures must not block destination UX.
 * - Never auto-publishes — only records evidence the user already triggered remotely.
 *
 * Related:
 * - openProfessionalDraftDestination.ts
 * - shared/api/routers/professional_worlds_workspace.py
 */

import { reportProfessionalCrossAppDraft } from './api';

export type CrossAppDraftLifecycleReportState =
	| 'opened'
	| 'updated'
	| 'published'
	| 'cancelled';

export type CrossAppDraftRemoteTracking = {
	ewrp_job_id?: string;
	site_instance_id?: string;
	gaf_message_id?: string;
	ewdesk_news_id?: string;
};

export function shouldReportGafCrossAppDraftPublished(params: {
	linkId?: string | null;
	body: string;
	attachmentContentId?: string | null;
}): boolean {
	const linkId = params.linkId?.trim();
	if (!linkId) return false;
	return Boolean(params.body.trim() || params.attachmentContentId?.trim());
}

export function readCrossAppLinkId(raw: unknown): string | null {
	if (!raw || typeof raw !== 'object') return null;
	const linkId = (raw as { cross_app_link_id?: unknown }).cross_app_link_id;
	return typeof linkId === 'string' && linkId.trim() ? linkId.trim() : null;
}

export function reportProfessionalCrossAppDraftLifecycle(
	linkId: string | null | undefined,
	lifecycleState: CrossAppDraftLifecycleReportState,
	remoteTracking?: CrossAppDraftRemoteTracking
): void {
	const normalizedLinkId = linkId?.trim();
	if (!normalizedLinkId) return;
	const tracking = remoteTracking
		? Object.fromEntries(
				Object.entries(remoteTracking).filter(
					([, value]) => typeof value === 'string' && value.trim()
				)
			)
		: undefined;
	void reportProfessionalCrossAppDraft(normalizedLinkId, {
		lifecycle_state: lifecycleState,
		...(tracking && Object.keys(tracking).length > 0
			? { remote_tracking: tracking }
			: {}),
	}).catch(() => {
		// Destination UX must not depend on PW bookkeeping.
	});
}
