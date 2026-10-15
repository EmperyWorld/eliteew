/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Insert tool cluster (link, image, table popovers) for Ultimate Doc Editor toolbar.
 *
 * Invariants:
 * - Popover refs and handlers come from useEditorToolbarPopovers only.
 *
 * Related:
 * - EditorToolbar.tsx, EditorToolbarLink/Image/TablePopoverBody.tsx
 */
import type { Editor } from '@tiptap/react';
import type { TFunction } from 'i18next';
import {
	LinkIcon,
	PhotoIcon,
	TableCellsIcon,
} from '@heroicons/react/24/outline';
import { EditorToolbarIconButton } from './EditorToolbarIconButton';
import { EditorToolbarImagePopoverBody } from './EditorToolbarImagePopoverBody';
import { EditorToolbarLinkPopoverBody } from './EditorToolbarLinkPopoverBody';
import { EditorToolbarPopoverFrame } from './EditorToolbarPopoverFrame';
import { EditorToolbarTablePopoverBody } from './EditorToolbarTablePopoverBody';
import { EditorToolbarToolGroup } from './EditorToolbarToolGroup';
import type { UseEditorToolbarPopoversResult } from './useEditorToolbarPopovers';

export interface EditorToolbarInsertGroupProps {
	editor: Editor;
	t: TFunction;
	popovers: UseEditorToolbarPopoversResult;
}

export function EditorToolbarInsertGroup({
	editor,
	t,
	popovers,
}: EditorToolbarInsertGroupProps) {
	return (
		<EditorToolbarToolGroup ariaLabel={t('toolbar.groups.insert')}>
			<div className="relative">
				<EditorToolbarIconButton
					ref={popovers.linkButtonRef}
					tooltip={t('toolbar.tools.link')}
					onCommand={() => popovers.togglePopover('link')}
					isActive={
						popovers.activePopover === 'link' || editor.isActive('link')
					}
					icon={<LinkIcon width={16} height={16} aria-hidden />}
				/>
				<EditorToolbarPopoverFrame
					id="link"
					popoverRef={popovers.linkPopoverRef}
					header={{
						icon: <LinkIcon width={22} height={22} />,
						title: t('toolbar.popovers.link.title'),
						subtitle: t('toolbar.popovers.link.subtitle'),
					}}
					activePopover={popovers.activePopover}
					popoverPosition={popovers.popoverPosition}
					closePopover={popovers.closePopover}
					closePanelAriaLabel={t('toolbar.aria.closePanel')}
				>
					<EditorToolbarLinkPopoverBody
						linkUrlInputRef={popovers.linkUrlInputRef}
						linkUrl={popovers.linkUrl}
						onLinkUrlChange={(value) => {
							popovers.setLinkUrl(value);
							popovers.setLinkError(null);
						}}
						linkText={popovers.linkText}
						onLinkTextChange={popovers.setLinkText}
						linkError={popovers.linkError}
						onSubmit={popovers.handleInsertLink}
						onRemoveLink={popovers.handleRemoveLink}
						onClose={popovers.closePopover}
						urlLabel={t('toolbar.popovers.link.urlLabel')}
						urlPlaceholder={t('toolbar.popovers.link.urlPlaceholder')}
						textLabel={t('toolbar.popovers.link.textLabel')}
						textPlaceholder={t('toolbar.popovers.link.textPlaceholder')}
						removeLinkLabel={t('toolbar.popovers.link.removeLink')}
						cancelLabel={t('destructiveConfirm.cancel')}
						insertLabel={t('toolbar.popovers.link.insert')}
						canRemoveLink={editor.isActive('link')}
					/>
				</EditorToolbarPopoverFrame>
			</div>

			<div className="relative">
				<EditorToolbarIconButton
					ref={popovers.imageButtonRef}
					tooltip={t('toolbar.tools.image')}
					onCommand={() => popovers.togglePopover('image')}
					isActive={popovers.activePopover === 'image'}
					icon={<PhotoIcon width={16} height={16} aria-hidden />}
				/>
				<EditorToolbarPopoverFrame
					id="image"
					popoverRef={popovers.imagePopoverRef}
					header={{
						icon: <PhotoIcon width={22} height={22} />,
						title: t('toolbar.popovers.image.title'),
						subtitle: t('toolbar.popovers.image.subtitle'),
					}}
					activePopover={popovers.activePopover}
					popoverPosition={popovers.popoverPosition}
					closePopover={popovers.closePopover}
					closePanelAriaLabel={t('toolbar.aria.closePanel')}
				>
					<EditorToolbarImagePopoverBody
						imageUrlInputRef={popovers.imageUrlInputRef}
						imageUrl={popovers.imageUrl}
						onImageUrlChange={(value) => {
							popovers.setImageUrl(value);
							popovers.setImageError(null);
						}}
						imageAlt={popovers.imageAlt}
						onImageAltChange={popovers.setImageAlt}
						imageError={popovers.imageError}
						onSubmit={popovers.handleInsertImage}
						onClose={popovers.closePopover}
						urlLabel={t('toolbar.popovers.image.urlLabel')}
						urlPlaceholder={t('toolbar.popovers.link.urlPlaceholder')}
						altLabel={t('toolbar.popovers.image.altLabel')}
						altPlaceholder={t('toolbar.popovers.image.altPlaceholder')}
						cancelLabel={t('destructiveConfirm.cancel')}
						insertLabel={t('toolbar.popovers.image.insert')}
					/>
				</EditorToolbarPopoverFrame>
			</div>

			<div className="relative">
				<EditorToolbarIconButton
					ref={popovers.tableButtonRef}
					tooltip={t('toolbar.tools.table')}
					onCommand={() => popovers.togglePopover('table')}
					isActive={popovers.activePopover === 'table'}
					icon={<TableCellsIcon width={16} height={16} aria-hidden />}
				/>
				<EditorToolbarPopoverFrame
					id="table"
					popoverRef={popovers.tablePopoverRef}
					header={{
						icon: <TableCellsIcon width={22} height={22} />,
						title: t('toolbar.popovers.table.title'),
						subtitle: t('toolbar.popovers.table.subtitle'),
					}}
					activePopover={popovers.activePopover}
					popoverPosition={popovers.popoverPosition}
					closePopover={popovers.closePopover}
					closePanelAriaLabel={t('toolbar.aria.closePanel')}
				>
					<EditorToolbarTablePopoverBody
						tableRowsInputRef={popovers.tableRowsInputRef}
						tableRows={popovers.tableRows}
						onTableRowsChange={popovers.setTableRows}
						tableCols={popovers.tableCols}
						onTableColsChange={popovers.setTableCols}
						tableWithHeader={popovers.tableWithHeader}
						onTableWithHeaderChange={popovers.setTableWithHeader}
						tableError={popovers.tableError}
						onSubmit={popovers.handleInsertTable}
						onClose={popovers.closePopover}
						rowsLabel={t('toolbar.popovers.table.rowsLabel')}
						colsLabel={t('toolbar.popovers.table.colsLabel')}
						headerRowLabel={t('toolbar.popovers.table.headerRow')}
						cancelLabel={t('destructiveConfirm.cancel')}
						insertLabel={t('toolbar.popovers.table.insert')}
					/>
				</EditorToolbarPopoverFrame>
			</div>
		</EditorToolbarToolGroup>
	);
}
