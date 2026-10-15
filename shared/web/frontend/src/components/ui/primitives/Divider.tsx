/**
 * Divider - Horizontal/Vertical Divider Component
 * Visual separator with design token integration
 *
 * @version 1.0.0
 * @date 2025-10-13
 *
 * Features:
 * - Horizontal and vertical orientation
 * - Label support
 * - Color variants using design tokens
 * - Thickness variants
 *
 * Usage:
 * ```tsx
 * <Divider />
 * <Divider orientation="vertical" />
 * <Divider label="OR" />
 * <Divider color="pink" thickness="thick" />
 * ```
 */

import * as React from 'react';
import type { CSSProperties } from 'react';
import { tokens } from '@/styles/tokens';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type DividerOrientation = 'horizontal' | 'vertical';
type DividerThickness = 'thin' | 'default' | 'thick';
type DividerColor = 'default' | 'light' | 'pink' | 'purple' | 'blue';

interface DividerProps {
	orientation?: DividerOrientation;
	thickness?: DividerThickness;
	color?: DividerColor;
	label?: string;
	className?: string;
	style?: CSSProperties;
}

// ============================================================================
// STYLE BUILDERS
// ============================================================================

const thicknessMap: Record<DividerThickness, string> = {
	thin: '1px',
	default: '1px',
	thick: '2px',
};

function getColor(color: DividerColor): string {
	switch (color) {
		case 'light':
			return tokens.colors.white[20];
		case 'pink':
			return tokens.colors.marketing.pink[500];
		case 'purple':
			return tokens.colors.marketing.purple[500];
		case 'blue':
			return tokens.colors.marketing.blue[500];
		default:
			return tokens.glass.border.default;
	}
}

// ============================================================================
// DIVIDER COMPONENT
// ============================================================================

/**
 * Divider component with design token integration
 */
export const Divider: React.FC<DividerProps> = ({
	orientation = 'horizontal',
	thickness = 'default',
	color = 'default',
	label,
	className = '',
	style,
}) => {
	const colorValue = getColor(color);
	const thicknessValue = thicknessMap[thickness];

	// Horizontal divider
	if (orientation === 'horizontal') {
		if (label) {
			const containerStyles: CSSProperties = {
				display: 'flex',
				alignItems: 'center',
				gap: tokens.spacing[3],
				width: '100%',
				...style,
			};

			const lineStyles: CSSProperties = {
				flex: 1,
				height: thicknessValue,
				background: colorValue,
			};

			const labelStyles: CSSProperties = {
				fontSize: tokens.typography.fontSize.sm,
				fontWeight: tokens.typography.fontWeight.medium,
				color: tokens.colors.white[60],
				whiteSpace: 'nowrap',
			};

			return (
				<div
					className={`divider divider-horizontal ${className}`}
					style={containerStyles}
				>
					<div style={lineStyles} />
					<span style={labelStyles}>{label}</span>
					<div style={lineStyles} />
				</div>
			);
		}

		const dividerStyles: CSSProperties = {
			width: '100%',
			height: thicknessValue,
			background: colorValue,
			border: 'none',
			margin: 0,
			...style,
		};

		return (
			<hr
				className={`divider divider-horizontal ${className}`}
				style={dividerStyles}
			/>
		);
	}

	// Vertical divider
	const verticalStyles: CSSProperties = {
		width: thicknessValue,
		height: '100%',
		background: colorValue,
		alignSelf: 'stretch',
		...style,
	};

	return (
		<div
			className={`divider divider-vertical ${className}`}
			style={verticalStyles}
		/>
	);
};

Divider.displayName = 'Divider';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
	DividerProps,
	DividerOrientation,
	DividerThickness,
	DividerColor,
};
export default Divider;
