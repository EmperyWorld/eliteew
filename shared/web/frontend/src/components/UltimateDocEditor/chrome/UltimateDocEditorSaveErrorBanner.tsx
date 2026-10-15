import type { FC } from 'react';

import { DesktopAppButton } from '../../../pages/Desktop/components/DesktopAppChrome';

export interface UltimateDocEditorSaveErrorBannerProps {
	open: boolean;
	loadError: string;
	retryLabel: string;
	titleLabel: string;
	zIndex: number;
	onRetrySave: () => void;
}

export const UltimateDocEditorSaveErrorBanner: FC<
	UltimateDocEditorSaveErrorBannerProps
> = ({ open, loadError, retryLabel, titleLabel, zIndex, onRetrySave }) => {
	if (!open) {
		return null;
	}

	return (
		<div
			className="sticky top-0 flex items-center justify-between gap-3 border-b border-red-500/40 bg-red-950/80 px-4 py-2 text-red-100"
			style={{
				zIndex,
			}}
			role="alert"
		>
			<span className="text-sm font-medium">{titleLabel}</span>
			<div className="flex items-center gap-2">
				<span
					className="text-xs text-red-200/90 truncate max-w-[200px]"
					title={loadError}
				>
					{loadError}
				</span>
				<DesktopAppButton
					type="button"
					onClick={onRetrySave}
					variant="danger"
					size="sm"
					className="shrink-0"
				>
					{retryLabel}
				</DesktopAppButton>
			</div>
		</div>
	);
};
