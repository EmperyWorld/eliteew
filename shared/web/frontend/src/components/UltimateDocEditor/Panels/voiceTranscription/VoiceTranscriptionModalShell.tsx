/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Modal shell for VoiceTranscriptionPanel: backdrop, header, mode tabs, content slot.
 *
 * Invariants:
 * - Embedded modal z-index via useEmbeddedPortaledModalZIndex; backdrop click closes.
 *
 * Related:
 * - VoiceTranscriptionPanel.tsx, ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md
 */

import { DESKTOP_OVERLAY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import type { TFunction } from 'i18next';
import { AnimatePresence, motion } from 'framer-motion';
import type * as React from 'react';
import {
	ArrowUpTrayIcon,
	MicrophoneIcon,
	SpeakerWaveIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { DesktopAppButton } from '../../../../pages/Desktop/components/DesktopAppChrome';
import type { ProcessingMode } from './voiceTranscriptionTypes';

export interface VoiceTranscriptionModalShellProps {
	isOpen: boolean;
	onClose: () => void;
	t: TFunction<'docEditorPanels'>;
	embeddedModalZ: { backdrop: number; content: number };
	mode: ProcessingMode;
	setMode: (mode: ProcessingMode) => void;
	children: React.ReactNode;
}

export function VoiceTranscriptionModalShell({
	isOpen,
	onClose,
	t,
	embeddedModalZ,
	mode,
	setMode,
	children,
}: VoiceTranscriptionModalShellProps) {
	return (
		<AnimatePresence>
			{isOpen ? (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className={cn(
						'fixed inset-0 flex items-center justify-center',
						DESKTOP_OVERLAY.backdrop
					)}
					style={{ zIndex: embeddedModalZ.backdrop }}
					onClick={onClose}
				>
					<motion.div
						initial={{ scale: 0.9, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						exit={{ scale: 0.9, opacity: 0 }}
						transition={{
							type: 'spring' as const,
							stiffness: 100,
							damping: 15,
						}}
						className="flex h-[90vh] w-full max-w-6xl min-w-0 flex-col overflow-hidden rounded-2xl border border-(--desktop-border-strong) bg-(--desktop-surface-panel-strong) shadow-(--desktop-shadow-panel) backdrop-blur-xl"
						style={{ zIndex: embeddedModalZ.content }}
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex shrink-0 min-w-0 items-center justify-between gap-3 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-6">
							<div className="flex min-w-0 items-center gap-3">
								<div className="shrink-0 rounded-xl border border-[rgb(var(--desktop-accent-rgb))]/35 bg-(--desktop-surface-accent) p-2">
									<MicrophoneIcon
										width={24}
										height={24}
										className="text-(--desktop-text-primary)"
									/>
								</div>
								<div className="min-w-0">
									<h2 className="text-xl font-bold text-(--desktop-text-primary)">
										{t('voice.title')}
									</h2>
									<p className="text-sm text-(--desktop-text-muted) antialiased">
										{t('voice.subtitle')}
									</p>
								</div>
							</div>
							<DesktopAppButton
								onClick={onClose}
								variant="ghost"
								size="icon"
								aria-label={t('voice.close')}
								className="min-h-11 min-w-11"
							>
								<XMarkIcon
									width={20}
									height={20}
									className="text-(--desktop-text-muted)"
								/>
							</DesktopAppButton>
						</div>

						<div className="flex min-w-0 shrink-0 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 pt-3">
							{[
								{
									mode: 'record' as ProcessingMode,
									icon: MicrophoneIcon,
									label: t('voice.tabRecord'),
								},
								{
									mode: 'upload' as ProcessingMode,
									icon: ArrowUpTrayIcon,
									label: t('voice.tabUpload'),
								},
								{
									mode: 'synthesize' as ProcessingMode,
									icon: SpeakerWaveIcon,
									label: t('voice.tabSynth'),
								},
							].map(({ mode: modeOption, icon: Icon, label }) => (
								<button
									type="button"
									key={modeOption}
									onClick={() => setMode(modeOption)}
									className={`min-h-11 min-w-0 flex-1 rounded-t-xl px-4 py-4 text-center text-sm font-medium transition-colors sm:px-6 ${
										mode === modeOption
											? 'border border-b-transparent border-[rgb(var(--desktop-accent-rgb))]/35 bg-(--desktop-surface-accent) text-(--desktop-text-primary)'
											: 'text-(--desktop-text-muted) hover:text-(--desktop-text-primary)'
									}`}
								>
									<Icon width={16} height={16} className="inline mr-2" />
									{label}
								</button>
							))}
						</div>

						<div className="min-h-0 min-w-0 flex-1 overflow-hidden bg-(--desktop-surface-app)">
							{children}
						</div>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
