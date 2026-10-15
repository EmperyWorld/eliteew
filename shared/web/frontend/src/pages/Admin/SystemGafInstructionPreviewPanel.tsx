/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Collapsible plaintext preview for system GAF instruction (matches server-built body).
 *
 * Related:
 * - `pages/Admin/SystemGafInstructionSection.tsx`
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_SURFACE,
	DESKTOP_TYPOGRAPHY,
} from '../Desktop/constants';

type Props = {
	previewText: string;
	deferredPreviewText: string;
	previewIsStale: boolean;
	onCopy: () => void;
};

export function SystemGafInstructionPreviewPanel({
	previewText,
	deferredPreviewText,
	previewIsStale,
	onCopy,
}: Props): React.ReactElement {
	const { t } = useTranslation('desktopUi', {
		keyPrefix: 'adminGafInstruction',
	});

	return (
		<details
			open
			className={`relative mb-6 rounded-lg border border-white/10 bg-slate-950/40 ${DESKTOP_SURFACE.radius}`}
		>
			<summary
				className={`cursor-pointer list-none px-4 py-3 pr-28 ${DESKTOP_TYPOGRAPHY.caption} text-slate-300 hover:bg-white/5`}
			>
				<span>
					{t('preview.heading', { chars: previewText.length })}
					{previewIsStale ? (
						<span className="text-slate-500 font-normal">
							{t('preview.stale')}
						</span>
					) : null}
				</span>
			</summary>
			<button
				type="button"
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					void onCopy();
				}}
				className={`absolute right-4 top-3 z-10 inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-slate-200 hover:bg-white/5 ${DESKTOP_INTERACTIVE.focusRing}`}
			>
				<ClipboardDocumentIcon className="h-3.5 w-3.5" aria-hidden />
				{t('preview.copy')}
			</button>
			<div className="px-4 pb-4 pt-0 border-t border-white/5">
				<pre
					className={`mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-black/40 p-3 text-sm text-slate-200 transition-opacity duration-150 ${DESKTOP_TYPOGRAPHY.meta} ${previewIsStale ? 'opacity-60' : 'opacity-100'}`}
				>
					{deferredPreviewText || t('preview.empty')}
				</pre>
			</div>
		</details>
	);
}
