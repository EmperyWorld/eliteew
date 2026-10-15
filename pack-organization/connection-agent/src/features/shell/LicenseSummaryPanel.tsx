/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * User-facing license summary: mode, capabilities, identifiers — not operator dump.
 *
 * Invariants:
 * - Shows only facts from verified entitlement / session bind.
 * - No raw machine codes in primary copy.
 * - Any `!entitlement.ok` is a denied hero (fail-closed; includes heartbeat kill codes).
 * - Null entitlement must not render an “active access” hero (callers must gate mount).
 *
 * Related:
 * - ShellStep · DESKTOP-FOFLINE-EDITION.md §4
 * - NCR-001 Full Security honesty audit
 */

import { resolveSeatModeLabelRu } from '../../lib/launcher/licenseModes';
import type { EntitlementStatusView } from '../../lib/tauri-bridge/commands';

type LicenseSummaryPanelProps = {
	entitlement: EntitlementStatusView | null;
	onlineBoundLabel: string | null;
	boundLabel: string;
	channelLabel: string;
	channelTone: 'ok' | 'warn' | 'danger' | 'neutral';
	deviceBound?: boolean | null;
};

function formatExp(exp: number | null | undefined): string | null {
	if (typeof exp !== 'number' || !Number.isFinite(exp) || exp <= 0) return null;
	try {
		return new Intl.DateTimeFormat('ru-RU', {
			dateStyle: 'medium',
			timeStyle: 'short',
		}).format(new Date(exp * 1000));
	} catch {
		return null;
	}
}

function deniedHeroTitle(code: string | null | undefined): string {
	const c = (code ?? '').trim();
	if (
		c === 'license_revoked' ||
		c === 'revoked' ||
		c === 'device_revoked' ||
		c === 'device_conflict' ||
		c === 'device_required' ||
		c === 'fingerprint_required' ||
		c === 'license_denied' ||
		c === 'not_found'
	) {
		return 'Доступ отозван';
	}
	if (c === 'expired' || c === 'license_expired') {
		return 'Срок лицензии истёк';
	}
	if (c === 'clock_rollback') {
		return 'Время на устройстве не совпадает';
	}
	return 'Доступ недоступен';
}

export function LicenseSummaryPanel({
	entitlement,
	onlineBoundLabel,
	boundLabel,
	channelLabel,
	channelTone,
	deviceBound = null,
}: LicenseSummaryPanelProps) {
	// No entitlement fact → no panel body (ShellStep/LicensePanel must not mount).
	if (entitlement == null) {
		return null;
	}
	// Fail-closed: any non-ok entitlement (including heartbeat kill codes) is denied UI.
	const denied = !entitlement.ok;
	const modeLabel = resolveSeatModeLabelRu({
		edition: entitlement.edition,
		profileId: entitlement.profile_id,
	});
	const fofline = denied
		? 'Недоступна'
		: entitlement.allow_fofline === true
			? 'Включена'
			: entitlement.allow_fofline === false
				? 'Не входит в лицензию'
				: 'Не указано в пакете';
	const apps = (entitlement.apps ?? []).filter(Boolean);
	const expLabel = formatExp(entitlement.exp ?? null);
	const licenseShort = entitlement.license_id
		? `${entitlement.license_id.slice(0, 8)}…`
		: null;

	if (denied) {
		const title = deniedHeroTitle(entitlement.code);
		return (
			<section
				className="panel license-summary license-summary-denied"
				aria-labelledby="license-summary-heading"
			>
				<p className="panel-kicker">Ваша лицензия</p>
				<h2 id="license-summary-heading">{title}</h2>
				<p className="muted license-summary-lead">
					Запуск EliteEW на этом устройстве недоступен. Обратитесь к
					администратору контракта за продлением или новым пакетом доступа.
				</p>
				{expLabel ? (
					<p className="muted">
						Действовала до: <strong>{expLabel}</strong>
					</p>
				) : null}
			</section>
		);
	}

	return (
		<section
			className="panel license-summary"
			aria-labelledby="license-summary-heading"
		>
			<p className="panel-kicker">Ваша лицензия</p>
			<h2 id="license-summary-heading">Доступ и возможности</h2>
			<p className="muted license-summary-lead">
				Кратко о том, что доступно на этом устройстве после проверки пакета.
			</p>
			<dl className="license-summary-grid">
				<div>
					<dt>Режим</dt>
					<dd>{modeLabel}</dd>
				</div>
				<div>
					<dt>Канал</dt>
					<dd data-tone={channelTone}>{channelLabel}</dd>
				</div>
				<div>
					<dt>Устройство</dt>
					<dd>
						{deviceBound === true
							? 'Лицензия привязана к этому устройству'
							: deviceBound === false
								? 'Привязка ещё не выполнена'
								: 'Проверка привязки…'}
					</dd>
				</div>
				<div>
					<dt>FoFline</dt>
					<dd>{fofline}</dd>
				</div>
				<div>
					<dt>Офлайн-приложения</dt>
					<dd>
						{apps.length > 0
							? `${apps.length} в каталоге`
							: 'В пакете пока нет списка приложений'}
					</dd>
				</div>
				{expLabel ? (
					<div>
						<dt>Действует до</dt>
						<dd>{expLabel}</dd>
					</div>
				) : null}
				{licenseShort ? (
					<div>
						<dt>Идентификатор</dt>
						<dd title={entitlement.license_id ?? undefined}>{licenseShort}</dd>
					</div>
				) : null}
				{onlineBoundLabel || boundLabel ? (
					<div className="license-summary-span">
						<dt>Сессия</dt>
						<dd>{onlineBoundLabel || boundLabel}</dd>
					</div>
				) : null}
			</dl>
		</section>
	);
}
