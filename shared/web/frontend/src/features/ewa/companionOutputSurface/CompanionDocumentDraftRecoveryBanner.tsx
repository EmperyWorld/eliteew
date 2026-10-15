/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified draft recovery banner for embedded companion document editor (server priority over local).
 *
 * Invariants:
 * - Primary action restores the recommended draft; optional compare reveals alternate copy only on demand.
 *
 * Related:
 * - CompanionDocumentEditorMode.tsx
 * - companionDocumentSurfaceDraftState.ts
 */

import { useTranslation } from 'react-i18next';

import type { CompanionDocumentSurfaceDraftSnapshot } from '@/features/ewa/companionOutputSurface/companionDocumentSurfaceDraftState';
import {
	DesktopAppButton,
	DESKTOP_CHROME_FOCUS_VISIBLE,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

type RecoverableDraftSource = 'local' | 'server';

type Props = {
	primaryDraft: CompanionDocumentSurfaceDraftSnapshot;
	primarySource: RecoverableDraftSource;
	alternateDraft: CompanionDocumentSurfaceDraftSnapshot | null;
	alternateSource: RecoverableDraftSource | null;
	updatedAtLabel: string;
	compareOpen: boolean;
	onToggleCompare: () => void;
	onRestore: () => void;
	onDiscard: () => void;
};

export function CompanionDocumentDraftRecoveryBanner({
	primaryDraft,
	primarySource,
	alternateDraft,
	alternateSource,
	updatedAtLabel,
	compareOpen,
	onToggleCompare,
	onRestore,
	onDiscard,
}: Props) {
	const { t } = useTranslation('marketing');
	const primaryLabel =
		primarySource === 'server'
			? t('ewaCompanion.documentSurfaceRecoverPrimaryServer')
			: t('ewaCompanion.documentSurfaceRecoverSecondaryLocal');

	return (
		<div className="mb-2 rounded-md border border-amber-300/40 bg-amber-400/10 px-2.5 py-2 text-[11px] text-amber-100">
			<p>
				{t('ewaCompanion.documentSurfaceRecoverUnified', {
					updatedAt: updatedAtLabel,
				})}
			</p>
			<p className="mt-1 text-amber-100/85">{primaryLabel}</p>
			{alternateDraft && alternateSource ? (
				<p className="mt-1 text-amber-100/75">
					{t('ewaCompanion.documentSurfaceRecoverUnifiedLocalAlso')}
				</p>
			) : null}
			<div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
				{alternateDraft ? (
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						onClick={onToggleCompare}
					>
						{compareOpen
							? t('ewaCompanion.documentSurfaceRecoverCompareHide')
							: t('ewaCompanion.documentSurfaceRecoverCompare')}
					</DesktopAppButton>
				) : null}
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					onClick={onDiscard}
				>
					{t('ewaCompanion.documentSurfaceRecoverDraftDiscard')}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="accent"
					size="sm"
					onClick={onRestore}
				>
					{t('ewaCompanion.documentSurfaceRecoverDraftRestore')}
				</DesktopAppButton>
			</div>
			{compareOpen && alternateDraft ? (
				<div className="mt-2 grid gap-2 md:grid-cols-2">
					<div className="rounded border border-amber-200/20 bg-black/15 p-2">
						<p className="mb-1 font-medium text-amber-50">
							{primarySource === 'server'
								? t('ewaCompanion.documentSurfaceRecoverPrimaryServer')
								: t('ewaCompanion.documentSurfaceRecoverSecondaryLocal')}
						</p>
						<pre
							className={cn(
								'max-h-28 overflow-auto whitespace-pre-wrap font-mono text-[10px]',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
						>
							{primaryDraft.markdown.slice(0, 1200)}
						</pre>
					</div>
					<div className="rounded border border-amber-200/20 bg-black/15 p-2">
						<p className="mb-1 font-medium text-amber-50">
							{alternateSource === 'server'
								? t('ewaCompanion.documentSurfaceRecoverPrimaryServer')
								: t('ewaCompanion.documentSurfaceRecoverSecondaryLocal')}
						</p>
						<pre
							className={cn(
								'max-h-28 overflow-auto whitespace-pre-wrap font-mono text-[10px]',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
						>
							{alternateDraft.markdown.slice(0, 1200)}
						</pre>
					</div>
				</div>
			) : null}
		</div>
	);
}
