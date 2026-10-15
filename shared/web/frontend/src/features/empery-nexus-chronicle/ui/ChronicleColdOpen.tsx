/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Cold-open overlay — brand, ritual line, single Skip primary CTA.
 *
 * Invariants:
 * - One filled primary button (Skip); no stats dump during ritual.
 *
 * Related:
 * - motion/useCinematicColdOpen.ts
 */

import { EMPERY_NEXUS_CHRONICLE_NS } from '@/i18n/namespaces';
import { useTranslation } from 'react-i18next';

type ChronicleColdOpenProps = {
	lineKey: string;
	onSkip: () => void;
	audioNeedsGesture?: boolean;
	onAwakenAudio?: () => void;
};

export function ChronicleColdOpen({
	lineKey,
	onSkip,
	audioNeedsGesture = false,
	onAwakenAudio,
}: ChronicleColdOpenProps) {
	const { t } = useTranslation(EMPERY_NEXUS_CHRONICLE_NS);

	return (
		<div
			className="empery-nexus-chronicle__cold-open"
			data-testid="empery-nexus-cold-open"
		>
			<div className="empery-nexus-chronicle__cold-open-inner">
				<p className="empery-nexus-chronicle__brand">{t('brand')}</p>
				<p className="empery-nexus-chronicle__subtitle-archaic">
					{t('subtitleArchaic')}
				</p>
				<p
					className="empery-nexus-chronicle__cold-open-line"
					aria-live="polite"
				>
					{t(lineKey)}
				</p>
				<div className="empery-nexus-chronicle__controls">
					{audioNeedsGesture && onAwakenAudio ? (
						<button
							type="button"
							className="empery-nexus-chronicle__btn"
							onClick={onAwakenAudio}
						>
							{t('actions.awakenAudio')}
						</button>
					) : null}
					<button
						type="button"
						className="empery-nexus-chronicle__btn empery-nexus-chronicle__btn--primary"
						onClick={onSkip}
					>
						{t('coldOpen.skip')}
					</button>
				</div>
			</div>
		</div>
	);
}
