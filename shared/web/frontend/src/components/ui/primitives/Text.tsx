/**
 * @fileoverview Polymorphic Text primitive with typography tokens
 *
 * @role UI Design System Primitive
 *   - Primary responsibility: Typography component with design token integration
 *   - Used by: All higher-level components that need text rendering
 *   - Design tokens: fontSize, fontWeight, lineHeight, colors, gradients
 *
 * @architecture
 *   - Layer: UI Primitive Layer (lowest level)
 *   - Pattern: Polymorphic Component with forwardRef
 *   - Flexibility: Can render as any text element (span, p, h1-h6, etc.)
 *
 * @examples
 *   ```typescript
 *   <Text size="lg" weight="bold">Bold large text</Text>
 *   <Text as="h1" size="4xl" weight="black">Heading</Text>
 *   <Text color="white.60" truncate>Long text...</Text>
 *   <Text gradient="primary">Gradient text</Text>
 *   ```
 *
 * @status
 *   - TypeScript errors fixed: 5 errors in this audit
 *   - Last audit: 2025-10-23 - Agent 3 (UI Primitives)
 *   - Pattern: Using React.createElement() for polymorphic components
 */

import * as React from 'react';
import {
	type ElementType,
	type ComponentPropsWithRef,
	type CSSProperties,
} from 'react';
import { tokens } from '@/styles/tokens';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type TextSize = keyof typeof tokens.typography.fontSize;
type TextWeight = keyof typeof tokens.typography.fontWeight;
type TextAlign = 'left' | 'center' | 'right' | 'justify';
type TextTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize';
type GradientVariant = keyof typeof tokens.gradients.marketing;

interface TextOwnProps {
	as?: ElementType;
	size?: TextSize;
	weight?: TextWeight;
	align?: TextAlign;
	transform?: TextTransform;
	color?: string;
	gradient?: GradientVariant;
	truncate?: boolean;
	lineClamp?: number;
	noWrap?: boolean;
	italic?: boolean;
	underline?: boolean;
	children?: React.ReactNode;
}

type TextProps<C extends ElementType = 'span'> = TextOwnProps &
	Omit<ComponentPropsWithRef<C>, keyof TextOwnProps>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Resolve color value from token path or raw value
 */
function resolveColor(color: string): string {
	// Handle token paths like "white.60"
	if (color.includes('.')) {
		const parts = color.split('.');
		let value: unknown = tokens.colors;

		for (const part of parts) {
			if (typeof value === 'object' && value !== null && part in value) {
				value = (value as Record<string, unknown>)[part];
			} else {
				return color;
			}
		}

		return typeof value === 'string' ? value : color;
	}

	// Return as-is (raw color value)
	return color;
}

/**
 * Build text styles from props
 */
function buildTextStyles(props: TextOwnProps): CSSProperties {
	const styles: CSSProperties = {
		margin: 0,
		padding: 0,
	};

	// Typography
	if (props.size) {
		styles.fontSize = tokens.typography.fontSize[props.size];
	}

	if (props.weight) {
		styles.fontWeight = tokens.typography.fontWeight[props.weight];
	}

	// Alignment
	if (props.align) {
		styles.textAlign = props.align;
	}

	// Transform
	if (props.transform) {
		styles.textTransform = props.transform;
	}

	// Color or Gradient
	if (props.gradient) {
		styles.background = tokens.gradients.marketing[props.gradient];
		styles.WebkitBackgroundClip = 'text';
		styles.WebkitTextFillColor = 'transparent';
		styles.backgroundClip = 'text';
	} else if (props.color) {
		styles.color = resolveColor(props.color);
	}

	// Truncation
	if (props.truncate) {
		styles.overflow = 'hidden';
		styles.textOverflow = 'ellipsis';
		styles.whiteSpace = 'nowrap';
	}

	// Line clamp (multi-line truncation)
	if (props.lineClamp && props.lineClamp > 0) {
		styles.display = '-webkit-box';
		styles.WebkitLineClamp = props.lineClamp;
		styles.WebkitBoxOrient = 'vertical';
		styles.overflow = 'hidden';
	}

	// No wrap
	if (props.noWrap) {
		styles.whiteSpace = 'nowrap';
	}

	// Italic
	if (props.italic) {
		styles.fontStyle = 'italic';
	}

	// Underline
	if (props.underline) {
		styles.textDecoration = 'underline';
	}

	return styles;
}

// ============================================================================
// TEXT COMPONENT
// ============================================================================

/**
 * Text component with design token integration
 * Using React.createElement() pattern for proper polymorphic + forwardRef support
 */
function TextInner<C extends ElementType = 'span'>(
	props: TextProps<C>,
	ref: React.Ref<HTMLElement>
): React.ReactElement | null {
	const {
		as: Component = 'span',
		size,
		weight,
		align,
		transform,
		color,
		gradient,
		truncate,
		lineClamp,
		noWrap,
		italic,
		underline,
		children,
		style: customStyle,
		className = '',
		...restProps
	} = props;

	const textStyles = buildTextStyles({
		size,
		weight,
		align,
		transform,
		color,
		gradient,
		truncate,
		lineClamp,
		noWrap,
		italic,
		underline,
	});

	const computedStyles: CSSProperties = {
		...textStyles,
		...customStyle,
	};

	return React.createElement(
		Component,
		{
			ref,
			className: `text ${className}`,
			style: computedStyles,
			...restProps,
		},
		children
	);
}

// Create the forwarded component
const TextComponent = React.forwardRef(TextInner) as <
	C extends ElementType = 'span',
>(
	props: TextProps<C> & { ref?: React.Ref<HTMLElement> }
) => React.ReactElement | null;

// Add displayName
if (
	typeof TextComponent === 'object' &&
	TextComponent !== null &&
	'displayName' in TextComponent
) {
	(TextComponent as { displayName: string }).displayName = 'Text';
}

export const Text = TextComponent;

// ============================================================================
// CONVENIENCE COMPONENTS
// ============================================================================

/**
 * Heading component (h1-h6)
 */
export const Heading = React.forwardRef<HTMLHeadingElement, TextProps<'h2'>>(
	(props, ref) => {
		return React.createElement(Text, {
			ref,
			as: 'h2',
			weight: 'bold',
			...props,
		});
	}
);

Heading.displayName = 'Heading';

/**
 * Paragraph component
 */
export const Paragraph = React.forwardRef<HTMLParagraphElement, TextProps<'p'>>(
	(props, ref) => {
		return React.createElement(Text, {
			ref,
			as: 'p',
			size: 'base',
			style: {
				lineHeight: tokens.typography.lineHeight.relaxed,
				...props.style,
			},
			...props,
		});
	}
);

Paragraph.displayName = 'Paragraph';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type { TextProps, TextOwnProps, TextSize, TextWeight };
