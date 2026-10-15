/**
 * Spinner - Unified Loading Spinner (CSS-only, no animation library)
 *
 * @version 1.1.0
 * Features: size/color variants, spin/pulse/dots, a11y, no extra bundle.
 */

import * as React from 'react';
import type { CSSProperties } from 'react';
import { tokens } from '@/styles/tokens';

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type SpinnerColor = 'pink' | 'purple' | 'blue' | 'green' | 'amber' | 'white';
type SpinnerType = 'spin' | 'pulse' | 'dots';

interface SpinnerProps {
	size?: SpinnerSize;
	color?: SpinnerColor;
	type?: SpinnerType;
	label?: string;
	className?: string;
	style?: CSSProperties;
}

const sizeMap: Record<SpinnerSize, string> = {
	xs: '12px',
	sm: '16px',
	md: '24px',
	lg: '32px',
	xl: '48px',
};

function getColorValue(color: SpinnerColor): string {
	if (color === 'white') return tokens.colors.white[100];
	return tokens.colors.marketing[color][500];
}

const SpinSpinner: React.FC<{ size: string; color: string }> = ({
	size,
	color,
}) => (
	<div
		className="ew-spinner-ring"
		style={{
			width: size,
			height: size,
			borderWidth: '2px',
			borderColor: tokens.colors.white[10],
			borderTopColor: color,
		}}
	/>
);

const PulseSpinner: React.FC<{ size: string; color: string }> = ({
	size,
	color,
}) => (
	<div
		className="ew-spinner-pulse"
		style={{
			width: size,
			height: size,
			background: color,
		}}
	/>
);

const DotsSpinner: React.FC<{ size: string; color: string }> = ({
	size,
	color,
}) => {
	const dotSize = `calc(${size} / 2.8)`;
	const gap = `calc(${size} / 5)`;
	return (
		<div style={{ display: 'flex', alignItems: 'center', gap }}>
			{[0, 1, 2].map((i) => (
				<div
					key={i}
					className="ew-spinner-dot"
					style={{
						width: dotSize,
						height: dotSize,
						borderRadius: '9999px',
						background: color,
					}}
				/>
			))}
		</div>
	);
};

export const Spinner: React.FC<SpinnerProps> = ({
	size = 'md',
	color = 'purple',
	type = 'spin',
	label,
	className = '',
	style,
}) => {
	const sizeValue = sizeMap[size];
	const colorValue = getColorValue(color);

	return (
		<div
			className={`spinner spinner-${type} spinner-${size} ${className}`}
			style={{
				display: 'inline-flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				gap: tokens.spacing[2],
				...style,
			}}
			role="status"
			aria-label={label || 'Loading'}
		>
			{type === 'spin' && <SpinSpinner size={sizeValue} color={colorValue} />}
			{type === 'pulse' && <PulseSpinner size={sizeValue} color={colorValue} />}
			{type === 'dots' && <DotsSpinner size={sizeValue} color={colorValue} />}
			{label && (
				<span
					style={{
						fontSize: tokens.typography.fontSize.sm,
						color: tokens.colors.white[70],
						marginTop: tokens.spacing[2],
					}}
				>
					{label}
				</span>
			)}
			<span className="sr-only">{label || 'Loading'}</span>
		</div>
	);
};

Spinner.displayName = 'Spinner';
export type { SpinnerProps, SpinnerSize, SpinnerColor, SpinnerType };
export default Spinner;
