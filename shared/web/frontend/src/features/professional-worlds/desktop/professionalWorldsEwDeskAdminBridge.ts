/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * SessionStorage bridge from Professional Worlds EWDesk handoff to Unified Admin publish form.
 *
 * Invariants:
 * - Consume-on-read: admin form hydrates once; no automatic publish.
 *
 * Related:
 * - EWDeskApp.tsx, EwDeskAdminSection.tsx
 * - reportProfessionalCrossAppDraftLifecycle.ts
 */

const STORAGE_KEY = 'eliteew.professionalWorlds.ewdeskAdminDraft.v1';

export type ProfessionalWorldsEwDeskAdminBridgeDraft = {
	readonly title: string;
	readonly markdown: string;
	readonly crossAppLinkId: string;
};

function trim(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

export function stashProfessionalWorldsEwDeskAdminDraft(
	draft: ProfessionalWorldsEwDeskAdminBridgeDraft
): boolean {
	if (typeof window === 'undefined') return false;
	const title = trim(draft.title);
	const markdown = trim(draft.markdown);
	const crossAppLinkId = trim(draft.crossAppLinkId);
	if (!title || !markdown || !crossAppLinkId) return false;
	try {
		sessionStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ title, markdown, crossAppLinkId })
		);
		return true;
	} catch {
		return false;
	}
}

export function consumeProfessionalWorldsEwDeskAdminDraft(): ProfessionalWorldsEwDeskAdminBridgeDraft | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		sessionStorage.removeItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object') return null;
		const title = trim((parsed as { title?: unknown }).title);
		const markdown = trim((parsed as { markdown?: unknown }).markdown);
		const crossAppLinkId = trim(
			(parsed as { crossAppLinkId?: unknown }).crossAppLinkId
		);
		if (!title || !markdown || !crossAppLinkId) return null;
		return { title, markdown, crossAppLinkId };
	} catch {
		return null;
	}
}
