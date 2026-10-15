/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public props contract for Marketing Cabinet IMC Research view.
 *
 * Invariants:
 * - Named export path views/ImcResearchView.tsx re-exports this type for
 *   lazy consumers; prop shape must stay stable.
 *
 * Related:
 * - ImcResearchView.tsx
 * - marketingCabinetPageLazyImports.ts
 */

export type ImcResearchViewProps = {
	selectedProjectId: string | null;
	selectedCompanyId: string | null;
	focusedEntityId?: string | null;
	/** Руководитель проекта (`projects.created_by`) — может удалять записи из истории ИМК. */
	isProjectLead?: boolean;
	onSelectResearch: (id: string) => void;
	onClearResearchSelection: () => void;
};
