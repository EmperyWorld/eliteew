/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * O3e offline EliteEW AI panel — platform LLM when network reachable.
 *
 * Invariants:
 * - Honest offline banner; no chat CTA when unreachable.
 * - Endpoint from release conf only (not public bake by default; Wave 5 F-07).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
 */

import { useEffect, useState } from 'react';
import {
	aiEliteewChat,
	aiEliteewStatus,
	type AiChatMessage,
	type AiEliteewStatusView,
} from '../../lib/tauri-bridge/commands';
import { canSendEliteewAi, eliteewAiBanner } from './eliteewAiPanelState';

type Turn = { role: 'user' | 'assistant'; content: string };

export function OfflineEliteewAiPanel() {
	const [status, setStatus] = useState<AiEliteewStatusView | null>(null);
	const [model, setModel] = useState('');
	const [prompt, setPrompt] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [turns, setTurns] = useState<Turn[]>([]);

	async function refresh() {
		try {
			const s = await aiEliteewStatus();
			setStatus(s);
			if (s.model) {
				setModel(s.model);
			}
		} catch (e) {
			setStatus({
				ok: false,
				code: 'bridge_error',
				message: e instanceof Error ? e.message : String(e),
				network_ok: false,
			});
		}
	}

	useEffect(() => {
		void refresh();
	}, []);

	const baseConfigured = Boolean(status?.base_url);
	const networkOk = Boolean(status?.network_ok);
	const banner = eliteewAiBanner(
		status?.code ?? null,
		status?.message ?? '…',
		networkOk
	);
	const sendOk = canSendEliteewAi({
		baseConfigured,
		networkOk,
		busy,
		prompt,
		model,
	});

	async function onSend() {
		if (!sendOk) {
			return;
		}
		const userText = prompt.trim();
		setPrompt('');
		setError(null);
		setBusy(true);
		const nextTurns: Turn[] = [...turns, { role: 'user', content: userText }];
		setTurns(nextTurns);
		const messages: AiChatMessage[] = nextTurns.map((t) => ({
			role: t.role,
			content: t.content,
		}));
		try {
			const res = await aiEliteewChat(messages, model.trim());
			if (!res.ok || !res.reply) {
				setError(res.message || res.code);
				return;
			}
			setTurns([...nextTurns, { role: 'assistant', content: res.reply }]);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	}

	return (
		<section
			className="panel ai-eliteew-panel"
			aria-labelledby="ai-eliteew-heading"
		>
			<h2 id="ai-eliteew-heading">EliteEW AI</h2>
			<p className="muted">
				Платформенная модель EliteEW (ai.eliteew). Нужна сеть / туннель до
				endpoint.
			</p>
			<p
				className={`status${status && !status.ok ? ' status-warn' : ''}`}
				role="status"
			>
				{banner}
				{status?.base_url ? ` · ${status.base_url}` : ''}
			</p>
			<div className="actions">
				<button type="button" disabled={busy} onClick={() => void refresh()}>
					Проверить сеть
				</button>
			</div>

			{!baseConfigured ? (
				<p className="muted">
					Задайте ai_eliteew_base_url в релизе (on-prem / connected pack).
				</p>
			) : !networkOk ? (
				<p className="muted">
					Endpoint недоступен. Поднимите WG/SG или проверьте URL — чат скрыт, пока
					нет сети.
				</p>
			) : (
				<>
					<label className="field">
						<span>Модель</span>
						<input
							value={model}
							onChange={(e) => setModel(e.target.value)}
							placeholder="модель платформы"
							disabled={busy}
							autoComplete="off"
						/>
					</label>

					{turns.length === 0 ? (
						<p className="muted">Спросите платформенную модель EliteEW.</p>
					) : (
						<ul className="ai-turns" aria-live="polite">
							{turns.map((t, i) => (
								<li
									key={`${t.role}-${i}`}
									className={`ai-turn ai-turn-${t.role}`}
								>
									<strong>{t.role === 'user' ? 'Вы' : 'Модель'}</strong>
									<p>{t.content}</p>
								</li>
							))}
						</ul>
					)}

					{error ? (
						<p className="status status-warn" role="alert">
							{error}
						</p>
					) : null}
					{busy ? (
						<p className="status" role="status">
							Ждём ответ EliteEW AI…
						</p>
					) : null}

					<label className="field">
						<span>Сообщение</span>
						<textarea
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							rows={3}
							disabled={busy}
							placeholder="Спросите EliteEW…"
						/>
					</label>
					<div className="actions">
						<button type="button" disabled={!sendOk} onClick={() => void onSend()}>
							Отправить
						</button>
					</div>
				</>
			)}
		</section>
	);
}
