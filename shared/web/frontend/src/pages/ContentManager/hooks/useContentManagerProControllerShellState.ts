/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Local UI state, refs, and tab remount keys for Content Manager Pro controller (Wave 4b).
 *
 * Invariants:
 * - Desktop guide tour stays disabled on mobile embedded layout.
 *
 * Related:
 * - useContentManagerProController.ts
 */
import { useCallback, useRef, useState } from 'react';
import { useDesktopGuideTourOpener } from '../../Desktop/hooks/useDesktopGuideTourOpener';
import type { ContentManagerTab } from '../contentManagerTypes';

export type UseContentManagerProControllerShellStateParams = {
	embeddedMobileLayout: boolean;
	initialActiveTab?: ContentManagerTab | null;
};

export function useContentManagerProControllerShellState({
	embeddedMobileLayout,
	initialActiveTab = null,
}: UseContentManagerProControllerShellStateParams) {
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<ContentManagerTab>(
		initialActiveTab ?? 'files'
	);
	const [statsTabKey, setStatsTabKey] = useState(0);
	const [tagsTabKey, setTagsTabKey] = useState(0);
	const [versionsTabKey, setVersionsTabKey] = useState(0);
	const [sharedTabKey, setSharedTabKey] = useState(0);
	const [commentsTabKey, setCommentsTabKey] = useState(0);
	const [duplicatesTabKey, setDuplicatesTabKey] = useState(0);
	const [brokenFilesTabKey, setBrokenFilesTabKey] = useState(0);
	const [contentGuideOpen, setContentGuideOpen] = useState(false);
	const openContentGuideTour = useCallback(() => setContentGuideOpen(true), []);
	useDesktopGuideTourOpener(openContentGuideTour, {
		enabled: !embeddedMobileLayout,
	});

	const [advancedError, setAdvancedError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const rootRef = useRef<HTMLElement | null>(null);
	const searchInputRef = useRef<HTMLInputElement | null>(null);
	const [pendingOpenContentId, setPendingOpenContentId] = useState<
		string | null
	>(null);
	const [assignTenancyOpen, setAssignTenancyOpen] = useState(false);
	const [assignCompanyId, setAssignCompanyId] = useState('');
	const [assignProjectId, setAssignProjectId] = useState('');
	const [assignTenancyLoading, setAssignTenancyLoading] = useState(false);
	const [clientMinFileSize, setClientMinFileSize] = useState<number | null>(
		null
	);
	const [clientProcessingStatusFilter, setClientProcessingStatusFilter] =
		useState<string | null>(null);
	const [currentPage, setCurrentPage] = useState(1);

	return {
		error,
		setError,
		success,
		setSuccess,
		activeTab,
		setActiveTab,
		statsTabKey,
		setStatsTabKey,
		tagsTabKey,
		setTagsTabKey,
		versionsTabKey,
		setVersionsTabKey,
		sharedTabKey,
		setSharedTabKey,
		commentsTabKey,
		setCommentsTabKey,
		duplicatesTabKey,
		setDuplicatesTabKey,
		brokenFilesTabKey,
		setBrokenFilesTabKey,
		contentGuideOpen,
		setContentGuideOpen,
		advancedError,
		setAdvancedError,
		fileInputRef,
		rootRef,
		searchInputRef,
		pendingOpenContentId,
		setPendingOpenContentId,
		assignTenancyOpen,
		setAssignTenancyOpen,
		assignCompanyId,
		setAssignCompanyId,
		assignProjectId,
		setAssignProjectId,
		assignTenancyLoading,
		setAssignTenancyLoading,
		clientMinFileSize,
		setClientMinFileSize,
		clientProcessingStatusFilter,
		setClientProcessingStatusFilter,
		currentPage,
		setCurrentPage,
	};
}

export type ContentManagerProControllerShellState = ReturnType<
	typeof useContentManagerProControllerShellState
>;
