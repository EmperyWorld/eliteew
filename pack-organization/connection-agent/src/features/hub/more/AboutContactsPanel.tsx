/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Journey W6 — Ещё → About + site/mailto contacts + Linux graphics recovery.
 *
 * Invariants:
 * - Opener CTAs use license@eliteew.ru / eliteew.ru (not personal support mail).
 * - Graphics recovery is not part of license wipe.
 * - No Appeals inbox tab (deferred).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §5.5–§5.6
 */

import { useId } from 'react';
import { APP_VERSION } from '../../../lib/launcher/appVersion';
import {
	ELITEEW_SITE_URL,
	ELITEEW_SOURCE_CODE_URL,
	LICENSE_CONTACT_EMAIL,
} from '../../../lib/launcher/journey';

export type AboutContactsPanelProps = {
	onOpenSite?: () => void;
	onOpenSourceCode?: () => void;
	onOpenMailto?: () => void;
	graphicsRecoveryAvailable?: boolean;
	graphicsRecoveryBusy?: boolean;
	onGraphicsRecovery?: () => void;
};

export function AboutContactsPanel({
	onOpenSite,
	onOpenSourceCode,
	onOpenMailto,
	graphicsRecoveryAvailable = false,
	graphicsRecoveryBusy = false,
	onGraphicsRecovery,
}: AboutContactsPanelProps) {
	const titleId = useId();

	return (
		<section
			className="about-contacts-panel more-section"
			aria-labelledby={titleId}
			data-journey="about-contacts-panel"
		>
			<p className="panel-kicker">Ещё · О приложении</p>
			<h2 id={titleId} className="more-section-title">
				EliteEW Desktop
			</h2>
			<p className="muted about-contacts-lead">
				Версия клиента, исходный код и контакты поддержки. После входа в продукт
				обращения можно отправлять и из приложения.
			</p>

			<dl className="about-meta">
				<div>
					<dt>Версия</dt>
					<dd>{APP_VERSION}</dd>
				</div>
				<div>
					<dt>Сайт</dt>
					<dd>{ELITEEW_SITE_URL.replace(/^https:\/\//, '')}</dd>
				</div>
				<div>
					<dt>Исходный код</dt>
					<dd>
						{ELITEEW_SOURCE_CODE_URL.replace(/^https:\/\/github\.com\//, '')}
					</dd>
				</div>
				<div>
					<dt>Почта</dt>
					<dd>{LICENSE_CONTACT_EMAIL}</dd>
				</div>
			</dl>

			<div className="about-contacts-actions">
				{onOpenSite ? (
					<button type="button" className="primary" onClick={onOpenSite}>
						Открыть сайт
					</button>
				) : null}
				{onOpenSourceCode ? (
					<button
						type="button"
						className="secondary"
						onClick={onOpenSourceCode}
					>
						Исходный код
					</button>
				) : null}
				{onOpenMailto ? (
					<button type="button" className="secondary" onClick={onOpenMailto}>
						Написать
					</button>
				) : null}
			</div>

			{graphicsRecoveryAvailable && onGraphicsRecovery ? (
				<div className="about-graphics">
					<p className="muted">
						Если интерфейс тормозит на Linux, можно вернуть программный режим
						отрисовки.
					</p>
					<button
						type="button"
						className="secondary"
						disabled={graphicsRecoveryBusy}
						onClick={onGraphicsRecovery}
					>
						{graphicsRecoveryBusy ? 'Восстановление…' : 'Вернуть плавность'}
					</button>
				</div>
			) : null}
		</section>
	);
}
