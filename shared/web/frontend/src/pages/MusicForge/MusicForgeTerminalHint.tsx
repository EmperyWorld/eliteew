/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Post-terminal encouragement strip in create column (failed / cancelled runs).
 *
 * Related:
 * - MusicForgeCreatePanel.tsx, MusicForgeApp.tsx
 */

import {
	ArrowPathIcon,
	ExclamationTriangleIcon,
	XCircleIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

export type MusicForgeTerminalHintProps = {
	status: 'failed' | 'cancelled';
	canRetry?: boolean;
	onRetry?: () => void;
	onStartNewSong: () => void;
};

export function MusicForgeTerminalHint({
	status,
	canRetry = false,
	onRetry,
	onStartNewSong,
}: MusicForgeTerminalHintProps) {
	const { t } = useTranslation('desktopUi');
	const isFailed = status === 'failed';
	const Icon = isFailed ? ExclamationTriangleIcon : XCircleIcon;
	const titleKey = isFailed
		? 'musicForge.terminalHint.failedTitle'
		: 'musicForge.terminalHint.cancelledTitle';
	const subtitleKey = isFailed
		? 'musicForge.terminalHint.failedSubtitle'
		: 'musicForge.terminalHint.cancelledSubtitle';
	const tone = isFailed
		? 'border-rose-400/30 bg-rose-500/10 text-rose-50'
		: 'border-amber-400/30 bg-amber-500/10 text-amber-50';
	const iconTone = isFailed ? 'text-rose-100' : 'text-amber-100';

	return (
		<div
			className={`rounded-2xl border px-4 py-3 ${tone}`}
			role="status"
			data-testid="music-forge-terminal-hint"
		>
			<div className="flex items-start gap-3">
				<div
					className={`grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/20 ${iconTone}`}
				>
					<Icon className="size-5" />
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-sm font-semibold text-white">{t(titleKey)}</p>
					<p className="mt-1 text-sm leading-relaxed text-(--desktop-text-secondary)">
						{t(subtitleKey)}
					</p>
					<div className="mt-3 flex flex-wrap gap-2">
						{canRetry && onRetry ? (
							<DesktopAppButton
								type="button"
								variant="accent"
								onClick={onRetry}
							>
								<ArrowPathIcon className="size-4" />
								{t('musicForge.actions.retryGeneration')}
							</DesktopAppButton>
						) : null}
						<DesktopAppButton
							type="button"
							variant="ghost"
							onClick={onStartNewSong}
						>
							{t('musicForge.actions.newSong')}
						</DesktopAppButton>
					</div>
				</div>
			</div>
		</div>
	);
}
