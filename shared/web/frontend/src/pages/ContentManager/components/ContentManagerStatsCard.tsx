import * as React from 'react';
import { useMemo } from 'react';
import { cn } from '../../../utils/cn';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import { useDesktopShellFrame } from '../../Desktop/context/DesktopShellFrameContext';
import {
	getDesktopShellContentPanelClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '../../Desktop/utils/desktopVisualSystem';

/** Stats tile using shell content panel preset (desktop window). */
export const StatsCard: React.FC<{
	title: string;
	value: string | number;
	icon: React.ReactNode;
}> = ({ title, value, icon }) => {
	const shellFrame = useDesktopShellFrame();
	const shellCardClass = useMemo(
		() => getDesktopShellContentPanelClassName(shellFrame),
		[shellFrame]
	);
	const shellIconWell = useMemo(
		() =>
			cn(
				'shrink-0 rounded-xl p-2.5',
				getDesktopShellToolbarClusterInsetControlClassName(shellFrame)
			),
		[shellFrame]
	);
	return (
		<div className={cn(shellCardClass, 'flex min-h-0 items-center gap-4 p-4')}>
			<div className={shellIconWell}>{icon}</div>
			<div className="min-w-0">
				<div className="text-xl font-semibold text-(--desktop-text-primary) tabular-nums truncate tracking-tight">
					{value}
				</div>
				<div className={cn(DESKTOP_TYPOGRAPHY.meta, 'mt-0.5 font-medium')}>
					{title}
				</div>
			</div>
		</div>
	);
};
