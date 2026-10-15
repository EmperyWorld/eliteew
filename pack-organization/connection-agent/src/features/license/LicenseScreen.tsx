/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * License entry + HTTP redeem over private path — Russian user copy.
 *
 * Invariants:
 * - Does not fake success; network_unreachable stays visible.
 * - Wide layout: form + status/context split (not a skinny centered column).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
 */

import './license.css';

type LicenseScreenProps = {
	licenseKey: string;
	onLicenseKeyChange: (value: string) => void;
	statusMessage: string;
	busy: boolean;
	onBack: () => void;
	onContinue: () => void;
};

export function LicenseScreen({
	licenseKey,
	onLicenseKeyChange,
	statusMessage,
	busy,
	onBack,
	onContinue,
}: LicenseScreenProps) {
	return (
		<section className="panel license-panel" aria-labelledby="license-heading">
			<div className="license-main">
				<p className="panel-kicker">Шаг 3 из 3 · лицензия</p>
				<h2 id="license-heading">Активация лицензии</h2>
				<p className="lead">
					Введите ключ, который вы получили вместе с конфигом туннеля. Активация
					идёт по защищённому каналу — это не публичный магазин.
				</p>
				<label className="field">
					<span>Ключ лицензии</span>
					<input
						type="password"
						autoComplete="off"
						value={licenseKey}
						onChange={(e) => onLicenseKeyChange(e.target.value)}
						placeholder="EE-…"
						disabled={busy}
					/>
				</label>
				<div className="actions">
					<button
						type="button"
						className="secondary"
						onClick={onBack}
						disabled={busy}
					>
						Назад
					</button>
					<button
						type="button"
						className="primary"
						onClick={onContinue}
						disabled={busy || !licenseKey.trim()}
					>
						{busy ? 'Активация…' : 'Активировать'}
					</button>
				</div>
			</div>
			<aside className="license-aside" aria-label="Статус активации">
				<div className="license-status">
					<p className="panel-kicker">Статус</p>
					<p className="status status-banner" role="status">
						{statusMessage}
					</p>
				</div>
				<div className="license-help">
					<p className="panel-kicker">Что дальше</p>
					<p className="muted">
						После успешной активации откроется рабочий стол: облако при сети и
						офлайн-приложения по локальной лицензии.
					</p>
				</div>
			</aside>
		</section>
	);
}
