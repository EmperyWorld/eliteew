/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owns progressive-disclosure state and intent synchronization for Start Menu
 * tabs, keeping close and Escape unwind ordering outside rendered sections.
 *
 * Invariants:
 * - An intent nonce is consumed at most once and expands the required disclosure.
 * - Work intents also expand advanced work surfaces (`showWorkAdvanced`).
 * - Recent intents select the Recent tab only — library stays collapsed until the user toggles it (Wave 1 progressive Cause).
 * - Secondary tab intents (pinned/recent/work) select the tab without opening More menu.
 * - Legacy `categories` intent resolves to `all` (P19 search-first).
 * - Closing the menu resets all progressive-disclosure layers.
 *
 * Related:
 * - ../StartMenu.tsx
 * - ./__tests__/useStartMenuDisclosure.test.ts
 * - ../../types/desktopStartMenu.ts
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
	resolveStartMenuTab,
	type StartMenuTab,
} from '../../types/desktopStartMenu';

export type StartMenuIntent = { tab: StartMenuTab; nonce: number };

export function useStartMenuDisclosure(
	isOpen: boolean,
	intent: StartMenuIntent | undefined,
	setActiveTab: (tab: StartMenuTab) => void,
	setSearch: (search: string) => void
) {
	const [showMoreTabs, setShowMoreTabs] = useState(false);
	const [showLibraryDiscovery, setShowLibraryDiscovery] = useState(false);
	const [showWorkAdvanced, setShowWorkAdvanced] = useState(false);
	const lastIntentNonceRef = useRef(0);

	const resetDisclosure = useCallback(() => {
		setShowMoreTabs(false);
		setShowLibraryDiscovery(false);
		setShowWorkAdvanced(false);
	}, []);

	useEffect(() => {
		if (isOpen) return;
		resetDisclosure();
	}, [isOpen, resetDisclosure]);

	useEffect(() => {
		if (!isOpen || !intent || intent.nonce <= lastIntentNonceRef.current) {
			return;
		}
		lastIntentNonceRef.current = intent.nonce;
		const tab = resolveStartMenuTab(intent.tab);
		if (tab === 'work') {
			setShowWorkAdvanced(true);
		}
		if (tab === 'work' || tab === 'pinned' || tab === 'recent') {
			setShowMoreTabs(false);
		}
		setActiveTab(tab);
		setSearch('');
	}, [intent, isOpen, setActiveTab, setSearch]);

	return {
		showMoreTabs,
		setShowMoreTabs,
		showLibraryDiscovery,
		setShowLibraryDiscovery,
		showWorkAdvanced,
		setShowWorkAdvanced,
		resetDisclosure,
		lastIntentNonceRef,
	};
}
