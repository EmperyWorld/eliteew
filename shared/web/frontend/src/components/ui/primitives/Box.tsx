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

type SpacingValue = keyof typeof tokens.spacing;
type RadiusValue = keyof typeof tokens.radius;
type ColorValue = string;

interface BoxOwnProps {
	as?: ElementType;

	// Spacing
	p?: SpacingValue;
	px?: SpacingValue;
	py?: SpacingValue;
	pt?: SpacingValue;
	pr?: SpacingValue;
	pb?: SpacingValue;
	pl?: SpacingValue;

	m?: SpacingValue;
	mx?: SpacingValue;
	my?: SpacingValue;
	mt?: SpacingValue;
	mr?: SpacingValue;
	mb?: SpacingValue;
	ml?: SpacingValue;

	// Colors
	bg?: ColorValue;
	color?: ColorValue;
	borderColor?: ColorValue;

	// Border radius
	rounded?: RadiusValue;
	roundedTop?: RadiusValue;
	roundedBottom?: RadiusValue;
	roundedLeft?: RadiusValue;
	roundedRight?: RadiusValue;

	// Display & Layout
	display?: CSSProperties['display'];
	flex?: CSSProperties['flex'];
	flexDirection?: CSSProperties['flexDirection'];
	alignItems?: CSSProperties['alignItems'];
	justifyContent?: CSSProperties['justifyContent'];
	gap?: SpacingValue;

	// Sizing
	w?: CSSProperties['width'];
	h?: CSSProperties['height'];
	minW?: CSSProperties['minWidth'];
	minH?: CSSProperties['minHeight'];
	maxW?: CSSProperties['maxWidth'];
	maxH?: CSSProperties['maxHeight'];

	// Position
	position?: CSSProperties['position'];
	top?: CSSProperties['top'];
	right?: CSSProperties['right'];
	bottom?: CSSProperties['bottom'];
	left?: CSSProperties['left'];
	zIndex?: CSSProperties['zIndex'];

	// Border
	border?: string;
	borderWidth?: CSSProperties['borderWidth'];
	borderStyle?: CSSProperties['borderStyle'];

	// Effects
	opacity?: CSSProperties['opacity'];
	shadow?: keyof typeof tokens.shadows;

	// Custom styles (escape hatch)
	style?: CSSProperties;
	className?: string;
}

type BoxProps<C extends ElementType = 'div'> = BoxOwnProps &
	Omit<ComponentPropsWithRef<C>, keyof BoxOwnProps>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Resolve color value from token path or raw value
 */
function resolveColor(color: string): string {
	// Handle token paths like "marketing.pink.500"
	if (color.includes('.')) {
		const parts = color.split('.');
		let value: unknown = tokens.colors;

		for (const part of parts) {
			if (value && typeof value === 'object' && part in value) {
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
 * Resolve shadow value from token path
 */
function resolveShadow(shadowKey: keyof typeof tokens.shadows): string {
	const shadowValue = tokens.shadows[shadowKey];

	// If it's already a string, return it
	if (typeof shadowValue === 'string') {
		return shadowValue;
	}

	// If it's an object (like marketing shadows), use the default value
	if (
		typeof shadowValue === 'object' &&
		shadowValue !== null &&
		'default' in shadowValue
	) {
		const defaultValue = (shadowValue as Record<string, unknown>).default;
		return typeof defaultValue === 'string' ? defaultValue : 'none';
	}

	// Fallback to no shadow
	return 'none';
}

/**
 * Build styles object from props
 */
function buildStyles(props: BoxOwnProps): CSSProperties {
	const styles: CSSProperties = {};

	// Padding
	if (props.p !== undefined) {
		styles.padding = tokens.spacing[props.p];
	}
	if (props.px !== undefined) {
		styles.paddingLeft = tokens.spacing[props.px];
		styles.paddingRight = tokens.spacing[props.px];
	}
	if (props.py !== undefined) {
		styles.paddingTop = tokens.spacing[props.py];
		styles.paddingBottom = tokens.spacing[props.py];
	}
	if (props.pt !== undefined) {
		styles.paddingTop = tokens.spacing[props.pt];
	}
	if (props.pr !== undefined) {
		styles.paddingRight = tokens.spacing[props.pr];
	}
	if (props.pb !== undefined) {
		styles.paddingBottom = tokens.spacing[props.pb];
	}
	if (props.pl !== undefined) {
		styles.paddingLeft = tokens.spacing[props.pl];
	}

	// Margin
	if (props.m !== undefined) {
		styles.margin = tokens.spacing[props.m];
	}
	if (props.mx !== undefined) {
		styles.marginLeft = tokens.spacing[props.mx];
		styles.marginRight = tokens.spacing[props.mx];
	}
	if (props.my !== undefined) {
		styles.marginTop = tokens.spacing[props.my];
		styles.marginBottom = tokens.spacing[props.my];
	}
	if (props.mt !== undefined) {
		styles.marginTop = tokens.spacing[props.mt];
	}
	if (props.mr !== undefined) {
		styles.marginRight = tokens.spacing[props.mr];
	}
	if (props.mb !== undefined) {
		styles.marginBottom = tokens.spacing[props.mb];
	}
	if (props.ml !== undefined) {
		styles.marginLeft = tokens.spacing[props.ml];
	}

	// Colors
	if (props.bg) {
		styles.background = resolveColor(props.bg);
	}
	if (props.color) {
		styles.color = resolveColor(props.color);
	}
	if (props.borderColor) {
		styles.borderColor = resolveColor(props.borderColor);
	}

	// Border radius
	if (props.rounded !== undefined) {
		styles.borderRadius = tokens.radius[props.rounded];
	}
	if (props.roundedTop !== undefined) {
		styles.borderTopLeftRadius = tokens.radius[props.roundedTop];
		styles.borderTopRightRadius = tokens.radius[props.roundedTop];
	}
	if (props.roundedBottom !== undefined) {
		styles.borderBottomLeftRadius = tokens.radius[props.roundedBottom];
		styles.borderBottomRightRadius = tokens.radius[props.roundedBottom];
	}
	if (props.roundedLeft !== undefined) {
		styles.borderTopLeftRadius = tokens.radius[props.roundedLeft];
		styles.borderBottomLeftRadius = tokens.radius[props.roundedLeft];
	}
	if (props.roundedRight !== undefined) {
		styles.borderTopRightRadius = tokens.radius[props.roundedRight];
		styles.borderBottomRightRadius = tokens.radius[props.roundedRight];
	}

	// Display & Layout
	if (props.display) {
		styles.display = props.display;
	}
	if (props.flex) {
		styles.flex = props.flex;
	}
	if (props.flexDirection) {
		styles.flexDirection = props.flexDirection;
	}
	if (props.alignItems) {
		styles.alignItems = props.alignItems;
	}
	if (props.justifyContent) {
		styles.justifyContent = props.justifyContent;
	}
	if (props.gap !== undefined) {
		styles.gap = tokens.spacing[props.gap];
	}

	// Sizing
	if (props.w) {
		styles.width = props.w;
	}
	if (props.h) {
		styles.height = props.h;
	}
	if (props.minW) {
		styles.minWidth = props.minW;
	}
	if (props.minH) {
		styles.minHeight = props.minH;
	}
	if (props.maxW) {
		styles.maxWidth = props.maxW;
	}
	if (props.maxH) {
		styles.maxHeight = props.maxH;
	}

	// Position
	if (props.position) {
		styles.position = props.position;
	}
	if (props.top !== undefined) {
		styles.top = props.top;
	}
	if (props.right !== undefined) {
		styles.right = props.right;
	}
	if (props.bottom !== undefined) {
		styles.bottom = props.bottom;
	}
	if (props.left !== undefined) {
		styles.left = props.left;
	}
	if (props.zIndex !== undefined) {
		styles.zIndex = props.zIndex;
	}

	// Border
	if (props.border) {
		styles.border = props.border;
	}
	if (props.borderWidth) {
		styles.borderWidth = props.borderWidth;
	}
	if (props.borderStyle) {
		styles.borderStyle = props.borderStyle;
	}

	// Effects
	if (props.opacity !== undefined) {
		styles.opacity = props.opacity;
	}
	if (props.shadow) {
		styles.boxShadow = resolveShadow(props.shadow);
	}

	return styles;
}

/**
 * Extract style props from all props
 */
function extractStyleProps(props: BoxOwnProps): {
	styleProps: BoxOwnProps;
	restProps: Omit<BoxOwnProps, keyof BoxOwnProps>;
} {
	// Extract all style-related props to separate them from rest props
	// All extracted props are used in buildStyles function
	const {
		as: _as,
		p: _p,
		px: _px,
		py: _py,
		pt: _pt,
		pr: _pr,
		pb: _pb,
		pl: _pl,
		m: _m,
		mx: _mx,
		my: _my,
		mt: _mt,
		mr: _mr,
		mb: _mb,
		ml: _ml,
		bg: _bg,
		color: _color,
		borderColor: _borderColor,
		rounded: _rounded,
		roundedTop: _roundedTop,
		roundedBottom: _roundedBottom,
		roundedLeft: _roundedLeft,
		roundedRight: _roundedRight,
		display: _display,
		flex: _flex,
		flexDirection: _flexDirection,
		alignItems: _alignItems,
		justifyContent: _justifyContent,
		gap: _gap,
		w: _w,
		h: _h,
		minW: _minW,
		minH: _minH,
		maxW: _maxW,
		maxH: _maxH,
		position: _position,
		top: _top,
		right: _right,
		bottom: _bottom,
		left: _left,
		zIndex: _zIndex,
		border: _border,
		borderWidth: _borderWidth,
		borderStyle: _borderStyle,
		opacity: _opacity,
		shadow: _shadow,
		style: _style,
		className: _className,
		...rest
	} = props;

	// Suppress unused variable warnings - these are extracted to separate style props from rest
	void _as;
	void _p;
	void _px;
	void _py;
	void _pt;
	void _pr;
	void _pb;
	void _pl;
	void _m;
	void _mx;
	void _my;
	void _mt;
	void _mr;
	void _mb;
	void _ml;
	void _bg;
	void _color;
	void _borderColor;
	void _rounded;
	void _roundedTop;
	void _roundedBottom;
	void _roundedLeft;
	void _roundedRight;
	void _display;
	void _flex;
	void _flexDirection;
	void _alignItems;
	void _justifyContent;
	void _gap;
	void _w;
	void _h;
	void _minW;
	void _minH;
	void _maxW;
	void _maxH;
	void _position;
	void _top;
	void _right;
	void _bottom;
	void _left;
	void _zIndex;
	void _border;
	void _borderWidth;
	void _borderStyle;
	void _opacity;
	void _shadow;
	void _style;
	void _className;

	return { styleProps: props, restProps: rest };
}

// ============================================================================
// BOX COMPONENT
// ============================================================================

/**
 * Box - Polymorphic base component with design token integration
 * Using React.createElement() pattern for proper polymorphic + forwardRef support
 */
function BoxInner<C extends ElementType = 'div'>(
	props: BoxProps<C>,
	ref: React.Ref<HTMLElement>
): React.ReactElement | null {
	const {
		as: Component = 'div',
		style: customStyle,
		className,
		...restProps
	} = props;
	const { styleProps } = extractStyleProps(props);

	const computedStyles: CSSProperties = {
		...buildStyles(styleProps),
		...customStyle,
	};

	return React.createElement(Component, {
		ref,
		className,
		style: computedStyles,
		...restProps,
	});
}

// Create the forwarded component
const BoxComponent = React.forwardRef(BoxInner) as <
	C extends ElementType = 'div',
>(
	props: BoxProps<C> & { ref?: React.Ref<HTMLElement> }
) => React.ReactElement | null;

// Add displayName
if (
	typeof BoxComponent === 'object' &&
	BoxComponent !== null &&
	'displayName' in BoxComponent
) {
	(BoxComponent as { displayName: string }).displayName = 'Box';
}

export const Box = BoxComponent;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type { BoxProps, BoxOwnProps };
