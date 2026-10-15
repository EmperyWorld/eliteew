/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React Query hooks for AmkaView runs, detail, presets, and IMC types.
 *
 * Invariants:
 * - Query keys and polling match pre-atomization AmkaView behavior.
 *
 * Related:
 * - useAmkaViewCompose.ts, @/hooks/api/useAmka
 */

import {
	useAmkaPresets,
	useAmkaRunDetail,
	useAmkaRuns,
	useApproveAmkaRun,
	useCancelAmkaRun,
	useContinueAmkaStep,
	useCreateAmkaRun,
	useResumeAmkaRun,
} from '@/hooks/api/useAmka';
import { useImcTypes } from '@/hooks/api/useImcResearch';

export function useAmkaViewQueries(
	selectedProjectId: string | null,
	selectedCompanyId: string | null,
	selectedRunId: string | null
) {
	const imcTypesQuery = useImcTypes(selectedCompanyId);
	const presetsQuery = useAmkaPresets(selectedProjectId ?? undefined);
	const runsQuery = useAmkaRuns(selectedProjectId ?? undefined, 24);
	const detailQuery = useAmkaRunDetail(selectedRunId ?? undefined);
	const createMutation = useCreateAmkaRun();
	const approveMutation = useApproveAmkaRun(
		selectedProjectId ?? undefined,
		selectedCompanyId
	);
	const resumeMutation = useResumeAmkaRun(
		selectedProjectId ?? undefined,
		selectedCompanyId
	);
	const continueMutation = useContinueAmkaStep(
		selectedProjectId ?? undefined,
		selectedCompanyId
	);
	const cancelMutation = useCancelAmkaRun(
		selectedProjectId ?? undefined,
		selectedCompanyId
	);

	return {
		imcTypesQuery,
		presetsQuery,
		runsQuery,
		detailQuery,
		createMutation,
		approveMutation,
		resumeMutation,
		continueMutation,
		cancelMutation,
	};
}
