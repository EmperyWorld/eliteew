/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Applies cabinet, desktop-folder, and saved-filter launch payloads to Content Manager navigation state.
 *
 * Invariants:
 * - Cabinet scope has precedence over desktop-folder and saved-filter launch payloads.
 * - Each stable payload is applied once per mounted orchestrator.
 *
 * Related:
 * - ContentManagerPro.tsx
 * - Desktop/types/desktop.types.ts
 */
import { useEffect, useRef } from 'react';
import type { ContentManagerInitialFilterSnapshot } from '../../Desktop/types/desktop.types';
import {
	ensureProjectDesktopFolder,
	projectContentFolderItemId,
} from '../projectDesktopFolder';
import type {
	ContentManagerTab,
	ExplorerFolderTarget,
	FilesBrowseMode,
	FilterVisibility,
	GroupBy,
} from '../contentManagerTypes';
import type { ContentManagerCabinetScope } from '../contentManagerProTypes';
import { log } from '../../../utils/logger';

export type UseContentManagerInitialScopeOptions = {
	initialCabinetScope: ContentManagerCabinetScope | null;
	initialDesktopFolderItemId: string | null;
	initialFilterSnapshot: ContentManagerInitialFilterSnapshot | null;
	fetchFolders: () => void | Promise<void>;
	setActiveTab: React.Dispatch<React.SetStateAction<ContentManagerTab>>;
	setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
	setFilterCompanyId: React.Dispatch<React.SetStateAction<string | null>>;
	setFilterProjectId: React.Dispatch<React.SetStateAction<string | null>>;
	setFilterFolderId: React.Dispatch<React.SetStateAction<string | null>>;
	setFilesBrowseMode: React.Dispatch<React.SetStateAction<FilesBrowseMode>>;
	setGroupBy: React.Dispatch<React.SetStateAction<GroupBy>>;
	setExplorerFolderTarget: React.Dispatch<
		React.SetStateAction<ExplorerFolderTarget>
	>;
	setExplorerExpandedFolderIds: React.Dispatch<
		React.SetStateAction<Set<string>>
	>;
	setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
	setFilterType: React.Dispatch<React.SetStateAction<string>>;
	setFilterVisibility: React.Dispatch<React.SetStateAction<FilterVisibility>>;
};

export function useContentManagerInitialScope({
	initialCabinetScope,
	initialDesktopFolderItemId,
	initialFilterSnapshot,
	fetchFolders,
	setActiveTab,
	setCurrentPage,
	setFilterCompanyId,
	setFilterProjectId,
	setFilterFolderId,
	setFilesBrowseMode,
	setGroupBy,
	setExplorerFolderTarget,
	setExplorerExpandedFolderIds,
	setSearchQuery,
	setFilterType,
	setFilterVisibility,
}: UseContentManagerInitialScopeOptions): void {
	const lastCabinetScopeKeyRef = useRef<string | null>(null);
	const hadCabinetInitialScopeRef = useRef(false);
	const desktopFolderAppliedRef = useRef<string | null>(null);
	const filterSnapshotAppliedRef = useRef<string | null>(null);

	useEffect(() => {
		const scope = initialCabinetScope;
		if (!scope?.projectId || !scope?.companyId) {
			lastCabinetScopeKeyRef.current = null;
			if (hadCabinetInitialScopeRef.current) {
				hadCabinetInitialScopeRef.current = false;
				setFilterCompanyId(null);
				setFilterProjectId(null);
			}
			return;
		}
		hadCabinetInitialScopeRef.current = true;
		const key = `${scope.projectId}\0${scope.companyId}\0${String(scope.cabinetView)}\0${scope.projectName ?? ''}`;
		if (lastCabinetScopeKeyRef.current === key) return;
		lastCabinetScopeKeyRef.current = key;
		setFilterCompanyId(scope.companyId);
		setFilterProjectId(scope.projectId);
		setFilesBrowseMode('explorer');
		setCurrentPage(1);
		const folderItemId = projectContentFolderItemId(scope.projectId);
		let cancelled = false;
		void (async () => {
			try {
				await ensureProjectDesktopFolder({
					projectId: scope.projectId,
					projectName: scope.projectName?.trim() || 'Project',
				});
				if (cancelled) return;
				await fetchFolders();
				if (!cancelled) setExplorerFolderTarget(folderItemId);
			} catch (error) {
				log.warn(
					'useContentManagerInitialScope',
					`cabinet scope folder: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [
		fetchFolders,
		initialCabinetScope,
		setCurrentPage,
		setExplorerFolderTarget,
		setFilesBrowseMode,
		setFilterCompanyId,
		setFilterProjectId,
	]);

	useEffect(() => {
		const raw = initialDesktopFolderItemId?.trim();
		if (!raw) {
			desktopFolderAppliedRef.current = null;
			return;
		}
		if (initialCabinetScope?.projectId && initialCabinetScope.companyId) return;
		if (desktopFolderAppliedRef.current === raw) return;
		desktopFolderAppliedRef.current = raw;
		setActiveTab('files');
		setCurrentPage(1);
		if (raw === 'content') {
			setFilesBrowseMode('all_files');
			setGroupBy('folder');
		} else {
			setFilesBrowseMode('explorer');
			setExplorerFolderTarget(raw);
			setExplorerExpandedFolderIds((current) => new Set(current).add(raw));
		}
	}, [
		initialCabinetScope,
		initialDesktopFolderItemId,
		setActiveTab,
		setCurrentPage,
		setExplorerExpandedFolderIds,
		setExplorerFolderTarget,
		setFilesBrowseMode,
		setGroupBy,
	]);

	useEffect(() => {
		if (initialCabinetScope?.projectId && initialCabinetScope.companyId) return;
		const snapshot = initialFilterSnapshot;
		if (
			!snapshot ||
			typeof snapshot !== 'object' ||
			Object.keys(snapshot).length === 0
		) {
			filterSnapshotAppliedRef.current = null;
			return;
		}
		const key = JSON.stringify(snapshot, Object.keys(snapshot).sort());
		if (filterSnapshotAppliedRef.current === key) return;
		filterSnapshotAppliedRef.current = key;
		setActiveTab('files');
		setCurrentPage(1);
		setSearchQuery(
			typeof snapshot.searchQuery === 'string' ? snapshot.searchQuery : ''
		);
		setFilterType(snapshot.filterType?.trim() || 'all');
		const allowedVisibility: FilterVisibility[] = [
			'all',
			'private',
			'shared',
			'friends',
			'from_friends',
		];
		const visibility = snapshot.filterVisibility?.trim();
		setFilterVisibility(
			visibility && allowedVisibility.includes(visibility as FilterVisibility)
				? (visibility as FilterVisibility)
				: 'all'
		);
		const companyId = snapshot.filterCompanyId?.trim();
		const projectId = snapshot.filterProjectId?.trim();
		const folderId = snapshot.filterFolderId?.trim();
		setFilterCompanyId(companyId || null);
		setFilterProjectId(projectId || null);
		setFilterFolderId(folderId || null);
		const rawMode = snapshot.filesBrowseMode?.trim();
		let mode: FilesBrowseMode | null =
			rawMode === 'catalog' || rawMode === 'explorer' || rawMode === 'all_files'
				? rawMode
				: null;
		const rawTarget = snapshot.explorerFolderTarget?.trim();
		if (!mode && rawTarget) mode = 'explorer';
		if (!mode && folderId) mode = 'catalog';
		if (mode) setFilesBrowseMode(mode);
		if (mode === 'explorer' && rawTarget) {
			const target: ExplorerFolderTarget =
				rawTarget === 'unfiled' ? 'unfiled' : rawTarget;
			setExplorerFolderTarget(target);
			if (target !== 'unfiled') {
				setExplorerExpandedFolderIds((current) => new Set(current).add(target));
			}
		}
	}, [
		initialCabinetScope,
		initialFilterSnapshot,
		setActiveTab,
		setCurrentPage,
		setExplorerExpandedFolderIds,
		setExplorerFolderTarget,
		setFilesBrowseMode,
		setFilterCompanyId,
		setFilterFolderId,
		setFilterProjectId,
		setFilterType,
		setFilterVisibility,
		setSearchQuery,
	]);
}
