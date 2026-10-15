/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Collapsed Live Voice floating widget chrome (expand / stop recording).
 *
 * Invariants:
 * - Drag handle is separate from the main expand button.
 *
 * Related:
 * - WidgetExpanded.tsx · DesktopChromeTooltip.tsx
 */
import * as React from 'react';
import { memo } from 'react';
import {
	Bars2Icon,
	MicrophoneIcon,
	SparklesIcon,
	SpeakerXMarkIcon,
} from '@heroicons/react/24/outline';
import { motion, useReducedMotion } from 'framer-motion';
import { DesktopChromeTooltip } from '@/pages/Desktop/components/DesktopChromeTooltip';
interface WidgetMinimizedProps {
	isRecording: boolean;
	onClick: () => void;
	onMouseDown?: (e: React.MouseEvent) => void;
	isDragging?: boolean;
	/** Соответствует развёрнутому состоянию родителя (для assistive tech). */
	'aria-expanded'?: boolean;
}

export const WidgetMinimized: React.FC<WidgetMinimizedProps> = memo(
	({
		isRecording,
		onClick,
		onMouseDown,
		isDragging = false,
		'aria-expanded': ariaExpanded = false,
	}) => {
		const reduceMotion = useReducedMotion();

		const expandLabel = isRecording
			? 'Остановить запись'
			: 'Открыть голосовой виджет (нажмите)';

		return (
			<motion.div
				className="relative"
				onMouseDown={(e) => {
					const target = e.target as HTMLElement;
					if (!target.closest('button')) {
						onMouseDown?.(e);
					}
				}}
				data-drag-handle
				initial={{ opacity: 0, scale: 0.8 }}
				animate={{ opacity: 1, scale: 1 }}
				exit={{ opacity: 0, scale: 0.8 }}
				transition={{ duration: 0.2 }}
			>
				<motion.div
					className={`
          pointer-events-auto relative overflow-hidden
          rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)
          bg-[color-mix(in_srgb,var(--desktop-surface-panel-strong)_94%,transparent)]
          p-3 shadow-(--desktop-shadow-panel) backdrop-blur-xl
          ring-1 ring-black/20
          ${isDragging ? 'border-(--desktop-border-strong)' : 'hover:border-(--desktop-border-strong)/70'}
        `}
					whileHover={{ scale: isDragging ? 1 : 1.04 }}
					whileTap={{ scale: 0.95 }}
					animate={isDragging ? { scale: 1.06 } : {}}
				>
					<div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,rgba(255,255,255,0.04)_0%,transparent_45%,rgba(0,0,0,0.12)_100%)]" />

					{/* Drag handle indicator */}
					<div className="absolute right-1 top-1 opacity-35 transition-opacity hover:opacity-70">
						<Bars2Icon
							className="h-3 w-3 text-(--desktop-text-muted)"
							aria-hidden
						/>
					</div>

					<DesktopChromeTooltip
						content={expandLabel}
						placement="top"
						offsetExtra={4}
					>
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onClick();
							}}
							onMouseDown={(e) => e.stopPropagation()}
							className="relative group flex h-14 min-h-11 w-14 min-w-11 touch-manipulation items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-panel)"
							aria-expanded={ariaExpanded}
							aria-label={
								isRecording ? 'Остановить запись' : 'Открыть голосовой виджет'
							}
						>
							{/* Glowing ring when recording */}
							{isRecording && (
								<motion.div
									className="absolute inset-0 rounded-full bg-red-500/20"
									animate={
										reduceMotion
											? { scale: 1, opacity: 0.4 }
											: { scale: [1, 1.3, 1], opacity: [0.5, 0.2, 0.5] }
									}
									transition={
										reduceMotion
											? { duration: 0 }
											: {
													duration: 1.5,
													repeat: Infinity,
													ease: 'easeInOut',
												}
									}
								/>
							)}

							{/* Main icon */}
							<motion.div
								animate={
									isRecording && !reduceMotion
										? { scale: [1, 1.1, 1] }
										: { scale: 1 }
								}
								transition={{
									duration: 0.5,
									repeat: isRecording && !reduceMotion ? Infinity : 0,
								}}
							>
								{isRecording ? (
									<SpeakerXMarkIcon className="relative z-10 h-6 w-6 text-red-400" />
								) : (
									<MicrophoneIcon className="relative z-10 h-6 w-6 text-[rgb(var(--desktop-accent-rgb))]/85 transition-colors group-hover:text-[rgb(var(--desktop-accent-rgb))]" />
								)}
							</motion.div>

							{/* Recording indicator badge */}
							{isRecording && (
								<motion.span
									className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center"
									initial={{ scale: 0 }}
									animate={{ scale: 1 }}
								>
									<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75 motion-reduce:animate-none" />
									<span className="relative inline-flex h-3 w-3 rounded-full border border-zinc-950 bg-red-500" />
								</motion.span>
							)}

							{/* AI sparkle indicator when not recording */}
							{!isRecording && (
								<motion.div
									className="absolute -top-1 -right-1"
									animate={
										reduceMotion ? { rotate: 0 } : { rotate: [0, 15, -15, 0] }
									}
									transition={
										reduceMotion
											? { duration: 0 }
											: { duration: 2, repeat: Infinity }
									}
								>
									<SparklesIcon
										className="h-3 w-3 text-[rgb(var(--desktop-accent-rgb))]/55"
										aria-hidden
									/>
								</motion.div>
							)}
						</button>
					</DesktopChromeTooltip>
				</motion.div>
			</motion.div>
		);
	}
);
