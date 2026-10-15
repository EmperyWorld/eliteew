/**
 * @fileoverview Stack Components (VStack, HStack)
 *
 * @role Flex-based layout components with design token spacing
 *   - Primary responsibility: Provide vertical and horizontal stack layouts
 *   - Used by: UI components throughout the application
 *   - Dependencies: Design tokens for spacing
 *
 * @architecture
 *   - Layer: UI Component / Primitive
 *   - Pattern: Polymorphic React components with forwardRef
 *   - Integration: Foundation layout component for consistent spacing
 *
 * @status
 *   - TypeScript: Fixed polymorphic component type definitions
 *   - Last audit: 2025-10-23 - Resolved forwardRef generic type issues
 *
 * @examples
 *   ```tsx
 *   <VStack spacing={4} align="start">
 *     <div>Item 1</div>
 *     <div>Item 2</div>
 *   </VStack>
 *
 *   <HStack spacing={6} justify="between" align="center">
 *     <Button>Left</Button>
 *     <Button>Right</Button>
 *   </HStack>
 *   ```
 *
 * @maintainer EliteEW Team
 * @since 2025-10-13
 * @updated 2025-10-23 - TypeScript audit and fixes
 */

import * as React from 'react';
import {
	forwardRef,
	type ElementType,
	type ComponentPropsWithRef,
	type CSSProperties,
} from 'react';
import { tokens } from '@/styles/tokens';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type SpacingValue = keyof typeof tokens.spacing;
type AlignItems = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
type JustifyContent =
	| 'start'
	| 'center'
	| 'end'
	| 'between'
	| 'around'
	| 'evenly';
type FlexWrap = 'wrap' | 'nowrap' | 'wrap-reverse';

interface StackOwnProps {
	as?: ElementType;
	spacing?: SpacingValue;
	align?: AlignItems;
	justify?: JustifyContent;
	wrap?: FlexWrap;
	divider?: React.ReactNode;
	children?: React.ReactNode;
}

type StackProps<C extends ElementType = 'div'> = StackOwnProps &
	Omit<ComponentPropsWithRef<C>, keyof StackOwnProps>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function mapAlignItems(align?: AlignItems): CSSProperties['alignItems'] {
	switch (align) {
		case 'start':
			return 'flex-start';
		case 'end':
			return 'flex-end';
		case 'center':
			return 'center';
		case 'stretch':
			return 'stretch';
		case 'baseline':
			return 'baseline';
		default:
			return undefined;
	}
}

function mapJustifyContent(
	justify?: JustifyContent
): CSSProperties['justifyContent'] {
	switch (justify) {
		case 'start':
			return 'flex-start';
		case 'end':
			return 'flex-end';
		case 'center':
			return 'center';
		case 'between':
			return 'space-between';
		case 'around':
			return 'space-around';
		case 'evenly':
			return 'space-evenly';
		default:
			return undefined;
	}
}

// ============================================================================
// VSTACK COMPONENT
// ============================================================================

/**
 * VStack - Vertical Stack Component
 * Flex column layout with vertical spacing
 */
const VStackInner = forwardRef(function VStack<C extends ElementType = 'div'>(
	props: StackProps<C>,
	ref: React.Ref<Element>
) {
	const {
		as,
		spacing = 4,
		align,
		justify,
		wrap = 'nowrap',
		divider,
		children,
		style,
		className = '',
		...restProps
	} = props;

	const Component = (as || 'div') as ElementType;

	const stackStyles: CSSProperties = {
		display: 'flex',
		flexDirection: 'column',
		gap: divider ? 0 : tokens.spacing[spacing],
		alignItems: mapAlignItems(align),
		justifyContent: mapJustifyContent(justify),
		flexWrap: wrap,
		...style,
	};

	// Render with dividers if provided
	if (divider) {
		const childArray = React.Children.toArray(children);

		return React.createElement(
			Component,
			{
				ref,
				className: `vstack ${className}`,
				style: stackStyles,
				...restProps,
			},
			childArray.map((child, index) =>
				React.createElement(
					React.Fragment,
					{ key: index },
					child,
					index < childArray.length - 1 &&
						React.createElement(
							'div',
							{
								style: {
									marginTop: tokens.spacing[spacing],
									marginBottom: tokens.spacing[spacing],
								},
							},
							divider
						)
				)
			)
		);
	}

	return React.createElement(
		Component,
		{
			ref,
			className: `vstack ${className}`,
			style: stackStyles,
			...restProps,
		},
		children
	);
});

VStackInner.displayName = 'VStack';

export const VStack = VStackInner as <C extends ElementType = 'div'>(
	props: StackProps<C> & { ref?: React.Ref<Element> }
) => React.ReactElement;

// ============================================================================
// HSTACK COMPONENT
// ============================================================================

/**
 * HStack - Horizontal Stack Component
 * Flex row layout with horizontal spacing
 */
const HStackInner = forwardRef(function HStack<C extends ElementType = 'div'>(
	props: StackProps<C>,
	ref: React.Ref<Element>
) {
	const {
		as,
		spacing = 4,
		align,
		justify,
		wrap = 'nowrap',
		divider,
		children,
		style,
		className = '',
		...restProps
	} = props;

	const Component = (as || 'div') as ElementType;

	const stackStyles: CSSProperties = {
		display: 'flex',
		flexDirection: 'row',
		gap: divider ? 0 : tokens.spacing[spacing],
		alignItems: mapAlignItems(align),
		justifyContent: mapJustifyContent(justify),
		flexWrap: wrap,
		...style,
	};

	// Render with dividers if provided
	if (divider) {
		const childArray = React.Children.toArray(children);

		return React.createElement(
			Component,
			{
				ref,
				className: `hstack ${className}`,
				style: stackStyles,
				...restProps,
			},
			childArray.map((child, index) =>
				React.createElement(
					React.Fragment,
					{ key: index },
					child,
					index < childArray.length - 1 &&
						React.createElement(
							'div',
							{
								style: {
									marginLeft: tokens.spacing[spacing],
									marginRight: tokens.spacing[spacing],
								},
							},
							divider
						)
				)
			)
		);
	}

	return React.createElement(
		Component,
		{
			ref,
			className: `hstack ${className}`,
			style: stackStyles,
			...restProps,
		},
		children
	);
});

HStackInner.displayName = 'HStack';

export const HStack = HStackInner as <C extends ElementType = 'div'>(
	props: StackProps<C> & { ref?: React.Ref<Element> }
) => React.ReactElement;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
	StackProps,
	StackOwnProps,
	SpacingValue,
	AlignItems,
	JustifyContent,
};
