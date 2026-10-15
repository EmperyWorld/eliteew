/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Global EWRP workspace keyboard shortcuts (Escape, /, r, Ctrl+S, Ctrl+Enter).
 *
 * Invariants:
 * - `/` opens history search only on presentations tab when not in text inputs.
 *
 * Related:
 * - `useEwrpGeneratorCompose.tsx`, `documentation/product/EWRP-EDITOR.md` §4.4
 */

import { useEffect } from 'react';
import type { EwrpSlide } from '@/services/ewrpApi';

export type UseEwrpGeneratorKeyboardParams = {
	mainTab: 'generate' | 'presentations';
	isHistoryModalOpen: boolean;
	isDocPickerOpen: boolean;
	submitting: boolean;
	formLocked: boolean;
	deleteTarget: { id: string; label: string } | null;
	historySearch: string;
	docPickerSearch: string;
	isEditing: boolean;
	draftSlides: EwrpSlide[] | null;
	saving: boolean;
	slideRebuildInProgress: boolean;
	closeHistoryModal: () => void;
	closeDocPickerModal: () => void;
	setHistorySearch: React.Dispatch<React.SetStateAction<string>>;
	setDocPickerSearch: React.Dispatch<React.SetStateAction<string>>;
	setIsHistoryModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
	refreshHistory: () => Promise<void>;
	handleSaveSlides: () => void;
	historySearchInputRef: React.RefObject<HTMLInputElement | null>;
};

export function useEwrpGeneratorKeyboard(
	params: UseEwrpGeneratorKeyboardParams
) {
	const {
		mainTab,
		isHistoryModalOpen,
		isDocPickerOpen,
		submitting,
		formLocked,
		deleteTarget,
		historySearch,
		docPickerSearch,
		isEditing,
		draftSlides,
		saving,
		slideRebuildInProgress,
		closeHistoryModal,
		closeDocPickerModal,
		setHistorySearch,
		setDocPickerSearch,
		setIsHistoryModalOpen,
		refreshHistory,
		handleSaveSlides,
		historySearchInputRef,
	} = params;

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && !e.metaKey && !e.ctrlKey) {
				if (deleteTarget) return;
				if (isHistoryModalOpen) {
					const ae = document.activeElement as HTMLElement | null;
					if (ae?.id === 'ewrp-history-search' && historySearch.trim()) {
						e.preventDefault();
						setHistorySearch('');
						return;
					}
					e.preventDefault();
					closeHistoryModal();
					return;
				}
				if (isDocPickerOpen) {
					const ae = document.activeElement as HTMLElement | null;
					if (ae?.id === 'ewrp-doc-picker-search' && docPickerSearch.trim()) {
						e.preventDefault();
						setDocPickerSearch('');
						return;
					}
					e.preventDefault();
					closeDocPickerModal();
					return;
				}
			}
			if (
				e.key === '/' &&
				!e.metaKey &&
				!e.ctrlKey &&
				!e.altKey &&
				!e.shiftKey
			) {
				if (mainTab !== 'presentations') return;
				if (isDocPickerOpen || deleteTarget) return;
				const el = document.activeElement as HTMLElement | null;
				if (
					el?.tagName === 'TEXTAREA' ||
					el?.tagName === 'SELECT' ||
					el?.isContentEditable
				) {
					return;
				}
				if (el?.tagName === 'INPUT' && el.id !== 'ewrp-history-search') {
					return;
				}
				e.preventDefault();
				if (!isHistoryModalOpen) {
					setIsHistoryModalOpen(true);
				}
				window.setTimeout(() => {
					historySearchInputRef.current?.focus();
				}, 50);
				return;
			}
			if (
				(e.key === 'r' || e.key === 'R') &&
				!e.metaKey &&
				!e.ctrlKey &&
				!e.altKey
			) {
				if (isDocPickerOpen || deleteTarget) return;
				const el = document.activeElement as HTMLElement | null;
				if (
					el?.tagName === 'TEXTAREA' ||
					el?.tagName === 'SELECT' ||
					el?.isContentEditable
				) {
					return;
				}
				if (el?.tagName === 'INPUT') return;
				e.preventDefault();
				void refreshHistory();
				return;
			}
			if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
				if (mainTab !== 'presentations' || !isEditing || !draftSlides) return;
				if (isHistoryModalOpen || isDocPickerOpen || deleteTarget) return;
				if (document.activeElement?.closest('[data-ewrp-ignore-hotkey]'))
					return;
				if (saving || slideRebuildInProgress) {
					e.preventDefault();
					return;
				}
				e.preventDefault();
				void handleSaveSlides();
				return;
			}
			if (!(e.metaKey || e.ctrlKey) || e.key !== 'Enter') return;
			if (isDocPickerOpen || submitting || deleteTarget) return;
			if (formLocked) return;
			const formEl = document.getElementById('ewrp-generator-form');
			if (!formEl?.contains(document.activeElement as Node)) return;
			e.preventDefault();
			(formEl as HTMLFormElement).requestSubmit();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [
		mainTab,
		isHistoryModalOpen,
		isDocPickerOpen,
		submitting,
		formLocked,
		deleteTarget,
		refreshHistory,
		docPickerSearch,
		historySearch,
		isEditing,
		draftSlides,
		saving,
		slideRebuildInProgress,
		handleSaveSlides,
		closeHistoryModal,
		closeDocPickerModal,
		setHistorySearch,
		setDocPickerSearch,
		setIsHistoryModalOpen,
		historySearchInputRef,
	]);
}
