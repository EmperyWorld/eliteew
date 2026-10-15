/**
 * Global design tokens for EliteEW
 * Aggregates viewer, voice and desktop tokens into a single source of truth.
 *
 * NOTE: используем только строковые alias'ы и готовые tailwind-классы,
 *       без жёстких значений в компонентах.
 */

import viewerDesignTokens from '@/components/ui/viewer/designTokens';
import { designTokens as liveVoiceDesignTokens } from '@/components/LiveVoiceWidget/designTokens';
import {
	DESKTOP_DESIGN_TOKENS,
	DESKTOP_TYPOGRAPHY,
	DESKTOP_INTERACTIVE,
	DESKTOP_OVERLAY,
	DESKTOP_ICON_SIZES,
	DESKTOP_Z_INDEX,
	TASKBAR,
} from '@/pages/Desktop/constants';

export const themeDesignTokens = {
	viewer: viewerDesignTokens,
	liveVoice: liveVoiceDesignTokens,
	desktop: {
		cssVars: DESKTOP_DESIGN_TOKENS,
		typography: DESKTOP_TYPOGRAPHY,
		interactive: DESKTOP_INTERACTIVE,
		overlay: DESKTOP_OVERLAY,
		iconSizes: DESKTOP_ICON_SIZES,
		zIndex: DESKTOP_Z_INDEX,
		taskbar: TASKBAR,
	},
} as const;

export type ThemeDesignTokens = typeof themeDesignTokens;

export default themeDesignTokens;
