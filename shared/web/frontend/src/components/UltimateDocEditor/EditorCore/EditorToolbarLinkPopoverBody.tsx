/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Link insert popover form body for Ultimate Doc Editor toolbar.
 *
 * Invariants:
 * - Submit delegates to parent handler; does not call editor APIs directly.
 *
 * Related:
 * - EditorToolbar.tsx, EditorToolbarPopoverFrame.tsx
 */
import type * as React from 'react';
import { LinkIcon } from '@heroicons/react/24/outline';
import { DesktopAppButton } from '../../../pages/Desktop/components/DesktopAppChrome';
import { InputV2 } from '../../ui/InputV2';

export interface EditorToolbarLinkPopoverBodyProps {
	linkUrlInputRef: React.RefObject<HTMLInputElement | null>;
	linkUrl: string;
	onLinkUrlChange: (value: string) => void;
	linkText: string;
	onLinkTextChange: (value: string) => void;
	linkError: string | null;
	onSubmit: (event?: React.FormEvent) => void;
	onRemoveLink: () => void;
	onClose: () => void;
	urlLabel: string;
	urlPlaceholder: string;
	textLabel: string;
	textPlaceholder: string;
	removeLinkLabel: string;
	cancelLabel: string;
	insertLabel: string;
	canRemoveLink: boolean;
}

export function EditorToolbarLinkPopoverBody({
	linkUrlInputRef,
	linkUrl,
	onLinkUrlChange,
	linkText,
	onLinkTextChange,
	linkError,
	onSubmit,
	onRemoveLink,
	onClose,
	urlLabel,
	urlPlaceholder,
	textLabel,
	textPlaceholder,
	removeLinkLabel,
	cancelLabel,
	insertLabel,
	canRemoveLink,
}: EditorToolbarLinkPopoverBodyProps) {
	return (
		<form className="space-y-3" onSubmit={onSubmit}>
			<InputV2
				ref={linkUrlInputRef}
				label={urlLabel}
				placeholder={urlPlaceholder}
				value={linkUrl}
				onChange={(event) => onLinkUrlChange(event.target.value)}
				iconLeft={<LinkIcon width={16} height={16} />}
				error={linkError || undefined}
			/>
			<InputV2
				label={textLabel}
				placeholder={textPlaceholder}
				value={linkText}
				onChange={(event) => onLinkTextChange(event.target.value)}
			/>
			<div className="flex flex-wrap items-center justify-between gap-3 pt-1">
				<DesktopAppButton
					type="button"
					size="sm"
					onClick={onRemoveLink}
					variant="danger"
					disabled={!canRemoveLink}
				>
					{removeLinkLabel}
				</DesktopAppButton>
				<div className="flex items-center gap-2">
					<DesktopAppButton
						type="button"
						size="sm"
						onClick={onClose}
						variant="ghost"
					>
						{cancelLabel}
					</DesktopAppButton>
					<DesktopAppButton
						type="submit"
						variant="accent"
						size="sm"
						className="px-5"
					>
						{insertLabel}
					</DesktopAppButton>
				</div>
			</div>
		</form>
	);
}
