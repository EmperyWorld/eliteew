/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Journey W5c — Ещё → Лицензия: summary + sealed local factory-reset CTA.
 *
 * Invariants:
 * - Retail CTA always visible (not ops-only).
 * - Confirm is in-app (no plugin-dialog); no uninstall checkbox.
 * - Wipe calls runLicenseLocalFactoryReset only (local; never server revoke).
 * - failed entitlement|bind|peer → honest error + retry, no fake success.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §5.3
 */

import { useEffect, useId, useRef, useState } from 'react';
import { LicenseSummaryPanel } from '../../shell/LicenseSummaryPanel';
import {
	resetAllowsSuccessUi,
	runLicenseLocalFactoryReset,
} from '../../../lib/launcher/journey';
import type { EntitlementStatusView } from '../../../lib/tauri-bridge/commands';

export type LicensePanelProps = {
	entitlement: EntitlementStatusView | null;
	onlineBoundLabel: string | null;
	boundLabel: string;
	channelLabel: string;
	channelTone: 'ok' | 'warn' | 'danger' | 'neutral';
	deviceBound?: boolean | null;
};

type WipePhase = 'idle' | 'confirm' | 'busy' | 'error';

export function LicensePanel({
	entitlement,
	onlineBoundLabel,
	boundLabel,
	channelLabel,
	channelTone,
	deviceBound = null,
}: LicensePanelProps) {
	const titleId = useId();
	const cancelRef = useRef<HTMLButtonElement>(null);
	const [phase, setPhase] = useState<WipePhase>('idle');
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const foflineOn = entitlement?.allow_fofline === true;

	const openConfirm = () => {
		setErrorMessage(null);
		setPhase('confirm');
	};

	const closeConfirm = () => {
		if (phase === 'busy') return;
		setPhase(errorMessage ? 'error' : 'idle');
	};

	useEffect(() => {
		if (phase !== 'confirm' && phase !== 'busy') return;
		cancelRef.current?.focus();
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && phase !== 'busy') {
				event.preventDefault();
				setPhase(errorMessage ? 'error' : 'idle');
			}
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [phase, errorMessage]);

	const runWipe = async () => {
		setPhase('busy');
		setErrorMessage(null);
		try {
			const result = await runLicenseLocalFactoryReset();
			if (!resetAllowsSuccessUi(result)) {
				const failed = result.failed.join(', ') || 'неизвестно';
				setErrorMessage(
					`Не удалось сбросить доступ на этом устройстве (${failed}). Попробуйте ещё раз.`
				);
				setPhase('error');
				return;
			}
			/* app_restart usually does not return */
			setPhase('busy');
		} catch (err) {
			setErrorMessage(
				err instanceof Error
					? err.message
					: 'Не удалось сбросить доступ на этом устройстве'
			);
			setPhase('error');
		}
	};

	return (
		<section
			className="license-panel"
			aria-labelledby={titleId}
			data-journey="license-panel"
			aria-busy={phase === 'busy'}
		>
			<p className="panel-kicker">Ещё · Лицензия</p>
			<h2 id={titleId}>Доступ на этом устройстве</h2>
			<p className="muted license-panel-lead">
				Здесь видно, что подтверждено для этого компьютера. Сброс удаляет
				локальные данные доступа — лицензия у администратора не отменяется.
			</p>

			{entitlement != null ? (
				<LicenseSummaryPanel
					entitlement={entitlement}
					onlineBoundLabel={onlineBoundLabel}
					boundLabel={boundLabel}
					channelLabel={channelLabel}
					channelTone={channelTone}
					deviceBound={deviceBound}
				/>
			) : (
				<p className="muted" role="status">
					Пакет доступа на этом устройстве пока не подтверждён.
				</p>
			)}

			<div className="license-panel-actions">
				<button
					type="button"
					className="danger-outline"
					data-cta="local-factory-reset"
					disabled={phase === 'busy'}
					onClick={openConfirm}
				>
					Сбросить доступ на этом устройстве
				</button>
				<p className="muted license-panel-hint">
					После сброса приложение перезапустится. Тот же файл доступа можно
					импортировать снова.
				</p>
			</div>

			{phase === 'error' && errorMessage ? (
				<div className="license-wipe-error" role="alert">
					<p>{errorMessage}</p>
					<button type="button" className="secondary" onClick={openConfirm}>
						Повторить
					</button>
				</div>
			) : null}

			{phase === 'confirm' || phase === 'busy' ? (
				// Modal backdrop: click dismisses when not busy; Escape handled on document.
				// biome-ignore lint/a11y/noStaticElementInteractions: overlay dismiss
				<div
					className="license-wipe-backdrop"
					role="presentation"
					onClick={() => {
						if (phase !== 'busy') closeConfirm();
					}}
				>
					<div
						className="license-wipe-dialog"
						role="dialog"
						aria-modal="true"
						aria-labelledby={`${titleId}-confirm`}
						aria-busy={phase === 'busy'}
					>
						<h3 id={`${titleId}-confirm`}>
							Сбросить доступ на этом устройстве?
						</h3>
						<p>
							Будут удалены локальные данные доступа на <strong>этом</strong>{' '}
							компьютере:
						</p>
						<ul>
							<li>подтверждённый пакет доступа и привязка к устройству;</li>
							<li>защищённый канал и связанные настройки на устройстве;</li>
							{foflineOn ? (
								<li>
									локальные данные FoFline (пакет приложений и связанные файлы);
								</li>
							) : null}
							<li>сессия продукта в окне приложения;</li>
							<li>
								локальные заметки буфера, уведомления и настройки стороннего AI
								(если были).
							</li>
						</ul>
						<p>
							Лицензия у администратора <strong>не отменяется</strong>. Тот же
							файл доступа можно импортировать снова.
						</p>
						<p className="muted">
							Установка приложения и папка Import не удаляются.
						</p>
						<div className="license-wipe-dialog-actions">
							<button
								ref={cancelRef}
								type="button"
								className="secondary"
								disabled={phase === 'busy'}
								onClick={closeConfirm}
							>
								Отмена
							</button>
							<button
								type="button"
								className="danger"
								disabled={phase === 'busy'}
								data-cta="local-factory-reset-confirm"
								onClick={() => void runWipe()}
							>
								{phase === 'busy' ? 'Сброс…' : 'Сбросить и перезапустить'}
							</button>
						</div>
					</div>
				</div>
			) : null}
		</section>
	);
}
