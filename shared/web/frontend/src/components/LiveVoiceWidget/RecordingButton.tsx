/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Live Voice primary mic CTA with audio-level ring — opaque desktop tokens, no glass.
 *
 * Invariants:
 * - GPU-friendly motion on the button; label exposed for styled desktop tooltips.
 * - Copy via desktopUi.liveVoiceDesktop (not hard-coded gray utility text).
 *
 * Related:
 * - WidgetExpanded.tsx, DesktopChromeTooltip.tsx, liveVoiceLayoutTokens.ts
 */

import * as React from 'react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MicrophoneIcon, StopIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { DesktopChromeTooltip } from '@/pages/Desktop/components/DesktopChromeTooltip';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

interface RecordingButtonProps {
	isRecording: boolean;
	onClick: () => void;
	audioLevel?: number;
}

export const RecordingButton: React.FC<RecordingButtonProps> = memo(
	({ isRecording, onClick, audioLevel = 0 }) => {
		const { t } = useTranslation('desktopUi', {
			keyPrefix: 'liveVoiceDesktop',
		});
		const normalizedLevel = useMemo(
			() => Math.min(audioLevel / 255, 1),
			[audioLevel]
		);

		const recordLabel = isRecording ? t('recordStop') : t('recordStart');

		return (
			<div className="flex flex-col items-center gap-3">
				<DesktopChromeTooltip
					content={recordLabel}
					placement="top"
					offsetExtra={4}
				>
					<motion.button
						type="button"
						onClick={onClick}
						className={cn(
							'relative flex h-28 w-28 items-center justify-center rounded-(--desktop-radius-xl) border will-change-transform',
							DESKTOP_CHROME_FOCUS_VISIBLE,
							isRecording
								? 'border-[color-mix(in_srgb,rgb(239_68_68)_40%,transparent)] bg-[color-mix(in_srgb,rgb(185_28_28)_88%,rgb(var(--desktop-bg-secondary-rgb)/1))] shadow-[0_12px_32px_rgba(0,0,0,0.45)]'
								: 'border-[rgb(var(--desktop-accent-rgb)/0.4)] bg-[rgb(var(--desktop-accent-rgb)/0.16)] shadow-[0_16px_40px_rgba(0,0,0,0.4)]'
						)}
						whileHover={{
							scale: 1.04,
							transition: { duration: 0.15, ease: 'easeOut' },
						}}
						whileTap={{
							scale: 0.96,
							transition: { duration: 0.1 },
						}}
						animate={
							isRecording
								? {
										boxShadow: [
											'0 12px 28px rgba(0,0,0,0.45), 0 0 0 0 rgba(239,68,68,0.35)',
											'0 12px 28px rgba(0,0,0,0.45), 0 0 0 10px rgba(239,68,68,0)',
										],
									}
								: {}
						}
						transition={{
							boxShadow: {
								duration: 1.4,
								repeat: Infinity,
								ease: 'easeOut',
							},
						}}
						aria-label={recordLabel}
					>
						{isRecording ? (
							<StopIcon
								width={34}
								height={34}
								className="text-(--desktop-text-primary)"
								strokeWidth={1.5}
							/>
						) : (
							<MicrophoneIcon
								width={34}
								height={34}
								className="text-[rgb(var(--desktop-accent-rgb))]"
								strokeWidth={1.5}
							/>
						)}

						{isRecording && normalizedLevel > 0.05 ? (
							<>
								<motion.div
									className="pointer-events-none absolute inset-0 rounded-(--desktop-radius-xl) border border-(--desktop-text-primary)/35 will-change-transform"
									style={{
										transform: `scale(${1 + normalizedLevel * 0.12})`,
										opacity: 0.25 + normalizedLevel * 0.35,
									}}
									transition={{ duration: 0.05, ease: 'linear' }}
								/>
								<motion.div
									className="pointer-events-none absolute inset-0 rounded-(--desktop-radius-xl) border border-(--desktop-text-primary)/20 will-change-transform"
									style={{
										transform: `scale(${1 + normalizedLevel * 0.24})`,
										opacity: 0.15 + normalizedLevel * 0.25,
									}}
									transition={{ duration: 0.05, ease: 'linear' }}
								/>
							</>
						) : null}
					</motion.button>
				</DesktopChromeTooltip>

				<p
					className={cn(
						'text-sm font-medium',
						isRecording
							? 'text-(--desktop-text-primary)'
							: 'text-(--desktop-text-secondary)'
					)}
				>
					{isRecording ? t('recording') : t('tapToTalk')}
				</p>
			</div>
		);
	}
);

RecordingButton.displayName = 'RecordingButton';
