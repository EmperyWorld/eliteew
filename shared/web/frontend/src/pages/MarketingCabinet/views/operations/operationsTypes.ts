/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public props and form state types for Marketing Cabinet Operations view.
 *
 * Invariants:
 * - Named export path views/OperationsView.tsx re-exports OperationsViewProps.
 *
 * Related:
 * - OperationsView.tsx
 * - useOperationsView.ts
 */

export type TaskFormState = {
	title: string;
	description: string;
	status: string;
	priority: string;
	owner_name: string;
	due_at: string;
};

export type AlertFormState = {
	title: string;
	description: string;
	severity: string;
	status: string;
	owner_name: string;
};

export type OperationsViewProps = {
	selectedProjectId: string | null;
	section: 'tasks' | 'alerts';
	focusedEntityId?: string | null;
	allowMarketingWrite?: boolean;
};
