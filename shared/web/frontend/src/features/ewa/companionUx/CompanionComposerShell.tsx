/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Composer card chrome: sr-only label, vision attach preview/input, styled shell (U8.3 slice 17).
 *
 * Invariants:
 * - Inner layout (mobile vs desktop body) is passed as children from the panel shell.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionPendingImagePreview.tsx
 */

import type { ChangeEvent, RefObject, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { COMPANION_VISION_ACCEPT } from '@/features/ewa/companionVisionFormats';
import type { PendingCompanionImage } from '@/features/ewa/companionImageAttachment';
import { CompanionPendingImagePreview } from '@/features/ewa/companionUx/CompanionPendingImagePreview';
import {
	MOBILE_EMBEDDED_EWA_COMPOSER_CLASS,
	MOBILE_EMBEDDED_EWA_LANDSCAPE_COMPOSER_CLASS,
} from '@/components/mobileEmbedded/mobileEmbeddedLayoutTokens';
import { cn } from '@/utils/cn';

export type CompanionComposerShellProps = {
	composerRef: RefObject<HTMLDivElement | null>;
	imageInputRef: RefObject<HTMLInputElement | null>;
	mobileEmbeddedLayout: boolean;
	mobileEmbeddedLandscape: boolean;
	pendingImage: PendingCompanionImage | null;
	pending: boolean;
	onClearPendingImage: () => void;
	onImageFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
	children: ReactNode;
};

export function CompanionComposerShell({
	composerRef,
	imageInputRef,
	mobileEmbeddedLayout,
	mobileEmbeddedLandscape,
	pendingImage,
	pending,
	onClearPendingImage,
	onImageFileChange,
	children,
}: CompanionComposerShellProps) {
	const { t } = useTranslation('marketing');

	return (
		<>
			<label className="sr-only" htmlFor="ewa-companion-chat-input">
				{t('ewaCompanion.chatInputLabel')}
			</label>
			<CompanionPendingImagePreview
				pendingImage={pendingImage}
				pending={pending}
				onClear={onClearPendingImage}
			/>
			<input
				ref={imageInputRef}
				type="file"
				accept={COMPANION_VISION_ACCEPT}
				title={t('ewaCompanion.chatAttachImageFormatsHint')}
				className="sr-only"
				disabled={pending}
				onChange={(event) => void onImageFileChange(event)}
			/>
			<div
				ref={composerRef}
				className={cn(
					'relative z-40 flex w-full min-w-0 shrink-0 flex-col gap-2 rounded-2xl',
					'border border-(--companion-divider)',
					'bg-[radial-gradient(circle_at_10%_0%,var(--companion-bg),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.58),rgba(15,23,42,0.28))] p-2 shadow-[0_18px_38px_rgba(2,6,23,0.18)]',
					mobileEmbeddedLayout && MOBILE_EMBEDDED_EWA_COMPOSER_CLASS,
					mobileEmbeddedLandscape &&
						MOBILE_EMBEDDED_EWA_LANDSCAPE_COMPOSER_CLASS
				)}
				data-testid="ewa-companion-composer"
				data-ewa-guide="composer"
			>
				{children}
			</div>
		</>
	);
}
