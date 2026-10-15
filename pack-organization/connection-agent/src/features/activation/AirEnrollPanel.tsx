/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Activation Path B — enter one Air enrollment code; Rust does key exchange.
 *
 * Invariants:
 * - Only the access code crosses IPC; no Capsule/token/URL from JS.
 * - Honest busy/error states; no fake success.
 *
 * Related:
 * - DESKTOP-CLIENT-AIR-ENROLL.md §6
 * - features/activation/ActivationScreen.tsx
 */

import type { FormEvent } from "react";
import { useState } from "react";
import "./airEnroll.css";

export type AirEnrollPanelProps = {
	busy: boolean;
	onSubmit: (accessCode: string) => Promise<void>;
	statusMessage?: string | null;
};

export function AirEnrollPanel({
	busy,
	onSubmit,
	statusMessage,
}: AirEnrollPanelProps) {
	const [code, setCode] = useState("");

	async function handleSubmit(event: FormEvent) {
		event.preventDefault();
		const trimmed = code.trim();
		if (!trimmed || busy) {
			return;
		}
		await onSubmit(trimmed);
	}

	return (
		<section className="air-enroll" aria-label="Активация по коду">
			<form className="air-enroll-form" onSubmit={(e) => void handleSubmit(e)}>
				<label className="air-enroll-label" htmlFor="air-enroll-code">
					Код доступа
				</label>
				<input
					id="air-enroll-code"
					name="accessCode"
					className="air-enroll-input"
					type="text"
					inputMode="text"
					autoComplete="off"
					autoCorrect="off"
					spellCheck={false}
					placeholder="EWAE1-62200-…"
					value={code}
					disabled={busy}
					onChange={(e) => setCode(e.target.value.toUpperCase())}
					aria-describedby="air-enroll-hint"
				/>
				<p id="air-enroll-hint" className="air-enroll-hint">
					Введите код, который показал администратор. Устройство само свяжется с
					сервисом и получит доступ — без файла на диске.
				</p>
				<div className="air-enroll-actions">
					<button
						type="submit"
						className="primary"
						disabled={busy || !code.trim()}
					>
						{busy ? "Подключение…" : "Активировать по коду"}
					</button>
				</div>
			</form>
			{statusMessage ? (
				<p className="air-enroll-status" role="status">
					{statusMessage}
				</p>
			) : null}
		</section>
	);
}
