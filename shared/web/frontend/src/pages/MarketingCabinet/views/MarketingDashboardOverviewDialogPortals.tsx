import { cn } from '@/utils/cn';
import * as React from 'react';
import { createPortal } from 'react-dom';
import {
	DesktopAppButton,
	DesktopAppInput,
	DESKTOP_APP_STYLE_CONTRACT,
} from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import type { PresetApplyDiffPreview } from '../dashboard-widgets/buildPresetApplyDiffPreview';
import type { MarketingDashboardWidget } from '../marketingCabinetApi';

const SHORTCUT_TIP_KEYS = [
	'overview.dashboard.toolbar.shortcutTipDrag',
	'overview.dashboard.toolbar.shortcutTipPreset',
	'overview.dashboard.toolbar.shortcutTipAdd',
	'overview.dashboard.toolbar.shortcutTipLock',
	'overview.dashboard.toolbar.shortcutTipTileResize',
	'overview.dashboard.toolbar.shortcutTipUndo',
	'overview.dashboard.toolbar.shortcutTipHelp',
] as const;

function modalOverlayClass() {
	return 'fixed inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.45)] p-4 backdrop-blur-[2px]';
}

export type MarketingDashboardPresetApplyDialogPortalProps = {
	presetApplyDialog: { name: string; label: string } | null;
	presetApplyDiffPreview: PresetApplyDiffPreview | null;
	presetApplyPanelRef: React.RefObject<HTMLDivElement | null>;
	presetApplyTitleId: string;
	presetApplyIntroId: string;
	presetApplyListId: string;
	presetApplyRemovedIntroId: string;
	presetApplyRemovedListId: string;
	onDismiss: () => void;
	toolbarBusy: boolean;
	onConfirmApply: () => void;
	t: (key: string, options?: Record<string, unknown>) => string;
};

export function MarketingDashboardPresetApplyDialogPortal({
	presetApplyDialog,
	presetApplyDiffPreview,
	presetApplyPanelRef,
	presetApplyTitleId,
	presetApplyIntroId,
	presetApplyListId,
	presetApplyRemovedIntroId,
	presetApplyRemovedListId,
	onDismiss,
	toolbarBusy,
	onConfirmApply,
	t,
}: MarketingDashboardPresetApplyDialogPortalProps) {
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	if (!presetApplyDialog || typeof document === 'undefined') {
		return null;
	}

	const diff = presetApplyDiffPreview;
	const hasRemoved =
		diff?.hasResolvableTemplate && diff.notInPresetRows.length > 0;
	const describedByIds = [presetApplyIntroId, presetApplyListId];
	if (hasRemoved) {
		describedByIds.push(presetApplyRemovedIntroId, presetApplyRemovedListId);
	}

	return createPortal(
		// biome-ignore lint/a11y/noStaticElementInteractions: оверлей закрытия модалки по клику вне панели
		<div
			className={modalOverlayClass()}
			style={{ zIndex: embeddedModalZ.backdrop }}
			role="presentation"
			tabIndex={-1}
			onClick={onDismiss}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onDismiss();
				}
			}}
		>
			<div
				ref={presetApplyPanelRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={presetApplyTitleId}
				aria-describedby={describedByIds.join(' ')}
				className={cn(
					DESKTOP_APP_STYLE_CONTRACT.panelStrong,
					'max-h-[min(85vh,32rem)] w-full max-w-md overflow-y-auto rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) p-4 shadow-(--desktop-shadow-panel)'
				)}
				style={{ zIndex: embeddedModalZ.content }}
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				<div className="mb-3 flex items-start justify-between gap-2">
					<h2
						id={presetApplyTitleId}
						className={cn(
							'm-0 text-base font-semibold',
							DESKTOP_TYPOGRAPHY.body
						)}
					>
						{t('overview.dashboard.toolbar.presetPreviewTitle', {
							name: presetApplyDialog.label,
						})}
					</h2>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className="shrink-0"
						onClick={onDismiss}
					>
						{t('close')}
					</DesktopAppButton>
				</div>
				<p
					id={presetApplyIntroId}
					className={cn('mb-2 text-sm', DESKTOP_TYPOGRAPHY.meta)}
				>
					{t('overview.dashboard.toolbar.presetPreviewIntro')}
				</p>
				{diff?.hasResolvableTemplate && diff.inPresetRows.length > 0 ? (
					<ul
						id={presetApplyListId}
						className={cn(
							'mb-4 max-h-[40vh] list-disc space-y-1 overflow-y-auto pl-5 text-sm',
							DESKTOP_TYPOGRAPHY.body
						)}
					>
						{diff.inPresetRows.map((row) => (
							<li key={`${presetApplyDialog.name}::in::${row}`}>{row}</li>
						))}
					</ul>
				) : (
					<p
						id={presetApplyListId}
						className={cn('mb-4 text-sm', DESKTOP_TYPOGRAPHY.meta)}
					>
						{t('overview.dashboard.toolbar.presetPreviewUnknown')}
					</p>
				)}
				{diff?.hasResolvableTemplate && diff.notInPresetRows.length > 0 ? (
					<>
						<p
							id={presetApplyRemovedIntroId}
							className={cn(
								'mb-2 border-l-2 border-(--mc-accent)/40 pl-2 text-sm',
								DESKTOP_TYPOGRAPHY.body
							)}
						>
							{t('overview.dashboard.toolbar.presetPreviewRemovedIntro')}
						</p>
						<ul
							id={presetApplyRemovedListId}
							className={cn(
								'mb-4 max-h-[32vh] list-disc space-y-1 overflow-y-auto pl-5 text-sm',
								DESKTOP_TYPOGRAPHY.body
							)}
						>
							{diff.notInPresetRows.map((row) => (
								<li key={`${presetApplyDialog.name}::out::${row}`}>{row}</li>
							))}
						</ul>
					</>
				) : null}
				<div className="flex flex-wrap justify-end gap-2">
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						onClick={onDismiss}
					>
						{t('overview.dashboard.toolbar.presetPreviewCancel')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						disabled={toolbarBusy}
						onClick={onConfirmApply}
					>
						{t('overview.dashboard.toolbar.presetPreviewApply')}
					</DesktopAppButton>
				</div>
			</div>
		</div>,
		document.body
	);
}

export type MarketingDashboardShortcutsDialogPortalProps = {
	shortcutsOpen: boolean;
	shortcutsPanelRef: React.RefObject<HTMLDivElement | null>;
	shortcutsTitleId: string;
	shortcutsDescId: string;
	onDismiss: () => void;
	t: (key: string, options?: Record<string, unknown>) => string;
};

export function MarketingDashboardShortcutsDialogPortal({
	shortcutsOpen,
	shortcutsPanelRef,
	shortcutsTitleId,
	shortcutsDescId,
	onDismiss,
	t,
}: MarketingDashboardShortcutsDialogPortalProps) {
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	if (!shortcutsOpen || typeof document === 'undefined') {
		return null;
	}

	return createPortal(
		// biome-ignore lint/a11y/noStaticElementInteractions: оверлей закрытия модалки по клику вне панели
		<div
			className={modalOverlayClass()}
			style={{ zIndex: embeddedModalZ.backdrop }}
			role="presentation"
			tabIndex={-1}
			onClick={onDismiss}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onDismiss();
				}
			}}
		>
			<div
				ref={shortcutsPanelRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={shortcutsTitleId}
				aria-describedby={shortcutsDescId}
				className={cn(
					DESKTOP_APP_STYLE_CONTRACT.panelStrong,
					'max-h-[min(85vh,32rem)] w-full max-w-md overflow-y-auto rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) p-4 shadow-(--desktop-shadow-panel)'
				)}
				style={{ zIndex: embeddedModalZ.content }}
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				<div className="mb-3 flex items-start justify-between gap-2">
					<h2
						id={shortcutsTitleId}
						className={cn(
							'm-0 text-base font-semibold',
							DESKTOP_TYPOGRAPHY.body
						)}
					>
						{t('overview.dashboard.toolbar.shortcutsDialogTitle')}
					</h2>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className="shrink-0"
						onClick={onDismiss}
					>
						{t('close')}
					</DesktopAppButton>
				</div>
				<p
					id={shortcutsDescId}
					className={cn('mb-3 text-sm', DESKTOP_TYPOGRAPHY.meta)}
				>
					{t('overview.dashboard.toolbar.shortcutsDialogDescription')}
				</p>
				<ul
					className={cn(
						'm-0 list-disc space-y-2 pl-5 text-sm',
						DESKTOP_TYPOGRAPHY.body
					)}
				>
					{SHORTCUT_TIP_KEYS.map((key) => (
						<li key={key}>{t(key)}</li>
					))}
				</ul>
			</div>
		</div>,
		document.body
	);
}

export type MarketingDashboardRenameTileDialogPortalProps = {
	renameTarget: MarketingDashboardWidget | null;
	renameDraft: string;
	setRenameDraft: (v: string) => void;
	renamePanelRef: React.RefObject<HTMLDivElement | null>;
	renameInputRef: React.RefObject<HTMLInputElement | null>;
	renameTitleId: string;
	renameHintId: string;
	renameFieldId: string;
	onDismiss: () => void;
	onSubmit: () => void;
	toolbarBusy: boolean;
	t: (key: string, options?: Record<string, unknown>) => string;
};

export function MarketingDashboardRenameTileDialogPortal({
	renameTarget,
	renameDraft,
	setRenameDraft,
	renamePanelRef,
	renameInputRef,
	renameTitleId,
	renameHintId,
	renameFieldId,
	onDismiss,
	onSubmit,
	toolbarBusy,
	t,
}: MarketingDashboardRenameTileDialogPortalProps) {
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	if (!renameTarget || typeof document === 'undefined') {
		return null;
	}

	return createPortal(
		// biome-ignore lint/a11y/noStaticElementInteractions: оверлей закрытия модалки по клику вне панели
		<div
			className={modalOverlayClass()}
			style={{ zIndex: embeddedModalZ.backdrop }}
			role="presentation"
			tabIndex={-1}
			onClick={onDismiss}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onDismiss();
				}
			}}
		>
			<div
				ref={renamePanelRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={renameTitleId}
				aria-describedby={renameHintId}
				className={cn(
					DESKTOP_APP_STYLE_CONTRACT.panelStrong,
					'w-full max-w-md rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) p-4 shadow-(--desktop-shadow-panel)'
				)}
				style={{ zIndex: embeddedModalZ.content }}
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				<h2
					id={renameTitleId}
					className={cn(
						'm-0 mb-3 text-base font-semibold',
						DESKTOP_TYPOGRAPHY.body
					)}
				>
					{t('overview.dashboard.toolbar.renameTileDialogTitle')}
				</h2>
				<p id={renameHintId} className="sr-only">
					{t('overview.dashboard.toolbar.renameTileDialogDescription')}
				</p>
				<label
					htmlFor={renameFieldId}
					className={cn('mb-2 block text-sm', DESKTOP_TYPOGRAPHY.meta)}
				>
					{t('overview.dashboard.toolbar.renameTileFieldLabel')}
				</label>
				<DesktopAppInput
					ref={renameInputRef}
					id={renameFieldId}
					value={renameDraft}
					onChange={(e) => setRenameDraft(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							onSubmit();
						}
					}}
					className="mb-4 w-full"
					autoComplete="off"
				/>
				<div className="flex flex-wrap justify-end gap-2">
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						onClick={onDismiss}
					>
						{t('overview.dashboard.toolbar.renameTileCancel')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						disabled={toolbarBusy || !renameDraft.trim()}
						onClick={onSubmit}
					>
						{t('overview.dashboard.toolbar.renameTileSave')}
					</DesktopAppButton>
				</div>
			</div>
		</div>,
		document.body
	);
}

export type MarketingDashboardSaveTemplateDialogPortalProps = {
	saveTemplateOpen: boolean;
	saveTemplatePanelRef: React.RefObject<HTMLDivElement | null>;
	saveTemplateNameInputRef: React.RefObject<HTMLInputElement | null>;
	saveTemplateTitleId: string;
	saveTemplateDialogDescId: string;
	saveTemplateNameFieldId: string;
	saveTemplateDescFieldId: string;
	saveTemplateName: string;
	setSaveTemplateName: (v: string) => void;
	saveTemplateDescription: string;
	setSaveTemplateDescription: (v: string) => void;
	onDismiss: () => void;
	onSubmit: () => void;
	toolbarBusy: boolean;
	t: (key: string, options?: Record<string, unknown>) => string;
};

export function MarketingDashboardSaveTemplateDialogPortal({
	saveTemplateOpen,
	saveTemplatePanelRef,
	saveTemplateNameInputRef,
	saveTemplateTitleId,
	saveTemplateDialogDescId,
	saveTemplateNameFieldId,
	saveTemplateDescFieldId,
	saveTemplateName,
	setSaveTemplateName,
	saveTemplateDescription,
	setSaveTemplateDescription,
	onDismiss,
	onSubmit,
	toolbarBusy,
	t,
}: MarketingDashboardSaveTemplateDialogPortalProps) {
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	if (!saveTemplateOpen || typeof document === 'undefined') {
		return null;
	}

	return createPortal(
		// biome-ignore lint/a11y/noStaticElementInteractions: оверлей закрытия модалки по клику вне панели
		<div
			className={modalOverlayClass()}
			style={{ zIndex: embeddedModalZ.backdrop }}
			role="presentation"
			tabIndex={-1}
			onClick={onDismiss}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onDismiss();
				}
			}}
		>
			<div
				ref={saveTemplatePanelRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={saveTemplateTitleId}
				aria-describedby={saveTemplateDialogDescId}
				className={cn(
					DESKTOP_APP_STYLE_CONTRACT.panelStrong,
					'w-full max-w-md rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) p-4 shadow-(--desktop-shadow-panel)'
				)}
				style={{ zIndex: embeddedModalZ.content }}
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				<h2
					id={saveTemplateTitleId}
					className={cn(
						'm-0 mb-3 text-base font-semibold',
						DESKTOP_TYPOGRAPHY.body
					)}
				>
					{t('overview.dashboard.toolbar.saveLayoutTemplateDialogTitle')}
				</h2>
				<p
					id={saveTemplateDialogDescId}
					className={cn('mb-3 text-sm', DESKTOP_TYPOGRAPHY.meta)}
				>
					{t('overview.dashboard.toolbar.saveLayoutTemplateDialogIntro')}
				</p>
				<label
					htmlFor={saveTemplateNameFieldId}
					className={cn('mb-2 block text-sm', DESKTOP_TYPOGRAPHY.meta)}
				>
					{t('overview.dashboard.toolbar.saveLayoutTemplateNameLabel')}
				</label>
				<DesktopAppInput
					ref={saveTemplateNameInputRef}
					id={saveTemplateNameFieldId}
					value={saveTemplateName}
					onChange={(e) => setSaveTemplateName(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							onSubmit();
						}
					}}
					className="mb-3 w-full"
					autoComplete="off"
				/>
				<label
					htmlFor={saveTemplateDescFieldId}
					className={cn('mb-2 block text-sm', DESKTOP_TYPOGRAPHY.meta)}
				>
					{t('overview.dashboard.toolbar.saveLayoutTemplateDescriptionLabel')}
				</label>
				<textarea
					id={saveTemplateDescFieldId}
					value={saveTemplateDescription}
					onChange={(e) => setSaveTemplateDescription(e.target.value)}
					rows={2}
					className="mb-4 w-full resize-y rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary)"
				/>
				<div className="flex flex-wrap justify-end gap-2">
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						onClick={onDismiss}
					>
						{t('overview.dashboard.toolbar.saveLayoutTemplateCancel')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						disabled={toolbarBusy || !saveTemplateName.trim()}
						onClick={onSubmit}
					>
						{t('overview.dashboard.toolbar.saveLayoutTemplateSubmit')}
					</DesktopAppButton>
				</div>
			</div>
		</div>,
		document.body
	);
}
