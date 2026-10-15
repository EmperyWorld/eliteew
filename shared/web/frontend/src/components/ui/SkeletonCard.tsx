/**
 * Skeleton Card Component
 * Loading skeleton for card layouts
 *
 * @version 1.0.0
 * @date 2025-10-13
 */

import * as React from 'react';
import { motion } from 'framer-motion';

interface SkeletonCardProps {
	variant?: 'default' | 'stat' | 'feature';
	className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
	variant = 'default',
	className = '',
}) => {
	const baseClasses = 'p-6 rounded-xl';
	const glassStyle = {
		background: 'rgba(15, 23, 42, 0.6)',
		backdropFilter: 'blur(12px)',
		border: '1px solid rgba(255, 255, 255, 0.1)',
	};

	// Pulsing animation
	const pulseVariants = {
		initial: { opacity: 0.4 },
		animate: {
			opacity: [0.4, 0.6, 0.4],
			transition: {
				duration: 1.5,
				repeat: Infinity,
				ease: 'easeInOut' as const,
			},
		},
	};

	if (variant === 'stat') {
		return (
			<div className={`${baseClasses} ${className}`} style={glassStyle}>
				{/* Icon skeleton */}
				<motion.div
					className="w-10 h-10 rounded-lg bg-white/10 mb-4"
					variants={pulseVariants}
					initial="initial"
					animate="animate"
				/>

				{/* Value skeleton */}
				<motion.div
					className="h-8 w-20 bg-white/10 rounded-sm mb-2"
					variants={pulseVariants}
					initial="initial"
					animate="animate"
				/>

				{/* Label skeleton */}
				<motion.div
					className="h-4 w-32 bg-white/10 rounded-sm"
					variants={pulseVariants}
					initial="initial"
					animate="animate"
				/>
			</div>
		);
	}

	if (variant === 'feature') {
		return (
			<div className={`${baseClasses} ${className}`} style={glassStyle}>
				{/* Icon + count row */}
				<div className="flex items-start justify-between mb-4">
					<motion.div
						className="w-12 h-12 rounded-xl bg-white/10"
						variants={pulseVariants}
						initial="initial"
						animate="animate"
					/>
					<motion.div
						className="w-8 h-6 rounded-full bg-white/10"
						variants={pulseVariants}
						initial="initial"
						animate="animate"
					/>
				</div>

				{/* Title skeleton */}
				<motion.div
					className="h-5 w-3/4 bg-white/10 rounded-sm mb-2"
					variants={pulseVariants}
					initial="initial"
					animate="animate"
				/>

				{/* Description skeleton */}
				<motion.div
					className="h-4 w-full bg-white/10 rounded-sm"
					variants={pulseVariants}
					initial="initial"
					animate="animate"
				/>
			</div>
		);
	}

	// Default variant
	return (
		<div className={`${baseClasses} ${className}`} style={glassStyle}>
			{/* Icon skeleton */}
			<motion.div
				className="w-12 h-12 rounded-xl bg-white/10 mb-4"
				variants={pulseVariants}
				initial="initial"
				animate="animate"
			/>

			{/* Title skeleton */}
			<motion.div
				className="h-6 w-3/4 bg-white/10 rounded-sm mb-3"
				variants={pulseVariants}
				initial="initial"
				animate="animate"
			/>

			{/* Description skeleton - 2 lines */}
			<div className="space-y-2">
				<motion.div
					className="h-4 w-full bg-white/10 rounded-sm"
					variants={pulseVariants}
					initial="initial"
					animate="animate"
				/>
				<motion.div
					className="h-4 w-2/3 bg-white/10 rounded-sm"
					variants={pulseVariants}
					initial="initial"
					animate="animate"
				/>
			</div>

			{/* Footer skeleton */}
			<motion.div
				className="h-4 w-24 bg-white/10 rounded-sm mt-4"
				variants={pulseVariants}
				initial="initial"
				animate="animate"
			/>
		</div>
	);
};

export default SkeletonCard;
