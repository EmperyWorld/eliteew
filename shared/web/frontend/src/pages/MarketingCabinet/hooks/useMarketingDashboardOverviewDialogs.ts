import * as React from 'react';

import { useMarketingDialogFocusTrap } from './useMarketingDialogFocusTrap';
import type { MarketingDashboardWidget } from '../marketingCabinetApi';
import type { DashboardGridContextMenu } from '../views/MarketingDashboardGridContextMenu';
import { useDashboardGridContextMenuEffects } from '../views/MarketingDashboardGridContextMenu';

/**
 * Состояние модалок/контекстного меню интерактивного дашборда: refs, focus-trap, ESC.
 * JSX порталов остаётся в {@link OverviewInteractiveDashboard} / MarketingDashboardOverviewDialogPortals.
 */
export function useMarketingDashboardOverviewDialogs({
	saveTemplateOpen,
	setSaveTemplateOpen,
	setPresetSelectValue,
}: {
	saveTemplateOpen: boolean;
	setSaveTemplateOpen: React.Dispatch<React.SetStateAction<boolean>>;
	setPresetSelectValue: React.Dispatch<React.SetStateAction<string>>;
}) {
	const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
	const shortcutsPanelRef = React.useRef<HTMLDivElement>(null);
	const shortcutsTitleId = React.useId();
	const shortcutsDescId = React.useId();
	useMarketingDialogFocusTrap(shortcutsPanelRef, shortcutsOpen);

	const [presetApplyDialog, setPresetApplyDialog] = React.useState<{
		name: string;
		label: string;
	} | null>(null);
	const presetApplyPanelRef = React.useRef<HTMLDivElement>(null);
	const presetApplyTitleId = React.useId();
	const presetApplyIntroId = React.useId();
	const presetApplyListId = React.useId();
	const presetApplyRemovedIntroId = React.useId();
	const presetApplyRemovedListId = React.useId();
	useMarketingDialogFocusTrap(presetApplyPanelRef, presetApplyDialog !== null);

	const [renameTarget, setRenameTarget] =
		React.useState<MarketingDashboardWidget | null>(null);
	const [renameDraft, setRenameDraft] = React.useState('');
	const renamePanelRef = React.useRef<HTMLDivElement>(null);
	const renameTitleId = React.useId();
	const renameHintId = React.useId();
	const renameFieldId = React.useId();
	useMarketingDialogFocusTrap(renamePanelRef, renameTarget !== null);

	const [gridContextMenu, setGridContextMenu] =
		React.useState<DashboardGridContextMenu | null>(null);
	const contextMenuRef = React.useRef<HTMLDivElement>(null);
	const renameInputRef = React.useRef<HTMLInputElement>(null);
	const renameOpenerRef = React.useRef<HTMLElement | null>(null);
	useMarketingDialogFocusTrap(contextMenuRef, gridContextMenu !== null);
	useDashboardGridContextMenuEffects(
		gridContextMenu,
		setGridContextMenu,
		contextMenuRef
	);

	const saveTemplatePanelRef = React.useRef<HTMLDivElement>(null);
	const saveTemplateNameInputRef = React.useRef<HTMLInputElement>(null);
	const saveTemplateTitleId = React.useId();
	const saveTemplateNameFieldId = React.useId();
	const saveTemplateDescFieldId = React.useId();
	const saveTemplateDialogDescId = React.useId();
	const layoutTemplateSelectId = React.useId();
	const layoutTemplatesCaveatId = React.useId();
	useMarketingDialogFocusTrap(saveTemplatePanelRef, saveTemplateOpen);

	const closeRenameModal = React.useCallback(() => {
		const opener = renameOpenerRef.current;
		renameOpenerRef.current = null;
		setRenameTarget(null);
		requestAnimationFrame(() => {
			if (opener && document.contains(opener)) {
				opener.focus();
			}
		});
	}, []);

	React.useEffect(() => {
		if (!renameTarget) return;
		setRenameDraft(renameTarget.widget_title);
	}, [renameTarget]);

	React.useEffect(() => {
		if (!renameTarget) return;
		const id = window.requestAnimationFrame(() => {
			renameInputRef.current?.focus();
			renameInputRef.current?.select();
		});
		return () => window.cancelAnimationFrame(id);
	}, [renameTarget]);

	React.useEffect(() => {
		if (!renameTarget) return;
		const onEsc = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				closeRenameModal();
			}
		};
		window.addEventListener('keydown', onEsc);
		return () => window.removeEventListener('keydown', onEsc);
	}, [renameTarget, closeRenameModal]);

	React.useEffect(() => {
		if (!saveTemplateOpen) return;
		const id = window.requestAnimationFrame(() => {
			saveTemplateNameInputRef.current?.focus();
		});
		return () => window.cancelAnimationFrame(id);
	}, [saveTemplateOpen]);

	React.useEffect(() => {
		if (!saveTemplateOpen) return;
		const onEsc = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				setSaveTemplateOpen(false);
			}
		};
		window.addEventListener('keydown', onEsc);
		return () => window.removeEventListener('keydown', onEsc);
	}, [saveTemplateOpen, setSaveTemplateOpen]);

	React.useEffect(() => {
		if (!shortcutsOpen) return;
		const onEsc = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				setShortcutsOpen(false);
			}
		};
		window.addEventListener('keydown', onEsc);
		return () => window.removeEventListener('keydown', onEsc);
	}, [shortcutsOpen]);

	React.useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== '?') return;
			const el = e.target;
			if (
				el instanceof HTMLElement &&
				el.closest('input, textarea, select, [contenteditable="true"]')
			) {
				return;
			}
			e.preventDefault();
			setShortcutsOpen((open) => !open);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	React.useEffect(() => {
		if (!presetApplyDialog) {
			return;
		}
		const onEsc = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				setPresetApplyDialog(null);
				setPresetSelectValue('');
			}
		};
		window.addEventListener('keydown', onEsc);
		return () => window.removeEventListener('keydown', onEsc);
	}, [presetApplyDialog, setPresetSelectValue]);

	return {
		shortcutsOpen,
		setShortcutsOpen,
		shortcutsPanelRef,
		shortcutsTitleId,
		shortcutsDescId,
		presetApplyDialog,
		setPresetApplyDialog,
		presetApplyPanelRef,
		presetApplyTitleId,
		presetApplyIntroId,
		presetApplyListId,
		presetApplyRemovedIntroId,
		presetApplyRemovedListId,
		renameTarget,
		setRenameTarget,
		renameDraft,
		setRenameDraft,
		renamePanelRef,
		renameTitleId,
		renameHintId,
		renameFieldId,
		renameInputRef,
		renameOpenerRef,
		closeRenameModal,
		gridContextMenu,
		setGridContextMenu,
		contextMenuRef,
		saveTemplatePanelRef,
		saveTemplateNameInputRef,
		saveTemplateTitleId,
		saveTemplateNameFieldId,
		saveTemplateDescFieldId,
		saveTemplateDialogDescId,
		layoutTemplateSelectId,
		layoutTemplatesCaveatId,
	};
}
