/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Journey Phase B — Activation: Air one-code (primary) + USB Capsule drop.
 *
 * Invariants:
 * - Drop zone only after Identifying / Welcome; never during Identifying.
 * - Single activation chrome — HomeScreen is drop body only (no second welcome/modes).
 * - Air path: only access code crosses IPC; Capsule stays Rust-only.
 *
 * Related:
 * - DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §3 / plan §4.3 B2
 * - DESKTOP-CLIENT-AIR-ENROLL.md §6
 */

import { HomeScreen } from "../home/HomeScreen";
import { AirEnrollPanel } from "./AirEnrollPanel";
import "./activation.css";

export type ActivationScreenProps = {
	entitlementMessage: string;
	importPath: string;
	onImportPathChange: (value: string) => void;
	importBusy: boolean;
	onImport: () => void;
	onImportJsonText: (raw: string) => void;
	onImportSeatJsonText: (raw: string) => void;
	onPickAccessFile?: () => void;
	onOnlineEnroll?: () => void;
	onPrepareDeviceRequest?: () => void;
	deviceRequestHint?: string | null;
	airEnrollBusy?: boolean;
	onAirEnroll?: (accessCode: string) => Promise<void>;
	airEnrollStatus?: string | null;
};

export function ActivationScreen(props: ActivationScreenProps) {
	const {
		airEnrollBusy = false,
		onAirEnroll,
		airEnrollStatus,
		...homeProps
	} = props;

	return (
		<section className="activation" aria-label="Активация EliteEW">
			<header className="activation-hero">
				<p className="activation-kicker">Активация</p>
				<h1 className="activation-title">Доступ к EliteEW</h1>
				<p className="activation-lead">
					Введите код от администратора или импортируйте файл доступа. Если сеть
					ещё не настроена — откройте «Сеть» и задайте кабель или Wi‑Fi прямо
					здесь, без системных окон.
				</p>
			</header>
			{onAirEnroll ? (
				<AirEnrollPanel
					busy={airEnrollBusy || homeProps.importBusy}
					onSubmit={onAirEnroll}
					statusMessage={airEnrollStatus}
				/>
			) : null}
			<HomeScreen {...homeProps} />
		</section>
	);
}
