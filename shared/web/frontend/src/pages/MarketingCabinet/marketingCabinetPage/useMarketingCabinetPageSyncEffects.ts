/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sync/layout effects for MarketingCabinetPage: title, project/team resets, sidebar, content.
 *
 * Invariants:
 * - Content auto-select runs only when shouldLoadProjectContent is true.
 *
 * Related:
 * - useMarketingCabinetPageCompose.ts, useMarketingCabinetNavigation.ts
 */

import { useEffect, type MutableRefObject } from 'react';
import type { TFunction } from 'i18next';
import type {
	MarketingCompany,
	MarketingContentItem,
	MarketingProject,
} from '@/pages/MarketingCabinet/marketingCabinetApi';
import type { ProjectFormState } from '@/pages/MarketingCabinet/marketingCabinetPageTypes';
import {
	MARKETING_SIDEBAR_COMPACT_STORAGE_KEY,
	MARKETING_SIDEBAR_PINNED_STORAGE_KEY,
} from '@/pages/MarketingCabinet/marketingCabinetPageHelpers';
import type { MarketingCabinetSidebarNavLayoutMode } from '@/pages/MarketingCabinet/shell/MarketingCabinetSidebar';

type LooseFn = {
	// biome-ignore lint/suspicious/noExplicitAny: sync/compose seam — bivariant setter host
	bivarianceHack(...args: any[]): any;
}['bivarianceHack'];

type SyncEffectsInput = {
	t: TFunction<'marketing'>;
	activeView: string;
	selectedProjectId: string | null;
	previousProjectIdRef: MutableRefObject<string | null>;
	setFocusedEntityId: LooseFn;
	setSelectedContentId: LooseFn;
	setSelectedJobStoryIds: LooseFn;
	setTeamInviteUserId: LooseFn;
	setTeamInviteRole: LooseFn;
	setTeamAccessMemberId: LooseFn;
	setTeamAccessDraft: LooseFn;
	setTeamRemoveConfirm: LooseFn;
	setTeamTransferConfirm: LooseFn;
	setTransferLeadToUserId: LooseFn;
	teamAccessOpenMemberIdRef: MutableRefObject<string | null>;
	teamAccessMemberId: string | null;
	sidebarNavLayoutMode: MarketingCabinetSidebarNavLayoutMode;
	setIsSidebarHovered: (v: boolean) => void;
	setIsSidebarFocusWithin: (v: boolean) => void;
	sidebarModules: Array<{ id: string }>;
	setActiveView: LooseFn;
	contentItems: MarketingContentItem[];
	contentQueryIsLoading: boolean;
	selectedContentId: string | null;
	shouldLoadProjectContent: boolean;
	setCreatingCompany: LooseFn;
	setEditingCompany: LooseFn;
	setCreatingProject: LooseFn;
	setEditingProject: LooseFn;
	contentScrollRef: MutableRefObject<HTMLElement | null>;
	setShowScrollTop: (v: boolean) => void;
	skipFocusModuleTitleOnMountRef: MutableRefObject<boolean>;
	editingCompany: MarketingCompany | null;
	setCompanyForm: LooseFn;
	editingProject: MarketingProject | null;
	setProjectForm: LooseFn;
	setEditingProjectState: LooseFn;
};

export function useMarketingCabinetPageSyncEffects(input: SyncEffectsInput) {
	const {
		t,
		activeView,
		selectedProjectId,
		previousProjectIdRef,
		setFocusedEntityId,
		setSelectedContentId,
		setSelectedJobStoryIds,
		setTeamInviteUserId,
		setTeamInviteRole,
		setTeamAccessMemberId,
		setTeamAccessDraft,
		setTeamRemoveConfirm,
		setTeamTransferConfirm,
		setTransferLeadToUserId,
		teamAccessOpenMemberIdRef,
		teamAccessMemberId,
		sidebarNavLayoutMode,
		setIsSidebarHovered,
		setIsSidebarFocusWithin,
		sidebarModules,
		setActiveView,
		contentItems,
		contentQueryIsLoading,
		selectedContentId,
		shouldLoadProjectContent,
		setCreatingCompany,
		setEditingCompany,
		setCreatingProject,
		setEditingProject,
		contentScrollRef,
		setShowScrollTop,
		skipFocusModuleTitleOnMountRef,
		editingCompany,
		setCompanyForm,
		editingProject,
		setProjectForm,
		setEditingProjectState,
	} = input;

	useEffect(() => {
		const prev = document.title;
		document.title = t('pageTitle');
		return () => {
			document.title = prev;
		};
	}, [t]);

	useEffect(() => {
		if (previousProjectIdRef.current !== selectedProjectId) {
			setFocusedEntityId(null);
			setSelectedContentId(null);
			setSelectedJobStoryIds([]);
			previousProjectIdRef.current = selectedProjectId;
		}
	}, [
		selectedProjectId,
		setFocusedEntityId,
		setSelectedContentId,
		setSelectedJobStoryIds,
		previousProjectIdRef,
	]);

	useEffect(() => {
		void selectedProjectId;
		setTeamInviteUserId(null);
		setTeamInviteRole('member');
		setTeamAccessMemberId(null);
		setTeamAccessDraft(null);
		setTeamRemoveConfirm(null);
		setTeamTransferConfirm(null);
		setTransferLeadToUserId('');
	}, [
		selectedProjectId,
		setTeamAccessDraft,
		setTeamAccessMemberId,
		setTeamInviteRole,
		setTeamInviteUserId,
		setTeamRemoveConfirm,
		setTeamTransferConfirm,
		setTransferLeadToUserId,
	]);

	useEffect(() => {
		teamAccessOpenMemberIdRef.current = teamAccessMemberId;
	}, [teamAccessMemberId, teamAccessOpenMemberIdRef]);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		try {
			if (sidebarNavLayoutMode === 'pinned_expanded') {
				window.localStorage.setItem(MARKETING_SIDEBAR_PINNED_STORAGE_KEY, '1');
				window.localStorage.removeItem(MARKETING_SIDEBAR_COMPACT_STORAGE_KEY);
			} else if (sidebarNavLayoutMode === 'icon_rail') {
				window.localStorage.setItem(MARKETING_SIDEBAR_COMPACT_STORAGE_KEY, '1');
				window.localStorage.removeItem(MARKETING_SIDEBAR_PINNED_STORAGE_KEY);
			} else {
				window.localStorage.removeItem(MARKETING_SIDEBAR_PINNED_STORAGE_KEY);
				window.localStorage.removeItem(MARKETING_SIDEBAR_COMPACT_STORAGE_KEY);
			}
		} catch {
			// Keep navigation functional even when storage is unavailable.
		}
	}, [sidebarNavLayoutMode]);

	useEffect(() => {
		if (sidebarNavLayoutMode === 'icon_rail') {
			setIsSidebarHovered(false);
			setIsSidebarFocusWithin(false);
		}
	}, [sidebarNavLayoutMode, setIsSidebarFocusWithin, setIsSidebarHovered]);

	useEffect(() => {
		if (activeView === 'overview_dashboard') {
			const can =
				sidebarModules.some((m) => m.id === 'overview_dashboard') &&
				Boolean(selectedProjectId);
			if (!can) {
				const fallback =
					sidebarModules.find((m) => m.id === 'overview')?.id ??
					sidebarModules[0]?.id;
				if (fallback) setActiveView(fallback);
			}
			return;
		}
		if (!sidebarModules.some((m) => m.id === activeView)) {
			const fallback = sidebarModules[0]?.id;
			if (fallback) setActiveView(fallback);
		}
	}, [sidebarModules, activeView, setActiveView, selectedProjectId]);

	useEffect(() => {
		if (!selectedProjectId) {
			if (selectedContentId) {
				setSelectedContentId(null);
			}
			return;
		}
		if (!shouldLoadProjectContent) {
			return;
		}
		if (!contentItems.length) {
			if (!contentQueryIsLoading && selectedContentId) {
				setSelectedContentId(null);
			}
			return;
		}
		if (!selectedContentId) {
			setSelectedContentId(contentItems[0]?.id ?? null);
			return;
		}
		if (!contentItems.some((item) => item.id === selectedContentId)) {
			setSelectedContentId(contentItems[0]?.id ?? null);
		}
	}, [
		contentItems,
		contentQueryIsLoading,
		selectedContentId,
		selectedProjectId,
		setSelectedContentId,
		shouldLoadProjectContent,
	]);

	useEffect(() => {
		if (activeView !== 'companies') {
			setCreatingCompany(false);
			setEditingCompany(null);
		}
	}, [activeView, setCreatingCompany, setEditingCompany]);

	useEffect(() => {
		if (activeView !== 'projects') {
			setCreatingProject(false);
			setEditingProject(null);
		}
	}, [activeView, setCreatingProject, setEditingProject]);

	useEffect(() => {
		const el = contentScrollRef.current;
		if (!el) return;
		const onScroll = () => setShowScrollTop(el.scrollTop > 120);
		onScroll();
		el.addEventListener('scroll', onScroll, { passive: true });
		return () => el.removeEventListener('scroll', onScroll);
	}, [contentScrollRef, setShowScrollTop]);

	useEffect(() => {
		if (skipFocusModuleTitleOnMountRef.current) {
			skipFocusModuleTitleOnMountRef.current = false;
			return;
		}
		queueMicrotask(() => {
			document.getElementById('marketing-cabinet-module-title')?.focus();
		});
	}, [skipFocusModuleTitleOnMountRef]);

	useEffect(() => {
		if (editingCompany) {
			const rep = editingCompany.representative_user_id?.trim() || null;
			setCompanyForm({
				name: editingCompany.name,
				industry: editingCompany.industry ?? '',
				website: editingCompany.website ?? '',
				description: editingCompany.description ?? '',
				size: editingCompany.size || 'small',
				representativeUserId: rep,
				representativeDeferred: !rep,
			});
		} else {
			setCompanyForm({
				name: '',
				industry: '',
				website: '',
				description: '',
				size: 'small',
				representativeUserId: null,
				representativeDeferred: true,
			});
		}
	}, [editingCompany, setCompanyForm]);

	useEffect(() => {
		if (editingProject) {
			setProjectForm({
				name: editingProject.name,
				description: editingProject.description ?? '',
				goals: editingProject.goals ?? '',
				key_tasks: editingProject.key_tasks ?? '',
				category:
					(editingProject.category as ProjectFormState['category']) ||
					'marketing_campaign',
				priority:
					(editingProject.priority as ProjectFormState['priority']) || 'medium',
			});
		} else {
			setProjectForm({
				name: '',
				description: '',
				goals: '',
				key_tasks: '',
				category: 'marketing_campaign',
				priority: 'medium',
			});
		}
	}, [editingProject, setProjectForm]);

	useEffect(() => {
		setEditingProjectState(null);
	}, [setEditingProjectState]);
}
