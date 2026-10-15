import type { Dispatch, SetStateAction } from 'react';
import { useEffect } from 'react';
import {
	CONTENT_MANAGER_URL_TABS,
	type ContentManagerTab,
	type FilterVisibility,
} from '../contentManagerTypes';

export type UseContentManagerUrlSyncParams = {
	embedded: boolean;
	activeTab: ContentManagerTab;
	setActiveTab: Dispatch<SetStateAction<ContentManagerTab>>;
	filterType: string;
	setFilterType: Dispatch<SetStateAction<string>>;
	filterVisibility: FilterVisibility;
	setFilterVisibility: Dispatch<SetStateAction<FilterVisibility>>;
};

/**
 * Read `cm_tab`, `cm_ft`, `cm_fv` from URL on mount; keep URL in sync with tab + filters (replaceState).
 */
export function useContentManagerUrlSync({
	embedded,
	activeTab,
	setActiveTab,
	filterType,
	setFilterType,
	filterVisibility,
	setFilterVisibility,
}: UseContentManagerUrlSyncParams): void {
	useEffect(() => {
		if (embedded || typeof window === 'undefined') return;
		const params = new URLSearchParams(window.location.search);
		const tab = params.get('cm_tab');
		if (tab && CONTENT_MANAGER_URL_TABS.has(tab as ContentManagerTab)) {
			setActiveTab(tab as ContentManagerTab);
		}
		const ft = params.get('cm_ft');
		if (ft != null && ft !== '') setFilterType(ft);
		const fv = params.get('cm_fv');
		if (
			fv === 'all' ||
			fv === 'private' ||
			fv === 'shared' ||
			fv === 'friends' ||
			fv === 'from_friends'
		) {
			setFilterVisibility(fv);
		}
	}, [embedded, setActiveTab, setFilterType, setFilterVisibility]);

	useEffect(() => {
		if (embedded || typeof window === 'undefined') return;
		const params = new URLSearchParams(window.location.search);
		const setOrDelete = (k: string, v: string, defaultVal: string): void => {
			if (v === defaultVal || v === '') params.delete(k);
			else params.set(k, v);
		};
		setOrDelete('cm_tab', activeTab, 'files');
		setOrDelete('cm_ft', filterType, 'all');
		setOrDelete('cm_fv', filterVisibility, 'all');
		const qs = params.toString();
		const next = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
		const cur = `${window.location.pathname}${window.location.search}`;
		if (next !== cur) window.history.replaceState({}, '', next);
	}, [embedded, activeTab, filterType, filterVisibility]);
}
