/**
 * Skeleton List Component
 * Loading skeleton for list layouts
 *
 * @version 1.0.0
 * @date 2025-10-13
 */

import * as React from 'react';
import { useId, useMemo } from 'react';
import { motion } from 'framer-motion';

interface SkeletonListProps {
	count?: number;
	variant?: 'row' | 'table' | 'card';
	className?: string;
}

export const SkeletonList: React.FC<SkeletonListProps> = ({
	count = 3,
	variant = 'row',
	className = '',
}) => {
	const baseId = useId();
	const tableRowKeys = useMemo(
		() => Array.from({ length: count }, (_, i) => `${baseId}-table-${i}`),
		[baseId, count]
	);
	const cardKeys = useMemo(
		() => Array.from({ length: count }, (_, i) => `${baseId}-card-${i}`),
		[baseId, count]
	);
	const rowKeys = useMemo(
		() => Array.from({ length: count }, (_, i) => `${baseId}-row-${i}`),
		[baseId, count]
	);

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

	if (variant === 'table') {
		return (
			<div className={`space-y-3 ${className}`}>
				{/* Table header */}
				<div className="flex items-center gap-4 p-4 rounded-lg bg-white/5">
					<motion.div
						className="h-4 w-32 bg-white/10 rounded-sm"
						variants={pulseVariants}
						initial="initial"
						animate="animate"
					/>
					<motion.div
						className="h-4 flex-1 bg-white/10 rounded-sm"
						variants={pulseVariants}
						initial="initial"
						animate="animate"
					/>
					<motion.div
						className="h-4 w-24 bg-white/10 rounded-sm"
						variants={pulseVariants}
						initial="initial"
						animate="animate"
					/>
					<motion.div
						className="h-4 w-20 bg-white/10 rounded-sm"
						variants={pulseVariants}
						initial="initial"
						animate="animate"
					/>
				</div>

				{/* Table rows */}
				{tableRowKeys.map((rowKey, index) => (
					<div
						key={rowKey}
						className="flex items-center gap-4 p-4 rounded-lg"
						style={{
							background: 'rgba(15, 23, 42, 0.6)',
							backdropFilter: 'blur(12px)',
							border: '1px solid rgba(255, 255, 255, 0.1)',
						}}
					>
						<motion.div
							className="h-4 w-32 bg-white/10 rounded-sm"
							variants={pulseVariants}
							initial="initial"
							animate="animate"
							style={{ animationDelay: `${index * 0.1}s` }}
						/>
						<motion.div
							className="h-4 flex-1 bg-white/10 rounded-sm"
							variants={pulseVariants}
							initial="initial"
							animate="animate"
							style={{ animationDelay: `${index * 0.1}s` }}
						/>
						<motion.div
							className="h-4 w-24 bg-white/10 rounded-sm"
							variants={pulseVariants}
							initial="initial"
							animate="animate"
							style={{ animationDelay: `${index * 0.1}s` }}
						/>
						<motion.div
							className="h-4 w-20 bg-white/10 rounded-sm"
							variants={pulseVariants}
							initial="initial"
							animate="animate"
							style={{ animationDelay: `${index * 0.1}s` }}
						/>
					</div>
				))}
			</div>
		);
	}

	if (variant === 'card') {
		return (
			<div
				className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}
			>
				{cardKeys.map((cardKey) => (
					<div
						key={cardKey}
						className="p-6 rounded-xl"
						style={{
							background: 'rgba(15, 23, 42, 0.6)',
							backdropFilter: 'blur(12px)',
							border: '1px solid rgba(255, 255, 255, 0.1)',
						}}
					>
						<motion.div
							className="w-12 h-12 rounded-xl bg-white/10 mb-4"
							variants={pulseVariants}
							initial="initial"
							animate="animate"
						/>
						<motion.div
							className="h-6 w-3/4 bg-white/10 rounded-sm mb-3"
							variants={pulseVariants}
							initial="initial"
							animate="animate"
						/>
						<motion.div
							className="h-4 w-full bg-white/10 rounded-sm mb-2"
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
				))}
			</div>
		);
	}

	// Row variant (default)
	return (
		<div className={`space-y-4 ${className}`}>
			{rowKeys.map((rowKey) => (
				<div
					key={rowKey}
					className="p-4 rounded-lg flex items-center gap-4"
					style={{
						background: 'rgba(15, 23, 42, 0.6)',
						backdropFilter: 'blur(12px)',
						border: '1px solid rgba(255, 255, 255, 0.1)',
					}}
				>
					{/* Icon */}
					<motion.div
						className="w-10 h-10 rounded-lg bg-white/10 shrink-0"
						variants={pulseVariants}
						initial="initial"
						animate="animate"
					/>

					{/* Content */}
					<div className="flex-1 space-y-2">
						<motion.div
							className="h-5 w-3/4 bg-white/10 rounded-sm"
							variants={pulseVariants}
							initial="initial"
							animate="animate"
						/>
						<motion.div
							className="h-4 w-1/2 bg-white/10 rounded-sm"
							variants={pulseVariants}
							initial="initial"
							animate="animate"
						/>
					</div>

					{/* Action */}
					<motion.div
						className="w-20 h-8 rounded-sm bg-white/10 shrink-0"
						variants={pulseVariants}
						initial="initial"
						animate="animate"
					/>
				</div>
			))}
		</div>
	);
};

export default SkeletonList;
