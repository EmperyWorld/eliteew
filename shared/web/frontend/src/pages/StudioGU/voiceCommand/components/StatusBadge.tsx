import * as React from 'react';
import {
	statusBadgeDotClasses,
	statusBadgeShellClasses,
} from '../utils/voiceCommandSurfaceStyles';

export interface StatusBadgeProps {
	label: string;
	active: boolean;
	title?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
	label,
	active,
	title,
}) => (
	<div
		className={`flex select-none items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tracking-wide ${statusBadgeShellClasses(active)}`}
		title={title}
	>
		<div
			className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusBadgeDotClasses(active)}`}
		/>
		{label}
	</div>
);
