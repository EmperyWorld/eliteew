/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Full-viewport Arlika/EWA transform video portal (ShellPortalMount, U8.3 slice 11).
 *
 * Invariants:
 * - Parent owns ``useCompanionTransformVideo`` state; portal is presentational only.
 *
 * Related:
 * - src/features/ewa/useCompanionTransformVideo.ts
 * - src/features/ewa/companionTransformVideoUrl.ts
 * - src/pages/Desktop/shell/shellPortal.tsx
 */

import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import type { RefObject, SyntheticEvent } from 'react';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_Z_INDEX } from '@/pages/Desktop/constants';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';
import { cn } from '@/utils/cn';

export type CompanionTransformVideoPortalProps = {
	open: boolean;
	failed: boolean;
	loading: boolean;
	src: string;
	retry: number;
	needsControls: boolean;
	videoRef: RefObject<HTMLVideoElement | null>;
	onClose: () => void;
	onReady: (event: SyntheticEvent<HTMLVideoElement>) => void;
	onError: (event: SyntheticEvent<HTMLVideoElement>) => void;
};

export function CompanionTransformVideoPortal({
	open,
	failed,
	loading,
	src,
	retry,
	needsControls,
	videoRef,
	onClose,
	onReady,
	onError,
}: CompanionTransformVideoPortalProps) {
	const { t } = useTranslation('marketing');

	if (!open) return null;

	return (
		<ShellPortalMount layer="embedded_modal_backdrop">
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="ewa-arlika-transform-title"
				className="fixed inset-0 flex flex-col bg-black"
				style={{
					zIndex: DESKTOP_Z_INDEX.COMPANION_FULLSCREEN_MEDIA,
				}}
			>
				<h2 id="ewa-arlika-transform-title" className="sr-only">
					{t('ewaCompanion.arlikaTransformVideoTitle')}
				</h2>
				<div className="relative min-h-0 min-w-0 flex-1">
					{failed ? (
						<div
							className={cn(
								'flex h-full w-full items-center justify-center px-6',
								'text-center text-[14px] leading-snug text-white/80'
							)}
						>
							{t('ewaCompanion.arlikaTransformVideoStub')}
						</div>
					) : (
						<>
							{loading ? (
								<div
									className={cn(
										'pointer-events-none absolute inset-0 z-10',
										'flex flex-col items-center justify-center gap-3',
										'bg-black/55 text-white/90'
									)}
								>
									<ArrowPathIcon className="size-8 animate-spin opacity-80" />
									<p className="text-[14px]">
										{t('ewaCompanion.arlikaTransformVideoLoading')}
									</p>
								</div>
							) : null}
							<video
								key={`${src}:${retry}`}
								ref={videoRef}
								className={cn(
									'absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
									loading ? 'opacity-0' : 'opacity-100'
								)}
								src={src}
								autoPlay
								controls={needsControls}
								playsInline
								preload="auto"
								muted
								aria-label={t('ewaCompanion.arlikaTransformVideoTitle')}
								onCanPlayThrough={onReady}
								onError={onError}
								onEnded={onClose}
							/>
						</>
					)}
				</div>
				<div className="pointer-events-none absolute inset-x-0 top-0 flex justify-end p-4">
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						className="pointer-events-auto shadow-lg"
						onClick={onClose}
					>
						{t('ewaCompanion.arlikaTransformVideoClose')}
					</DesktopAppButton>
				</div>
			</div>
		</ShellPortalMount>
	);
}
