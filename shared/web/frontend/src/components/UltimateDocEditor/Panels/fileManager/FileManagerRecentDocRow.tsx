/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact recent-document row in File Manager «Недавние» section.
 *
 * Invariants:
 * - Opens document on click; supports context menu via onContextMenu.
 *
 * Related:
 * - fileManagerTypes.ts
 * - documentation/product/ULTIMATE-DOC-EDITOR-FILE-MANAGER.md
 */

import {
	ArrowTopRightOnSquareIcon,
	DocumentTextIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { FileManagerRecentDocRowProps } from './fileManagerTypes';

export const FileManagerRecentDocRow = React.memo(
	function FileManagerRecentDocRow({
		doc,
		onOpenDocument,
		onContextMenu,
	}: FileManagerRecentDocRowProps) {
		const { t } = useTranslation('ultimateDocEditor');
		const title = doc.title || t('header.untitled');
		const handleClick = useCallback(() => {
			onOpenDocument(doc);
		}, [onOpenDocument, doc]);

		return (
			<li>
				<button
					type="button"
					onClick={handleClick}
					onContextMenu={onContextMenu}
					title={title}
					className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs text-(--desktop-text-secondary) transition-colors hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary) focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35"
				>
					<DocumentTextIcon
						width={13}
						height={13}
						className="shrink-0 text-(--desktop-text-dim)"
					/>
					<span className="min-w-0 flex-1 truncate">{title}</span>
					<ArrowTopRightOnSquareIcon
						width={11}
						height={11}
						className="shrink-0 text-(--desktop-text-dim)"
						aria-hidden
					/>
				</button>
			</li>
		);
	}
);
FileManagerRecentDocRow.displayName = 'FileManagerRecentDocRow';
