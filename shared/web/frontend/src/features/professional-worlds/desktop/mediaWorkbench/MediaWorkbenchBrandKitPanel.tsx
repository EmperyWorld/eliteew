/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Brand visual kit draft form for the media workbench (hidden in mobile field mode).
 *
 * Invariants:
 * - Save stays disabled until brand kit load finishes.
 * - Local validation lives in the hook before PUT.
 *
 * Related:
 * - brandVisualKitForm.ts
 * - FieldGrid.tsx
 */

import {
	DesktopAppButton,
	DesktopAppInput,
	DesktopAppSectionLabel,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';
import type { ReactElement } from 'react';
import { useId } from 'react';
import { FieldGrid } from './FieldGrid';
import type { MediaWorkbenchBrandDraft } from './types';
import type { ProfessionalMediaWorkbenchModel } from './useProfessionalMediaWorkbench';

type BrandKitPanelProps = {
	readonly model: Pick<
		ProfessionalMediaWorkbenchModel,
		| 't'
		| 'hideBrandKit'
		| 'brandKitLoaded'
		| 'brandDraft'
		| 'setBrandDraft'
		| 'saveBrandKit'
	>;
};

export function MediaWorkbenchBrandKitPanel({
	model,
}: BrandKitPanelProps): ReactElement | null {
	const {
		t,
		hideBrandKit,
		brandKitLoaded,
		brandDraft,
		setBrandDraft,
		saveBrandKit,
	} = model;
	const watermarkCornerLabelId = useId();

	if (hideBrandKit) {
		return null;
	}

	const setCorner = (value: string) => {
		setBrandDraft((b: MediaWorkbenchBrandDraft) => ({
			...b,
			watermark_corner: value as MediaWorkbenchBrandDraft['watermark_corner'],
		}));
	};

	return (
		<div className="grid gap-2 rounded-(--desktop-radius-xs) border border-dashed border-(--desktop-border-strong) bg-(--desktop-surface-raised)/40 p-3">
			<DesktopAppSectionLabel>
				{t('mediaWorkbench.brand')}
			</DesktopAppSectionLabel>
			<FieldGrid>
				<DesktopAppInput
					value={brandDraft.primary_hex}
					onChange={(e) =>
						setBrandDraft((b) => ({ ...b, primary_hex: e.target.value }))
					}
					placeholder="#112233"
				/>
				<DesktopAppInput
					value={brandDraft.accent_hex}
					onChange={(e) =>
						setBrandDraft((b) => ({ ...b, accent_hex: e.target.value }))
					}
					placeholder="#FFAA88"
				/>
			</FieldGrid>
			<textarea
				className="min-h-[72px] w-full rounded-(--desktop-radius-xs) border border-(--desktop-border-strong) bg-(--desktop-bg) p-2 text-xs text-inherit"
				value={brandDraft.typography_note}
				onChange={(e) =>
					setBrandDraft((b) => ({
						...b,
						typography_note: e.target.value,
					}))
				}
				placeholder={t('mediaWorkbench.typography')}
			/>
			<FieldGrid>
				<DesktopAppInput
					value={brandDraft.logo_asset_hint}
					onChange={(e) =>
						setBrandDraft((b) => ({
							...b,
							logo_asset_hint: e.target.value,
						}))
					}
					placeholder={t('mediaWorkbench.logoHint')}
				/>
				<div className="grid gap-1 text-xs">
					<span
						id={watermarkCornerLabelId}
						className="text-(--desktop-text-muted)"
					>
						{t('mediaWorkbench.watermarkCorner')}
					</span>
					<DesktopNativeSelect
						aria-labelledby={watermarkCornerLabelId}
						value={brandDraft.watermark_corner}
						onChange={(e) => setCorner(e.target.value)}
					>
						<option value="none">none</option>
						<option value="tl">tl</option>
						<option value="tr">tr</option>
						<option value="bl">bl</option>
						<option value="br">br</option>
					</DesktopNativeSelect>
				</div>
				<DesktopAppInput
					type="number"
					value={
						brandDraft.watermark_padding_px === ''
							? ''
							: String(brandDraft.watermark_padding_px)
					}
					onChange={(e) =>
						setBrandDraft((b) => ({
							...b,
							watermark_padding_px:
								e.target.value === '' ? '' : Number(e.target.value),
						}))
					}
					placeholder="12"
				/>
			</FieldGrid>
			<DesktopAppButton
				disabled={!brandKitLoaded}
				onClick={() => void saveBrandKit()}
			>
				{t('mediaWorkbench.brandSave')}
			</DesktopAppButton>
		</div>
	);
}
