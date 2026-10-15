/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Task type icons for UGS Hub task rows and quick-launch grid.
 *
 * Related:
 * - components/UGSHub.tsx, UgsHubQuickLaunchSection.tsx
 */

import {
	ChatBubbleLeftRightIcon,
	DocumentTextIcon,
	PhotoIcon,
	SparklesIcon,
	SpeakerWaveIcon,
} from '@heroicons/react/24/outline';
import type { ReactElement } from 'react';

import { DESKTOP_LUCIDE } from '../../../../pages/Desktop/constants';

export function getUgsHubTaskIcon(typeKey: string): ReactElement {
	const iconProps = {
		width: 20,
		height: 20,
		strokeWidth: DESKTOP_LUCIDE.stroke,
		'aria-hidden': true as const,
	};
	const key = typeKey.toLowerCase();
	if (key.includes('text') || key.includes('chat')) {
		return <ChatBubbleLeftRightIcon {...iconProps} />;
	}
	if (key.includes('image') || key.includes('banner') || key.includes('logo')) {
		return <PhotoIcon {...iconProps} />;
	}
	if (key.includes('audio') || key.includes('voice') || key.includes('tts')) {
		return <SpeakerWaveIcon {...iconProps} />;
	}
	if (
		key.includes('document') ||
		key.includes('pdf') ||
		key.includes('analysis')
	) {
		return <DocumentTextIcon {...iconProps} />;
	}
	return <SparklesIcon {...iconProps} />;
}
