/**
 * Widget Error State Component
 * Professional error handling for BI Dashboard widgets
 * with retry functionality and helpful error messages
 *
 * @version 1.0.0
 * @date 2025-10-24
 */

import * as React from 'react';
import {
	ArrowPathIcon,
	ArrowTopRightOnSquareIcon,
	ExclamationCircleIcon,
	ExclamationTriangleIcon,
	LockClosedIcon,
	SignalSlashIcon,
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
export type ErrorType =
	| 'network'
	| 'server'
	| 'auth'
	| 'permission'
	| 'timeout'
	| 'generic';

interface WidgetErrorStateProps {
	error?: Error | string;
	errorType?: ErrorType;
	message?: string;
	onRetry?: () => void;
	onNavigate?: () => void;
	retryLabel?: string;
	navigateLabel?: string;
	className?: string;
	compact?: boolean;
}

/**
 * Widget Error State
 * Displays contextual error information with recovery actions
 */
export const WidgetErrorState: React.FC<WidgetErrorStateProps> = ({
	error,
	errorType = 'generic',
	message,
	onRetry,
	onNavigate,
	retryLabel = 'Повторить',
	navigateLabel = 'Открыть модуль',
	className = '',
	compact = false,
}) => {
	// Get error configuration based on type
	const getErrorConfig = () => {
		const configs = {
			network: {
				icon: SignalSlashIcon,
				iconColor: 'text-orange-400',
				bgGradient: 'from-orange-500/20 to-yellow-500/20',
				borderColor: 'border-orange-500/30',
				title: 'Проблема с подключением',
				description: 'Проверьте интернет-соединение и попробуйте снова',
			},
			server: {
				icon: ExclamationTriangleIcon,
				iconColor: 'text-red-400',
				bgGradient: 'from-red-500/20 to-pink-500/20',
				borderColor: 'border-red-500/30',
				title: 'Ошибка сервера',
				description: 'Не удалось загрузить данные. Попробуйте позже',
			},
			auth: {
				icon: LockClosedIcon,
				iconColor: 'text-yellow-400',
				bgGradient: 'from-yellow-500/20 to-orange-500/20',
				borderColor: 'border-yellow-500/30',
				title: 'Требуется авторизация',
				description: 'Войдите в систему для доступа к данным',
			},
			permission: {
				icon: LockClosedIcon,
				iconColor: 'text-amber-400',
				bgGradient: 'from-amber-500/20 to-yellow-500/20',
				borderColor: 'border-amber-500/30',
				title: 'Доступ запрещен',
				description: 'У вас нет прав для просмотра этих данных',
			},
			timeout: {
				icon: ExclamationTriangleIcon,
				iconColor: 'text-orange-400',
				bgGradient: 'from-orange-500/20 to-red-500/20',
				borderColor: 'border-orange-500/30',
				title: 'Превышено время ожидания',
				description: 'Запрос занял слишком много времени',
			},
			generic: {
				icon: ExclamationCircleIcon,
				iconColor: 'text-red-400',
				bgGradient: 'from-red-500/20 to-rose-500/20',
				borderColor: 'border-red-500/30',
				title: 'Ошибка загрузки',
				description: 'Не удалось загрузить данные виджета',
			},
		};

		return configs[errorType] || configs.generic;
	};

	const config = getErrorConfig();
	const Icon = config.icon;

	// Extract error message
	const errorMessage =
		message ||
		(typeof error === 'string' ? error : error?.message) ||
		config.description;

	// Compact version for small widgets
	if (compact) {
		return (
			<motion.div
				className={`flex items-center justify-center h-full ${className}`}
				initial={{ opacity: 0, scale: 0.95 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.2 }}
			>
				<div className="text-center px-4">
					<motion.div
						initial={{ scale: 0 }}
						animate={{ scale: 1 }}
						transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
					>
						<Icon className={`w-8 h-8 ${config.iconColor} mx-auto mb-2`} />
					</motion.div>
					<p className="text-xs text-white/70 mb-2">{config.title}</p>
					{onRetry && (
						<motion.button
							onClick={onRetry}
							className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-sm text-xs text-white/80 hover:text-white transition-all flex items-center gap-1 mx-auto"
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
						>
							<ArrowPathIcon width={12} height={12} />
							{retryLabel}
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
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3 }}
		>
			<div
				className={`max-w-md w-full p-6 rounded-xl bg-linear-to-br ${config.bgGradient} border ${config.borderColor} backdrop-blur-xl`}
			>
				{/* Icon */}
				<motion.div
					className="mb-4"
					initial={{ scale: 0, rotate: -180 }}
					animate={{ scale: 1, rotate: 0 }}
					transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
				>
					<div
						className={`w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mx-auto`}
					>
						<Icon className={`w-6 h-6 ${config.iconColor}`} />
					</div>
				</motion.div>

				{/* Title */}
				<motion.h4
					className="text-lg font-semibold text-white text-center mb-2"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.2 }}
				>
					{config.title}
				</motion.h4>

				{/* Description */}
				<motion.p
					className="text-sm text-white/70 text-center mb-4"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.3 }}
				>
					{errorMessage}
				</motion.p>

				{/* Error details (in development mode) */}
				{process.env.NODE_ENV === 'development' &&
					error &&
					typeof error !== 'string' && (
						<motion.details
							className="mb-4"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.4 }}
						>
							<summary className="text-xs text-white/50 cursor-pointer hover:text-white/70 mb-2">
								Детали ошибки (dev)
							</summary>
							<pre className="text-xs text-white/60 bg-black/20 p-2 rounded-sm overflow-x-auto">
								{error.stack || error.message}
							</pre>
						</motion.details>
					)}

				{/* Actions */}
				<motion.div
					className="flex items-center justify-center gap-3"
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.4 }}
				>
					{onRetry && (
						<motion.button
							onClick={onRetry}
							className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm text-white font-medium transition-all flex items-center gap-2"
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
						>
							<ArrowPathIcon width={14} height={14} />
							{retryLabel}
						</motion.button>
					)}

					{onNavigate && (
						<motion.button
							onClick={onNavigate}
							className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 rounded-lg text-sm text-purple-300 hover:text-purple-200 font-medium transition-all flex items-center gap-2"
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
						>
							{navigateLabel}
							<ArrowTopRightOnSquareIcon width={14} height={14} />
						</motion.button>
					)}
				</motion.div>

				{/* Help text */}
				{errorType === 'permission' && (
					<motion.p
						className="text-xs text-white/50 text-center mt-4"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.5 }}
					>
						Обратитесь к администратору для получения доступа
					</motion.p>
				)}

				{errorType === 'auth' && (
					<motion.p
						className="text-xs text-white/50 text-center mt-4"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.5 }}
					>
						Возможно, истек срок действия вашей сессии
					</motion.p>
				)}
			</div>
		</motion.div>
	);
};

export default WidgetErrorState;
