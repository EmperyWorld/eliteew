/**
 * Success Modal with Confetti - Universal Modal Component
 * Success feedback modal with animated confetti celebration
 *
 * @version 1.0.0
 * @date 2025-10-13
 * @react-version 19.2.0
 *
 * Features:
 * - Confetti explosion animation (100 particles)
 * - Checkmark with scale animation
 * - Custom success message
 * - Action buttons
 * - Auto-close option (3s default)
 * - Share functionality
 */

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
	ArrowDownTrayIcon,
	ArrowTopRightOnSquareIcon,
	CheckIcon,
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { DESKTOP_Z_INDEX } from '@/pages/Desktop/constants';
import { ModalAdvanced } from '../ModalAdvanced';
import { ButtonV2 } from '../ButtonV2';
import { log } from '../../../utils/logger';

/* ============================================================================
   TYPES
   ============================================================================ */

export interface SuccessModalProps {
	isOpen: boolean;
	onClose: () => void;
	title?: string;
	message?: string;
	actionLabel?: string;
	onAction?: () => void;
	showShareButton?: boolean;
	showDownloadButton?: boolean;
	/** При нажатии «ArrowDownTrayIcon» вызывается этот колбэк (например, скачать файл по URL или экспорт). */
	onDownload?: () => void | Promise<void>;
	autoClose?: boolean;
	autoCloseDuration?: number;
	confettiCount?: number;
}

interface ConfettiParticle {
	id: number;
	x: number;
	y: number;
	rotation: number;
	color: string;
	size: number;
	duration: number;
	delay: number;
}

/* ============================================================================
   SUCCESS MODAL COMPONENT
   ============================================================================ */

export const SuccessModal: React.FC<SuccessModalProps> = ({
	isOpen,
	onClose,
	title = 'Success!',
	message = 'Your action was completed successfully.',
	actionLabel = 'Continue',
	onAction,
	showShareButton = false,
	showDownloadButton = false,
	onDownload,
	autoClose = false,
	autoCloseDuration = 3000,
	confettiCount = 100,
}) => {
	const [countdown, setCountdown] = useState<number | null>(null);

	/* ==========================================================================
     AUTO-CLOSE FUNCTIONALITY
     ========================================================================== */

	useEffect(() => {
		if (isOpen && autoClose) {
			setCountdown(Math.ceil(autoCloseDuration / 1000));

			const countdownInterval = setInterval(() => {
				setCountdown((prev) => {
					if (prev === null || prev <= 1) {
						clearInterval(countdownInterval);
						return null;
					}
					return prev - 1;
				});
			}, 1000);

			const autoCloseTimeout = setTimeout(() => {
				onClose();
			}, autoCloseDuration);

			return (): void => {
				clearInterval(countdownInterval);
				clearTimeout(autoCloseTimeout);
			};
		} else {
			setCountdown(null);
		}
	}, [isOpen, autoClose, autoCloseDuration, onClose]);

	/* ==========================================================================
     CONFETTI GENERATION
     ========================================================================== */

	const confettiParticles = useMemo<ConfettiParticle[]>(() => {
		const colors = [
			'#EC4899', // pink
			'#8B5CF6', // purple
			'#3B82F6', // blue
			'#10B981', // green
			'#F59E0B', // orange
			'#EF4444', // red
			'#14B8A6', // teal
			'#F97316', // orange
		];

		return Array.from({ length: confettiCount }, (_, i) => ({
			id: i,
			x: Math.random() * 100 - 50, // -50 to 50
			y: Math.random() * 100 - 50,
			rotation: Math.random() * 720 - 360,
			color: colors[Math.floor(Math.random() * colors.length)],
			size: Math.random() * 12 + 4, // 4 to 16px
			duration: Math.random() * 2 + 1, // 1 to 3s
			delay: Math.random() * 0.3, // 0 to 0.3s
		}));
	}, [confettiCount]); // Re-generate when confetti count changes

	/* ==========================================================================
     HANDLERS
     ========================================================================== */

	const handleAction = (): void => {
		if (onAction) {
			onAction();
		}
		onClose();
	};

	const handleShare = async (): Promise<void> => {
		if (navigator.share) {
			try {
				await navigator.share({
					title: title,
					text: message,
				});
			} catch (error) {
				log.error(
					'SuccessModal',
					'Failed to share',
					error instanceof Error ? error : undefined,
					error
				);
			}
		}
	};

	const handleDownload = (): void => {
		if (onDownload) {
			void Promise.resolve(onDownload()).catch((e) =>
				log.error('SuccessModal download', e)
			);
		} else {
			log.info(
				'SuccessModal',
				'ArrowDownTrayIcon triggered (onDownload not provided)'
			);
		}
	};

	/* ==========================================================================
     RENDER
     ========================================================================== */

	return (
		<ModalAdvanced
			isOpen={isOpen}
			onClose={onClose}
			animation="zoom"
			size="md"
			variant="gradient"
			closeOnOverlay={!autoClose}
			closeOnEscape={!autoClose}
			showCloseButton={!autoClose}
		>
			<div className="relative py-8 overflow-hidden">
				{/* Confetti Particles */}
				<AnimatePresence>
					{isOpen && (
						<div className="absolute inset-0 pointer-events-none">
							{confettiParticles.map((particle) => (
								<motion.div
									key={particle.id}
									className="absolute top-1/2 left-1/2"
									initial={{
										x: 0,
										y: 0,
										opacity: 1,
										rotate: 0,
										scale: 0,
									}}
									animate={{
										x: `${particle.x}vw`,
										y: `${particle.y}vh`,
										opacity: 0,
										rotate: particle.rotation,
										scale: 1,
									}}
									transition={{
										duration: particle.duration,
										delay: particle.delay,
										ease: 'easeOut' as const,
									}}
								>
									<div
										style={{
											width: `${particle.size}px`,
											height: `${particle.size}px`,
											backgroundColor: particle.color,
											borderRadius: '2px',
										}}
									/>
								</motion.div>
							))}
						</div>
					)}
				</AnimatePresence>

				{/* Success Icon with Scale Animation */}
				<motion.div
					className="flex justify-center mb-6"
					initial={{ scale: 0, rotate: -180 }}
					animate={{ scale: 1, rotate: 0 }}
					transition={{
						type: 'spring',
						stiffness: 200,
						damping: 15,
						duration: 0.6,
					}}
				>
					<div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/50">
						<CheckIcon className="w-10 h-10 text-white" strokeWidth={3} />
					</div>
				</motion.div>

				{/* Title */}
				<motion.h2
					className="text-3xl font-bold text-white text-center mb-3"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.2 }}
				>
					{title}
				</motion.h2>

				{/* Message */}
				<motion.p
					className="text-white/80 text-center mb-8 max-w-md mx-auto"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.3 }}
				>
					{message}
				</motion.p>

				{/* Auto-close Countdown */}
				{autoClose && countdown !== null && (
					<motion.div
						className="text-center mb-6"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.4 }}
					>
						<p className="text-sm text-white/60">
							Closing in {countdown} second{countdown !== 1 ? 's' : ''}...
						</p>
						<div className="w-32 h-1 bg-white/20 rounded-full mx-auto mt-2 overflow-hidden">
							<motion.div
								className="h-full bg-green-400"
								initial={{ width: '100%' }}
								animate={{ width: '0%' }}
								transition={{
									duration: autoCloseDuration / 1000,
									ease: 'linear' as const,
								}}
							/>
						</div>
					</motion.div>
				)}

				{/* Action Buttons */}
				<motion.div
					className="flex items-center justify-center gap-3"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.4 }}
				>
					{showShareButton && (
						<ButtonV2
							variant="ghost"
							size="md"
							onClick={handleShare}
							iconLeft={<ArrowTopRightOnSquareIcon width={16} height={16} />}
						>
							Share
						</ButtonV2>
					)}

					{showDownloadButton && (
						<ButtonV2
							variant="ghost"
							size="md"
							onClick={handleDownload}
							iconLeft={<ArrowDownTrayIcon width={16} height={16} />}
						>
							ArrowDownTrayIcon
						</ButtonV2>
					)}

					<ButtonV2
						variant="success"
						size="lg"
						onClick={handleAction || onClose}
						className="min-w-[140px]"
					>
						{actionLabel}
					</ButtonV2>
				</motion.div>

				{/* Pulse Ring Animation */}
				<motion.div
					className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border-2 border-green-400 pointer-events-none"
					initial={{ scale: 0, opacity: 0.8 }}
					animate={{ scale: 3, opacity: 0 }}
					transition={{ duration: 1.5, ease: 'easeOut' as const }}
				/>
			</div>
		</ModalAdvanced>
	);
};

/* ============================================================================
   QUICK SUCCESS TOAST (Alternative Usage)
   ============================================================================ */

export const showSuccessToast = (message: string, duration = 3000): void => {
	const toastId = `success-toast-${Date.now()}`;

	const toastElement = document.createElement('div');
	toastElement.id = toastId;
	toastElement.className = 'fixed bottom-6 right-6';
	toastElement.style.zIndex = String(DESKTOP_Z_INDEX.TOAST);

	const style = document.createElement('style');
	style.textContent = `
    @keyframes confetti-fall {
      to {
        transform: translate(var(--x), var(--y)) rotate(720deg);
        opacity: 0;
      }
    }
    @keyframes slide-in {
      from {
        transform: translateX(100px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;

	const card = document.createElement('div');
	card.style.position = 'relative';
	card.style.background =
		'linear-gradient(135deg, rgba(16, 185, 129, 0.9), rgba(5, 150, 105, 0.9))';
	card.style.backdropFilter = 'blur(20px)';
	card.style.padding = '16px 24px';
	card.style.borderRadius = '12px';
	card.style.border = '1px solid rgba(255, 255, 255, 0.2)';
	card.style.boxShadow = '0 20px 60px rgba(0, 0, 0, 0.3)';
	card.style.animation = 'slide-in 0.3s ease-out';

	const row = document.createElement('div');
	row.style.position = 'relative';
	row.style.zIndex = '10';
	row.style.display = 'flex';
	row.style.alignItems = 'center';
	row.style.gap = '12px';

	const iconWrap = document.createElement('div');
	iconWrap.style.width = '32px';
	iconWrap.style.height = '32px';
	iconWrap.style.background = 'rgba(255, 255, 255, 0.2)';
	iconWrap.style.borderRadius = '50%';
	iconWrap.style.display = 'flex';
	iconWrap.style.alignItems = 'center';
	iconWrap.style.justifyContent = 'center';

	const svgNS = 'http://www.w3.org/2000/svg';
	const svg = document.createElementNS(svgNS, 'svg');
	svg.setAttribute('width', '20');
	svg.setAttribute('height', '20');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('stroke', 'white');
	svg.setAttribute('stroke-width', '3');
	const polyline = document.createElementNS(svgNS, 'polyline');
	polyline.setAttribute('points', '20 6 9 17 4 12');
	svg.appendChild(polyline);
	iconWrap.appendChild(svg);

	const messageSpan = document.createElement('span');
	messageSpan.style.color = 'white';
	messageSpan.style.fontWeight = '600';
	messageSpan.textContent = message;

	row.appendChild(iconWrap);
	row.appendChild(messageSpan);
	card.appendChild(row);

	const confettiColors = [
		'#EC4899',
		'#8B5CF6',
		'#3B82F6',
		'#10B981',
		'#F59E0B',
	];
	for (let i = 0; i < 30; i += 1) {
		const particle = document.createElement('div');
		const color =
			confettiColors[Math.floor(Math.random() * confettiColors.length)] ??
			confettiColors[0];
		const x = Math.random() * 200 - 100;
		const y = Math.random() * 200 - 100;
		particle.style.position = 'absolute';
		particle.style.width = '8px';
		particle.style.height = '8px';
		particle.style.background = color;
		particle.style.animation = 'confetti-fall 1.5s ease-out forwards';
		particle.style.animationDelay = `${Math.random() * 0.3}s`;
		particle.style.setProperty('--x', `${x}px`);
		particle.style.setProperty('--y', `${y}px`);
		card.appendChild(particle);
	}

	toastElement.appendChild(style);
	toastElement.appendChild(card);
	document.body.appendChild(toastElement);

	setTimeout(() => {
		toastElement.style.transition = 'opacity 0.3s, transform 0.3s';
		toastElement.style.opacity = '0';
		toastElement.style.transform = 'translateX(100px)';
		setTimeout(() => {
			document.body.removeChild(toastElement);
		}, 300);
	}, duration);
};

export default SuccessModal;
