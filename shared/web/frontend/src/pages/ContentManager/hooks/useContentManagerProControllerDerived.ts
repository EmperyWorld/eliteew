/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Derived labels, cabinet scope, selection resolution, and advanced-search pagination for Content Manager Pro controller.
 *
 * Invariants:
 * - selectedContent prefers hydrated details over list row when ids match.
 *
 * Related:
 * - useContentManagerProController.ts
 */
import { useCallback, useMemo } from 'react';
import type { TFunction } from 'i18next';
import type {
	Company,
	Content as ContentItem,
	Project,
} from '../../../components/UnifiedContent/types';
import { CONTENT_MANAGER_ADVANCED_PAGE_SIZE } from './useContentManagerAdvancedSearchActions';
import type { ContentManagerCabinetScope } from '../contentManagerProTypes';
import { TYPE_CONFIG } from '../components/ContentManagerTypeConfig';
import type { useContentManagerPreviewKeyboard } from './useContentManagerPreviewKeyboard';
import type { useContentManagerVersions } from './useContentManagerVersions';
import type { useTenancyOptions } from './useTenancyOptions';

type PreviewKeyboard = ReturnType<typeof useContentManagerPreviewKeyboard>;
type VersionsHook = ReturnType<typeof useContentManagerVersions>;
type TenancyOptions = ReturnType<typeof useTenancyOptions>;

export type UseContentManagerProControllerDerivedParams = {
	t: TFunction<'contentManager'>;
	initialCabinetScope: ContentManagerCabinetScope | null;
	filterProjectId: string | null;
	companies: TenancyOptions['companies'];
	projects: TenancyOptions['projects'];
	preview: PreviewKeyboard;
	versions: VersionsHook;
	items: ContentItem[];
	selectedContentId: string | null;
	advancedLoading: boolean;
	advancedError: string | null;
	advancedResults: import('../../../services/contentApi').ContentAdvancedSearchHit[];
	advancedTotal: number;
	fetchContent: () => void | Promise<void>;
};

export function useContentManagerProControllerDerived({
	t,
	initialCabinetScope,
	filterProjectId,
	companies,
	projects,
	preview,
	versions,
	items,
	selectedContentId,
	advancedLoading,
	advancedError,
	advancedResults,
	advancedTotal,
	fetchContent,
}: UseContentManagerProControllerDerivedParams) {
	const contentTypeOptionsForAdvanced = useMemo(
		() =>
			(Object.keys(TYPE_CONFIG) as Array<keyof typeof TYPE_CONFIG>).map(
				(k) => ({
					value: k,
					label: t(`contentTypes.${String(k)}`),
				})
			),
		[t]
	);

	const resolveContentTypeLabel = useCallback(
		(ct: string) =>
			t(`contentTypes.${ct}`, { defaultValue: t('files.typeOtherGroup') }),
		[t]
	);

	const versionsCompanies = useMemo<Company[]>(
		() => companies.map((c) => ({ id: c.id, name: c.name })),
		[companies]
	);
	const versionsProjects = useMemo<Project[]>(
		() =>
			projects.map((p) => ({
				id: p.id,
				name: p.name,
				company_id: p.company_id,
			})),
		[projects]
	);

	const cabinetLocked = initialCabinetScope?.cabinetView === true;
	const cabinetProjectLabel = useMemo(() => {
		if (!cabinetLocked || !filterProjectId) return '';
		return (
			projects.find((p) => p.id === filterProjectId)?.name ||
			initialCabinetScope?.projectName ||
			filterProjectId
		);
	}, [
		cabinetLocked,
		filterProjectId,
		projects,
		initialCabinetScope?.projectName,
	]);

	const selectedContent = useMemo(() => {
		if (!selectedContentId) return null;
		if (versions.selectedContentDetails?.id === selectedContentId) {
			return versions.selectedContentDetails;
		}
		if (preview.previewItem?.id === selectedContentId)
			return preview.previewItem;
		return items.find((item) => item.id === selectedContentId) ?? null;
	}, [
		items,
		preview.previewItem,
		versions.selectedContentDetails,
		selectedContentId,
	]);

	const hasAdvancedResults =
		advancedLoading || advancedError != null || advancedResults.length > 0;
	const advancedTotalPages = Math.max(
		1,
		Math.ceil(advancedTotal / CONTENT_MANAGER_ADVANCED_PAGE_SIZE)
	);

	const noopUndoActivity = useCallback(async () => false, []);

	const handleFileCommentsAfterUpdate = useCallback(() => {
		if (!selectedContentId) return;
		void Promise.all([
			fetchContent(),
			versions.fetchSelectedContentDetails(selectedContentId),
		]);
	}, [selectedContentId, fetchContent, versions.fetchSelectedContentDetails]);

	return {
		contentTypeOptionsForAdvanced,
		resolveContentTypeLabel,
		versionsCompanies,
		versionsProjects,
		cabinetLocked,
		cabinetProjectLabel,
		selectedContent,
		hasAdvancedResults,
		advancedTotalPages,
		noopUndoActivity,
		handleFileCommentsAfterUpdate,
	};
}
