/**
 * Widget Loading Skeleton Component
 * Professional loading skeletons for BI Dashboard widgets
 * with progressive loading pattern and shimmer animation
 *
 * @version 1.0.0
 * @date 2025-10-24
 */

import * as React from 'react';
import { useId } from 'react';
import { motion } from 'framer-motion';

export type SkeletonType =
	| 'swot-health'
	| 'porters'
	| 'chart'
	| 'list'
	| 'stats'
	| 'card';

interface WidgetLoadingSkeletonProps {
	type: SkeletonType;
	height?: string;
	className?: string;
}

/**
 * Widget Loading Skeleton
 * Provides different skeleton layouts matching widget types
 */
export const WidgetLoadingSkeleton: React.FC<WidgetLoadingSkeletonProps> = ({
	type,
	height = '300px',
	className = '',
}) => {
	const wid = useId();

	// Shimmer animation keyframes
	const shimmerVariants = {
		initial: { opacity: 0.4 },
		animate: {
			opacity: [0.4, 0.8, 0.4],
			transition: {
				duration: 1.5,
				repeat: Infinity,
				ease: 'easeInOut' as const,
			},
		},
	};

	// Gradient shimmer animation
	const ShimmerBar: React.FC<{ className?: string; delay?: number }> = ({
		className = '',
		delay = 0,
	}) => (
		<motion.div
			className={`bg-white/10 rounded-sm ${className}`}
			variants={shimmerVariants}
			initial="initial"
			animate="animate"
			transition={{ delay }}
		/>
	);

	// SWOT Health Score Skeleton (circular progress + bars)
	if (type === 'swot-health') {
		return (
			<div
				className={`h-full flex flex-col space-y-4 ${className}`}
				style={{ minHeight: height }}
			>
				{/* Header */}
				<div className="flex items-center justify-between">
					<ShimmerBar className="h-4 w-32" />
					<ShimmerBar className="h-6 w-6 rounded-sm" delay={0.1} />
				</div>

				{/* Circular progress skeleton */}
				<div className="flex items-center justify-center">
					<motion.div
						className="relative w-32 h-32"
						initial={{ scale: 0.9, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						transition={{ duration: 0.3 }}
					>
						{/* Background circle */}
						<svg className="w-full h-full transform -rotate-90">
							<title>Loading</title>
							<circle
								cx="64"
								cy="64"
								r="58"
								fill="none"
								stroke="rgba(255,255,255,0.1)"
								strokeWidth="8"
							/>
							{/* Animated shimmer circle */}
							<motion.circle
								cx="64"
								cy="64"
								r="58"
								fill="none"
								stroke="rgba(168,85,247,0.3)"
								strokeWidth="8"
								strokeLinecap="round"
								strokeDasharray="364.4"
								strokeDashoffset="91.1"
								animate={{
									strokeDashoffset: [91.1, 0, 91.1],
								}}
								transition={{
									duration: 2,
									repeat: Infinity,
									ease: 'easeInOut',
								}}
							/>
						</svg>
						{/* Center content */}
						<div className="absolute inset-0 flex flex-col items-center justify-center">
							<ShimmerBar className="h-8 w-16 mb-1" />
							<ShimmerBar className="h-3 w-20" delay={0.1} />
						</div>
					</motion.div>
				</div>

				{/* Progress bars skeleton */}
				<div className="space-y-2">
					{[0, 0.1, 0.2, 0.3].map((delay) => (
						<div key={`${wid}-swot-bar-${delay}`} className="space-y-1">
							<div className="flex items-center justify-between">
								<ShimmerBar className="h-3 w-20" delay={delay} />
								<ShimmerBar className="h-3 w-6" delay={delay + 0.05} />
							</div>
							<div className="h-2 bg-white/10 rounded-full overflow-hidden">
								<motion.div
									className="h-full bg-linear-to-r from-purple-500/50 to-pink-500/50 rounded-full"
									initial={{ width: 0 }}
									animate={{ width: ['0%', '70%', '40%'] }}
									transition={{
										duration: 2,
										repeat: Infinity,
										delay,
										ease: 'easeInOut',
									}}
								/>
							</div>
						</div>
					))}
				</div>

				{/* Footer */}
				<ShimmerBar className="h-3 w-40 mx-auto" delay={0.4} />
			</div>
		);
	}

	// Porter's Forces Skeleton (pentagon + mini cards)
	if (type === 'porters') {
		return (
			<div
				className={`h-full flex flex-col space-y-3 ${className}`}
				style={{ minHeight: height }}
			>
				{/* Header */}
				<div className="flex items-center justify-between">
					<ShimmerBar className="h-4 w-32" />
					<div className="flex items-center gap-2">
						<ShimmerBar className="h-4 w-16" delay={0.1} />
						<ShimmerBar className="h-6 w-6 rounded-sm" delay={0.15} />
					</div>
				</div>

				{/* Business info */}
				<div className="space-y-1">
					<ShimmerBar className="h-3 w-3/4" delay={0.2} />
					<div className="flex items-center justify-between">
						<ShimmerBar className="h-3 w-24" delay={0.25} />
						<ShimmerBar className="h-5 w-16 rounded-full" delay={0.3} />
					</div>
				</div>

				{/* Pentagon visualization skeleton */}
				<div className="bg-white/5 rounded-lg p-2 border border-white/10">
					<motion.div
						className="w-full h-32 flex items-center justify-center"
						initial={{ opacity: 0 }}
						animate={{ opacity: [0.3, 0.6, 0.3] }}
						transition={{ duration: 2, repeat: Infinity }}
					>
						<svg
							width="120"
							height="120"
							viewBox="0 0 100 100"
							className="text-purple-500/30"
						>
							<title>Loading</title>
							<polygon
								points="50,10 90,35 75,75 25,75 10,35"
								fill="currentColor"
								stroke="rgba(168,85,247,0.5)"
								strokeWidth="2"
							/>
						</svg>
					</motion.div>
				</div>

				{/* Mini cards grid */}
				<div className="grid grid-cols-5 gap-1">
					{[0, 0.05, 0.1, 0.15, 0.2].map((delay) => (
						<div
							key={`${wid}-porter-card-${delay}`}
							className="p-1.5 rounded-sm bg-white/5 border border-white/10"
						>
							<ShimmerBar className="h-2 w-full mb-1" delay={delay} />
							<ShimmerBar className="h-3 w-8 mb-1" delay={delay + 0.05} />
							<div className="h-0.5 rounded-full bg-white/10" />
						</div>
					))}
				</div>

				{/* Attractiveness score */}
				<div className="p-3 rounded-lg bg-linear-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
					<div className="flex items-center justify-between">
						<ShimmerBar className="h-3 w-32" delay={0.3} />
						<ShimmerBar className="h-6 w-12" delay={0.35} />
					</div>
				</div>
			</div>
		);
	}

	// Chart Skeleton (for analytics widgets)
	if (type === 'chart') {
		return (
			<div
				className={`h-full flex flex-col space-y-4 ${className}`}
				style={{ minHeight: height }}
			>
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<ShimmerBar className="h-5 w-5 rounded-sm" />
						<ShimmerBar className="h-4 w-32" delay={0.05} />
					</div>
					<ShimmerBar className="h-6 w-20 rounded-sm" delay={0.1} />
				</div>

				{/* Stats row */}
				<div className="grid grid-cols-3 gap-2">
					{[0, 0.05, 0.1].map((delay) => (
						<div
							key={`${wid}-chart-stat-${delay}`}
							className="p-2 rounded-sm bg-white/5 border border-white/10"
						>
							<ShimmerBar className="h-3 w-16 mb-1" delay={delay} />
							<ShimmerBar className="h-5 w-12" delay={delay + 0.05} />
						</div>
					))}
				</div>

				{/* Chart bars */}
				<div className="flex-1 flex items-end justify-between gap-2 px-2">
					{[60, 80, 45, 90, 55, 70].map((barHeight, i) => (
						<motion.div
							key={`${wid}-chart-bar-${barHeight}`}
							className="flex-1 bg-linear-to-t from-purple-500/30 to-pink-500/30 rounded-t"
							initial={{ height: 0 }}
							animate={{ height: `${barHeight}%` }}
							transition={{ duration: 0.5, delay: i * 0.1 }}
						/>
					))}
				</div>

				{/* Legend */}
				<div className="flex items-center justify-center gap-4">
					{[0, 0.1].map((delay) => (
						<div
							key={`${wid}-chart-leg-${delay}`}
							className="flex items-center gap-1"
						>
							<ShimmerBar className="h-2 w-2 rounded-full" delay={delay} />
							<ShimmerBar className="h-3 w-16" delay={delay + 0.05} />
						</div>
					))}
				</div>
			</div>
		);
	}

	// List Skeleton (for insights, activities)
	if (type === 'list') {
		return (
			<div
				className={`h-full flex flex-col space-y-3 ${className}`}
				style={{ minHeight: height }}
			>
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<ShimmerBar className="h-4 w-4 rounded-sm" />
						<ShimmerBar className="h-4 w-24" delay={0.05} />
					</div>
					<ShimmerBar className="h-6 w-16 rounded-sm" delay={0.1} />
				</div>

				{/* List items */}
				<div className="flex-1 space-y-2">
					{[0, 0.1, 0.2, 0.3].map((delay) => (
						<motion.div
							key={`${wid}-list-${delay}`}
							className="p-3 rounded-lg bg-white/5 border border-white/10"
							initial={{ opacity: 0, x: -10 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay, duration: 0.3 }}
						>
							<div className="flex items-start gap-2">
								<ShimmerBar
									className="h-4 w-4 rounded-sm mt-0.5"
									delay={delay}
								/>
								<div className="flex-1 space-y-2">
									<ShimmerBar className="h-3 w-3/4" delay={delay + 0.05} />
									<ShimmerBar className="h-3 w-full" delay={delay + 0.1} />
									<div className="flex items-center justify-between">
										<ShimmerBar className="h-2 w-16" delay={delay + 0.15} />
										<ShimmerBar className="h-2 w-20" delay={delay + 0.2} />
									</div>
								</div>
							</div>
						</motion.div>
					))}
				</div>
			</div>
		);
	}

	// Stats Skeleton (for KPI, metrics)
	if (type === 'stats') {
		return (
			<div
				className={`h-full flex flex-col space-y-4 ${className}`}
				style={{ minHeight: height }}
			>
				{/* Header */}
				<div className="flex items-center justify-between">
					<ShimmerBar className="h-4 w-28" />
					<ShimmerBar className="h-6 w-6 rounded-sm" delay={0.05} />
				</div>

				{/* Main stat */}
				<div className="text-center py-4">
					<ShimmerBar className="h-10 w-32 mx-auto mb-2" />
					<ShimmerBar className="h-3 w-40 mx-auto" delay={0.1} />
				</div>

				{/* Sub stats grid */}
				<div className="grid grid-cols-2 gap-3">
					{[0, 0.05, 0.1, 0.15].map((delay) => (
						<div
							key={`${wid}-stats-${delay}`}
							className="p-3 rounded-lg bg-white/5 border border-white/10 text-center"
						>
							<ShimmerBar className="h-6 w-16 mx-auto mb-1" delay={delay} />
							<ShimmerBar className="h-3 w-20 mx-auto" delay={delay + 0.05} />
						</div>
					))}
				</div>

				{/* Trend indicator */}
				<div className="flex items-center justify-center gap-2 pt-2">
					<ShimmerBar className="h-4 w-4 rounded-sm" delay={0.2} />
					<ShimmerBar className="h-3 w-32" delay={0.25} />
				</div>
			</div>
		);
	}

	// Card Skeleton (default fallback)
	return (
		<div
			className={`h-full flex flex-col space-y-4 p-4 ${className}`}
			style={{ minHeight: height }}
		>
			{/* Header with icon */}
			<div className="flex items-center gap-3">
				<ShimmerBar className="h-10 w-10 rounded-lg" />
				<div className="flex-1 space-y-2">
					<ShimmerBar className="h-4 w-3/4" />
					<ShimmerBar className="h-3 w-1/2" delay={0.1} />
				</div>
			</div>

			{/* Content lines */}
			<div className="flex-1 space-y-2">
				<ShimmerBar className="h-3 w-full" delay={0.2} />
				<ShimmerBar className="h-3 w-full" delay={0.25} />
				<ShimmerBar className="h-3 w-4/5" delay={0.3} />
			</div>

			{/* Footer */}
			<div className="flex items-center justify-between pt-2 border-t border-white/10">
				<ShimmerBar className="h-3 w-24" delay={0.35} />
				<ShimmerBar className="h-6 w-16 rounded-sm" delay={0.4} />
			</div>
		</div>
	);
};

export default WidgetLoadingSkeleton;
