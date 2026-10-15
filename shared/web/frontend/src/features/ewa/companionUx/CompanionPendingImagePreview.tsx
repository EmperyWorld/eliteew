/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pending vision attachment preview above the companion composer (U8.3 slice 14).
 *
 * Invariants:
 * - Renders nothing when no pending image is provided.
 *
 * Related:
 * - src/features/ewa/companionImageAttachment.ts
 */

import { XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import type { PendingCompanionImage } from '@/features/ewa/companionImageAttachment';
import { CompanionGlassCard } from '@/features/ewa/companionPremiumPrimitives';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

export type CompanionPendingImagePreviewProps = {
	pendingImage: PendingCompanionImage | null;
	pending: boolean;
	onClear: () => void;
};

export function CompanionPendingImagePreview({
	pendingImage,
	pending,
	onClear,
}: CompanionPendingImagePreviewProps) {
	const { t } = useTranslation('marketing');

	if (!pendingImage) return null;

	return (
		<CompanionGlassCard className="mb-2 flex items-center gap-2 p-2">
			<img
				src={pendingImage.previewUrl}
				alt=""
				className="size-14 shrink-0 rounded-xl border border-white/10 object-cover shadow-sm shadow-black/20"
			/>
			<span className="min-w-0 flex-1 truncate text-[12px] text-(--companion-text-soft)">
				{t('ewaCompanion.chatImageAttachedHint')}
			</span>
			<DesktopAppButton
				type="button"
				variant="neutral"
				size="sm"
				className="shrink-0"
				disabled={pending}
				onClick={onClear}
				aria-label={t('ewaCompanion.chatImagePreviewRemove')}
			>
				<XMarkIcon className="size-4" aria-hidden />
			</DesktopAppButton>
		</CompanionGlassCard>
	);
}
