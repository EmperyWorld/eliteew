/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Keyboard legend overlay for Empery Nexus Chronicle (? to toggle).
 *
 * Invariants:
 * - Copy from emperyNexusChronicle i18n only.
 *
 * Related:
 * - EmperyNexusChroniclePage.tsx
 */

import { EMPERY_NEXUS_CHRONICLE_NS } from '@/i18n/namespaces';
import { useTranslation } from 'react-i18next';

type ChronicleHelpOverlayProps = {
	open: boolean;
	onClose: () => void;
};

export function ChronicleHelpOverlay({
	open,
	onClose,
}: ChronicleHelpOverlayProps) {
	const { t } = useTranslation(EMPERY_NEXUS_CHRONICLE_NS);
	if (!open) return null;

	const rows = [
		['help.keys.layers', 'help.desc.layers'],
		['help.keys.domains', 'help.desc.domains'],
		['help.keys.chapters', 'help.desc.chapters'],
		['help.keys.cinema', 'help.desc.cinema'],
		['help.keys.mute', 'help.desc.mute'],
		['help.keys.help', 'help.desc.help'],
		['help.keys.escape', 'help.desc.escape'],
	] as const;

	return (
		<div
			className="empery-nexus-chronicle__help"
			data-testid="empery-nexus-help"
			role="dialog"
			aria-modal="true"
			aria-label={t('help.title')}
		>
			<div className="empery-nexus-chronicle__help-panel">
				<p className="empery-nexus-chronicle__layer-title">{t('help.title')}</p>
				<ul className="empery-nexus-chronicle__help-list">
					{rows.map(([keyKeys, keyDesc]) => (
						<li key={keyKeys}>
							<kbd>{t(keyKeys)}</kbd>
							<span>{t(keyDesc)}</span>
						</li>
					))}
				</ul>
				<button
					type="button"
					className="empery-nexus-chronicle__btn empery-nexus-chronicle__btn--primary"
					onClick={onClose}
				>
					{t('help.close')}
				</button>
			</div>
		</div>
	);
}
