/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Color scheme preview swatch button for the presentation slide colors tab.
 *
 * Invariants:
 * - CSS vars applied via assignDomCssVars in useLayoutEffect.
 *
 * Related:
 * - presentationEdit/presentationEditorPresets.ts
 * - PresentationEditPage.tsx
 */

import { useLayoutEffect, useRef } from 'react';
import { assignDomCssVars } from './presentationDomCssVars';
import type { ColorScheme } from './presentationEditorPresets';

export type PresentationEditColorSchemePreviewButtonProps = {
	scheme: ColorScheme;
	onApply: () => void;
};

export function PresentationEditColorSchemePreviewButton({
	scheme,
	onApply,
}: PresentationEditColorSchemePreviewButtonProps) {
	const buttonRef = useRef<HTMLButtonElement>(null);
	const bgSwatchRef = useRef<HTMLDivElement>(null);
	const fgSwatchRef = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		assignDomCssVars(buttonRef.current, {
			'--scheme-bg-color': scheme.backgroundColor,
			'--scheme-text-color': scheme.textColor,
		});
		assignDomCssVars(bgSwatchRef.current, {
			'--swatch-color': scheme.backgroundColor,
		});
		assignDomCssVars(fgSwatchRef.current, {
			'--swatch-color': scheme.textColor,
		});
	}, [scheme]);
	return (
		<button
			ref={buttonRef}
			type="button"
			onClick={onApply}
			className="p-3 rounded-lg border border-neutral-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600 transition-colors text-sm text-left color-scheme-preview"
		>
			<div className="font-medium">{scheme.name}</div>
			<div className="flex gap-1 mt-1">
				<div
					ref={bgSwatchRef}
					className="w-4 h-4 rounded border border-neutral-300 color-swatch"
				/>
				<div
					ref={fgSwatchRef}
					className="w-4 h-4 rounded border border-neutral-300 color-swatch"
				/>
			</div>
		</button>
	);
}
