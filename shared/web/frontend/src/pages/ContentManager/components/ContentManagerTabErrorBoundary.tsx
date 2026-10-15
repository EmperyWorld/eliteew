import * as React from 'react';
import { useMemo } from 'react';
import { cn } from '../../../utils/cn';
import { log } from '../../../utils/logger';
import { DesktopAppErrorState } from '../../Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '../../Desktop/context/DesktopShellFrameContext';
import { getDesktopShellContentPanelClassName } from '../../Desktop/utils/desktopVisualSystem';

/** Error fallback uses shell content panel (same preset as the desktop window). */
export function ContentManagerErrorRecoverySurface({
	recoveryTitle,
	recoveryLabel,
	onAction,
}: {
	recoveryTitle: string;
	recoveryLabel: string;
	onAction: () => void;
}): React.ReactElement {
	const shellFrame = useDesktopShellFrame();
	const panelClass = useMemo(
		() => getDesktopShellContentPanelClassName(shellFrame),
		[shellFrame]
	);
	return (
		<div className={cn(panelClass, 'min-h-0 overflow-hidden p-0')}>
			<DesktopAppErrorState
				message={recoveryTitle}
				actionLabel={recoveryLabel}
				onAction={onAction}
			/>
		</div>
	);
}

/** Catches render errors in secondary tabs; recovery remounts optional keyed children from parent. */
export class ContentManagerTabErrorBoundary extends React.Component<
	{
		children: React.ReactNode;
		recoveryTitle: string;
		recoveryLabel: string;
		onRecovery?: () => void;
	},
	{ error: Error | null }
> {
	constructor(props: ContentManagerTabErrorBoundary['props']) {
		super(props);
		this.state = { error: null };
	}

	static getDerivedStateFromError(error: Error): { error: Error } {
		return { error };
	}

	componentDidCatch(error: Error, info: React.ErrorInfo): void {
		log.error('ContentManagerTabErrorBoundary', error.message, error, {
			componentStack: info.componentStack,
		});
	}

	render(): React.ReactNode {
		if (this.state.error) {
			return (
				<ContentManagerErrorRecoverySurface
					recoveryTitle={this.props.recoveryTitle}
					recoveryLabel={this.props.recoveryLabel}
					onAction={() => {
						this.setState({ error: null });
						this.props.onRecovery?.();
					}}
				/>
			);
		}
		return this.props.children;
	}
}
