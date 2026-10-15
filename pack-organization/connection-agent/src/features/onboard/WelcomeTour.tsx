/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Journey Phase B — Welcome tour (exactly 2 slides) before Activation.
 *
 * Invariants:
 * - No ops jargon; site + license@eliteew.ru via opener callbacks.
 * - Completing tour marks onboarding (caller persists) then Activation.
 *
 * Related:
 * - DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §3 / §5.5
 */

import { useState } from 'react';
import {
	ELITEEW_SITE_URL,
	LICENSE_CONTACT_EMAIL,
} from '../../lib/launcher/journey';
import './welcome.css';

export type WelcomeTourProps = {
	onContinueToActivation: () => void;
	onOpenSite?: () => void;
	onOpenMailto?: () => void;
};

export function WelcomeTour({
	onContinueToActivation,
	onOpenSite,
	onOpenMailto,
}: WelcomeTourProps) {
	const [slide, setSlide] = useState<1 | 2>(1);

	return (
		<section
			className="welcome"
			aria-label="Знакомство с EliteEW"
			data-slide={slide}
		>
			<div className="welcome-mark" aria-hidden="true">
				<img src="/brand-mark.png" alt="" width={72} height={72} />
			</div>
			<p className="welcome-kicker">Знакомство</p>
			{slide === 1 ? (
				<>
					<h1 className="welcome-title">EliteEW</h1>
					<p className="welcome-lead">
						Рабочий стол Empery World на вашем устройстве — спокойный запуск
						облака и офлайн-приложений по лицензии администратора.
					</p>
					<div className="welcome-actions">
						<button
							type="button"
							className="primary"
							onClick={() => setSlide(2)}
						>
							Далее
						</button>
					</div>
				</>
			) : (
				<>
					<h1 className="welcome-title">Что нужно для старта</h1>
					<p className="welcome-lead">
						Администратор выдаёт один файл доступа. Импортируйте его на этом
						устройстве — без ручной настройки сети и без поиска пакетов в
						браузере.
					</p>
					<p className="welcome-contacts muted">
						Сайт:{' '}
						{onOpenSite ? (
							<button type="button" className="welcome-link" onClick={onOpenSite}>
								{ELITEEW_SITE_URL}
							</button>
						) : (
							<span>{ELITEEW_SITE_URL}</span>
						)}
						<br />
						Лицензии:{' '}
						{onOpenMailto ? (
							<button
								type="button"
								className="welcome-link"
								onClick={onOpenMailto}
							>
								{LICENSE_CONTACT_EMAIL}
							</button>
						) : (
							<span>{LICENSE_CONTACT_EMAIL}</span>
						)}
					</p>
					<div className="welcome-actions">
						<button
							type="button"
							className="secondary"
							onClick={() => setSlide(1)}
						>
							Назад
						</button>
						<button
							type="button"
							className="primary"
							onClick={onContinueToActivation}
						>
							Перейти к активации
						</button>
					</div>
				</>
			)}
			<p className="welcome-progress" aria-hidden="true">
				{slide} / 2
			</p>
		</section>
	);
}
