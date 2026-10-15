/**
 * Widget Empty State Component
 * Professional empty states for BI Dashboard widgets
 * with contextual illustrations and call-to-action
 *
 * @version 1.0.0
 * @date 2025-10-24
 */

import * as React from 'react';
import type { ComponentType, SVGProps } from 'react';
import { motion } from 'framer-motion';
interface WidgetEmptyStateProps {
	icon: ComponentType<SVGProps<SVGSVGElement>>;
	title: string;
	description?: string;
	action?: {
		label: string;
		onClick: () => void;
		icon?: ComponentType<SVGProps<SVGSVGElement>>;
	};
	secondaryAction?: {
		label: string;
		onClick: () => void;
		icon?: ComponentType<SVGProps<SVGSVGElement>>;
	};
	className?: string;
	compact?: boolean;
	variant?: 'default' | 'success' | 'info' | 'warning';
}

/**
 * Widget Empty State
 * Displays contextual empty state with optional actions
 */
export const WidgetEmptyState: React.FC<WidgetEmptyStateProps> = ({
	icon: Icon,
	title,
	description,
	action,
	secondaryAction,
	className = '',
	compact = false,
	variant = 'default',
}) => {
	// Get variant styling
	const getVariantStyles = () => {
		const variants = {
			default: {
				iconColor: 'text-white/20',
				iconBg: 'bg-white/5',
				titleColor: 'text-white/80',
				descColor: 'text-white/60',
				primaryButton:
					'bg-purple-500/20 hover:bg-purple-500/30 border-purple-500/40 text-purple-300 hover:text-purple-200',
				secondaryButton:
					'bg-white/10 hover:bg-white/20 border-white/20 text-white/80 hover:text-white',
			},
			success: {
				iconColor: 'text-green-400/60',
				iconBg: 'bg-green-500/10',
				titleColor: 'text-green-300',
				descColor: 'text-green-200/70',
				primaryButton:
					'bg-green-500/20 hover:bg-green-500/30 border-green-500/40 text-green-300 hover:text-green-200',
				secondaryButton:
					'bg-white/10 hover:bg-white/20 border-white/20 text-white/80 hover:text-white',
			},
			info: {
				iconColor: 'text-blue-400/60',
				iconBg: 'bg-blue-500/10',
				titleColor: 'text-blue-300',
				descColor: 'text-blue-200/70',
				primaryButton:
					'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/40 text-blue-300 hover:text-blue-200',
				secondaryButton:
					'bg-white/10 hover:bg-white/20 border-white/20 text-white/80 hover:text-white',
			},
			warning: {
				iconColor: 'text-yellow-400/60',
				iconBg: 'bg-yellow-500/10',
				titleColor: 'text-yellow-300',
				descColor: 'text-yellow-200/70',
				primaryButton:
					'bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/40 text-yellow-300 hover:text-yellow-200',
				secondaryButton:
					'bg-white/10 hover:bg-white/20 border-white/20 text-white/80 hover:text-white',
			},
		};

		return variants[variant];
	};

	const styles = getVariantStyles();

	// Compact version for smaller widgets
	if (compact) {
		return (
			<motion.div
				className={`flex items-center justify-center h-full ${className}`}
				initial={{ opacity: 0, scale: 0.95 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.3 }}
			>
				<div className="text-center px-4">
					{/* Icon */}
					<motion.div
						initial={{ scale: 0, rotate: -90 }}
						animate={{ scale: 1, rotate: 0 }}
						transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
						className="mb-3"
					>
						<Icon className={`w-10 h-10 ${styles.iconColor} mx-auto`} />
					</motion.div>

					{/* Title */}
					<motion.p
						className={`text-sm font-medium ${styles.titleColor} mb-2`}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.2 }}
					>
						{title}
					</motion.p>

					{/* Description (if provided) */}
					{description && (
						<motion.p
							className={`text-xs ${styles.descColor} mb-3 line-clamp-2`}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.25 }}
						>
							{description}
						</motion.p>
					)}

					{/* Primary action */}
					{action && (
						<motion.button
							onClick={action.onClick}
							className={`px-3 py-1.5 border rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 mx-auto ${styles.primaryButton}`}
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.3 }}
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
						>
							{action.icon &&
								React.createElement(action.icon, {
									width: 12,
									height: 12,
								})}
							{action.label}
						</motion.button>
					)}
				</div>
			</motion.div>
		);
	}

	// Full version for larger widgets
	return (
		<motion.div
			className={`flex items-center justify-center h-full ${className}`}
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4 }}
		>
			<div className="text-center px-6 py-8 max-w-md">
				{/* Animated icon with background */}
				<motion.div
					className="mb-6"
					initial={{ scale: 0, rotate: -180 }}
					animate={{ scale: 1, rotate: 0 }}
					transition={{
						type: 'spring',
						stiffness: 150,
						damping: 12,
						delay: 0.1,
					}}
				>
					<div
						className={`w-16 h-16 rounded-2xl ${styles.iconBg} flex items-center justify-center mx-auto backdrop-blur-xl border border-white/10`}
					>
						<Icon className={`w-8 h-8 ${styles.iconColor}`} />
					</div>
				</motion.div>

				{/* Title */}
				<motion.h4
					className={`text-lg font-semibold ${styles.titleColor} mb-2`}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.2 }}
				>
					{title}
				</motion.h4>

				{/* Description */}
				{description && (
					<motion.p
						className={`text-sm ${styles.descColor} mb-6 leading-relaxed`}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.3 }}
					>
						{description}
					</motion.p>
				)}

				{/* Actions */}
				{(action || secondaryAction) && (
					<motion.div
						className="flex items-center justify-center gap-3 flex-wrap"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.4 }}
					>
						{action && (
							<motion.button
								onClick={action.onClick}
								className={`px-4 py-2.5 border rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${styles.primaryButton}`}
								whileHover={{ scale: 1.05 }}
								whileTap={{ scale: 0.95 }}
							>
								{action.icon &&
									React.createElement(action.icon, {
										width: 16,
										height: 16,
									})}
								{action.label}
							</motion.button>
						)}

						{secondaryAction && (
							<motion.button
								onClick={secondaryAction.onClick}
								className={`px-4 py-2.5 border rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${styles.secondaryButton}`}
								whileHover={{ scale: 1.05 }}
								whileTap={{ scale: 0.95 }}
							>
								{secondaryAction.icon &&
									React.createElement(secondaryAction.icon, {
										width: 16,
										height: 16,
									})}
								{secondaryAction.label}
							</motion.button>
						)}
					</motion.div>
				)}

				{/* Decorative elements */}
				<motion.div
					className="absolute inset-0 -z-10 opacity-20"
					initial={{ opacity: 0 }}
					animate={{ opacity: 0.1 }}
					transition={{ delay: 0.5 }}
				>
					<div className="absolute top-1/4 left-1/4 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl" />
					<div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-pink-500/20 rounded-full blur-3xl" />
				</motion.div>
			</div>
		</motion.div>
	);
};

export default WidgetEmptyState;
