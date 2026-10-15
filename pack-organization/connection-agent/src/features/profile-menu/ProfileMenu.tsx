/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Device/license summary after bind — quieter tertiary profile card (not launch CTA).
 *
 * Invariants:
 * - boundLabel comes from redeem/entitlement — not a hard-coded stub.
 * - Retail sealed: no service base URLs in primary Ещё chrome (ops-only fold).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
 * - documentation/product/desktop/DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §5
 * - features/shell/ShellStep.tsx shell-tertiary
 */

import './profile-menu.css';
import { isRetailSealedUi } from '../../lib/launcher/retailSealed';

type ProfileMenuProps = {
	enrollBase: string;
	appBase: string;
	boundLabel: string;
	onBackToLicense?: () => void;
	onOpenTunnel?: () => void;
	/** Ops/debug only: clear hardware bind + need new capsule. */
	onClearDeviceBind?: () => void;
	clearDeviceBindBusy?: boolean;
};

export function ProfileMenu({
	enrollBase,
	appBase,
	boundLabel,
	onBackToLicense,
	onOpenTunnel,
	onClearDeviceBind,
	clearDeviceBindBusy = false,
}: ProfileMenuProps) {
	const sealed = isRetailSealedUi();
	return (
		<section className="panel profile-panel" aria-labelledby="profile-heading">
			<p className="panel-kicker">Устройство</p>
			<h2 id="profile-heading">Профиль</h2>
			<ul className="meta-list profile-meta">
				<li>
					<strong>Лицензия</strong>
					<span>{boundLabel}</span>
				</li>
			</ul>
			{!sealed ? (
				<details className="details-fold">
					<summary>Адреса сервисов</summary>
					<ul className="meta-list profile-meta">
						<li>
							<strong>Активация</strong>
							<span>{enrollBase}</span>
						</li>
						<li>
							<strong>Облачный стол</strong>
							<span>{appBase}</span>
						</li>
					</ul>
				</details>
			) : null}
			{!sealed ? (
				<div className="actions profile-actions">
					{onOpenTunnel ? (
						<button type="button" className="secondary" onClick={onOpenTunnel}>
							Настроить туннель
						</button>
					) : null}
					{onBackToLicense ? (
						<button type="button" className="linkish" onClick={onBackToLicense}>
							Сменить ключ или начать заново
						</button>
					) : null}
					{onClearDeviceBind ? (
						<button
							type="button"
							className="linkish"
							disabled={clearDeviceBindBusy}
							onClick={onClearDeviceBind}
						>
							Снять привязку к устройству
						</button>
					) : null}
				</div>
			) : null}
		</section>
	);
}
