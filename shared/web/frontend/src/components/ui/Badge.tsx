/**
 * 🎨 BADGE COMPONENT
 * Минималистичные бейджи для статусов
 */

import * as React from 'react';
import type { ReactNode } from 'react';

export type BadgeVariant =
	| 'default'
	| 'primary'
	| 'success'
	| 'warning'
	| 'danger'
	| 'info';
export type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
	variant?: BadgeVariant;
	size?: BadgeSize;
	children: ReactNode;
	className?: string;
}

const Badge: React.FC<BadgeProps> = ({
	variant = 'default',
	size = 'md',
	children,
	className = '',
}) => {
	// Размеры
	const sizeClasses = {
		sm: 'px-2 py-0.5 text-xs',
		md: 'px-2.5 py-1 text-sm',
		lg: 'px-3 py-1.5 text-base',
	};

	// Цвета (статичные)
	const variantClasses = {
		default: 'bg-white/10 text-white/80 border border-white/20',
		primary: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
		success: 'bg-green-500/20 text-green-300 border border-green-500/30',
		warning: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
		danger: 'bg-red-500/20 text-red-300 border border-red-500/30',
		info: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
	};

	const baseClasses = `
    inline-flex items-center justify-center
    font-medium rounded-full
    backdrop-blur-xs
    ${sizeClasses[size]}
    ${variantClasses[variant]}
    ${className}
  `;

	return <span className={baseClasses}>{children}</span>;
};

export default Badge;
