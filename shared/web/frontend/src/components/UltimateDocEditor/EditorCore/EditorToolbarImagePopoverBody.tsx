/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Image insert popover form body for Ultimate Doc Editor toolbar.
 *
 * Invariants:
 * - Submit delegates to parent handler; does not call editor APIs directly.
 *
 * Related:
 * - EditorToolbar.tsx, EditorToolbarPopoverFrame.tsx
 */
import type * as React from 'react';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { DesktopAppButton } from '../../../pages/Desktop/components/DesktopAppChrome';
import { InputV2 } from '../../ui/InputV2';

export interface EditorToolbarImagePopoverBodyProps {
	imageUrlInputRef: React.RefObject<HTMLInputElement | null>;
	imageUrl: string;
	onImageUrlChange: (value: string) => void;
	imageAlt: string;
	onImageAltChange: (value: string) => void;
	imageError: string | null;
	onSubmit: (event?: React.FormEvent) => void;
	onClose: () => void;
	urlLabel: string;
	urlPlaceholder: string;
	altLabel: string;
	altPlaceholder: string;
	cancelLabel: string;
	insertLabel: string;
}

export function EditorToolbarImagePopoverBody({
	imageUrlInputRef,
	imageUrl,
	onImageUrlChange,
	imageAlt,
	onImageAltChange,
	imageError,
	onSubmit,
	onClose,
	urlLabel,
	urlPlaceholder,
	altLabel,
	altPlaceholder,
	cancelLabel,
	insertLabel,
}: EditorToolbarImagePopoverBodyProps) {
	return (
		<form className="space-y-3" onSubmit={onSubmit}>
			<InputV2
				ref={imageUrlInputRef}
				label={urlLabel}
				placeholder={urlPlaceholder}
				value={imageUrl}
				onChange={(event) => onImageUrlChange(event.target.value)}
				iconLeft={<PhotoIcon width={16} height={16} />}
				error={imageError || undefined}
			/>
			<InputV2
				label={altLabel}
				placeholder={altPlaceholder}
				value={imageAlt}
				onChange={(event) => onImageAltChange(event.target.value)}
			/>
			<div className="flex items-center justify-end gap-2 pt-1">
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
		</form>
	);
}
