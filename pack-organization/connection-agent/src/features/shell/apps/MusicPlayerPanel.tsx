/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * O5 MusicPlayer — native audio via opaque file grant + rodio/cpal (Wave 7); no HTML5 audio; K3 spa_deep_link CTA.
 *
 * Invariants:
 * - Codec / missing-file failures are honest — never fall back to WebView HTML5 audio.
 * - Cloud library / playlists stay unavailable offline.
 * - Play/pause toggle is single-flight (`transportInFlightRef`) so a second click cannot pause a just-started resume.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md §Client edition
 * - documentation/product/desktop/DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md
 */

import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useEffect, useRef, useState } from 'react';
import {
	NATIVE_AUDIO_ENDED_EVENT,
	NATIVE_AUDIO_PROGRESS_EVENT,
	type NativeAudioProgress,
	type NativeAudioView,
	fileGrantPick,
	nativeAudioPause,
	nativeAudioPlayFromGrant,
	nativeAudioResume,
	nativeAudioSeek,
	nativeAudioSetVolume,
	nativeAudioStop,
} from '../../../lib/tauri-bridge/commands';
import { OfflineSpaDeepLinkCta } from './OfflineSpaDeepLinkCta';

type Props = { appBase: string; onBack: () => void };

function formatClock(secs: number): string {
	if (!Number.isFinite(secs) || secs < 0) {
		return '0:00';
	}
	const total = Math.floor(secs);
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${s.toString().padStart(2, '0')}`;
}

function applyView(
	view: NativeAudioView,
	setError: (v: string | null) => void,
	setFileName: (v: string | null) => void,
	setPlaying: (v: boolean) => void,
	setPosition: (v: number) => void,
	setDuration: (v: number | null) => void
) {
	if (!view.ok) {
		setError(view.message);
		setPlaying(false);
		return;
	}
	setError(null);
	if (view.file_name != null) {
		setFileName(view.file_name);
	}
	if (typeof view.playing === 'boolean') {
		setPlaying(view.playing);
	}
	if (typeof view.position_secs === 'number') {
		setPosition(view.position_secs);
	}
	if (view.duration_secs != null) {
		setDuration(view.duration_secs);
	}
}

export function MusicPlayerPanel({ appBase, onBack }: Props) {
	const [fileName, setFileName] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [playing, setPlaying] = useState(false);
	const [position, setPosition] = useState(0);
	const [duration, setDuration] = useState<number | null>(null);
	const [volume, setVolume] = useState(1);
	const hasTrackRef = useRef(false);
	/** Sync guard — `busy` state alone can miss a second click before re-render. */
	const transportInFlightRef = useRef(false);
	const playingRef = useRef(false);

	useEffect(() => {
		playingRef.current = playing;
	}, [playing]);

	useEffect(() => {
		let cancelled = false;
		const unlisteners: UnlistenFn[] = [];

		void (async () => {
			try {
				const onProgress = await listen<NativeAudioProgress>(
					NATIVE_AUDIO_PROGRESS_EVENT,
					(event) => {
						if (cancelled) {
							return;
						}
						const p = event.payload;
						setPosition(p.position_secs);
						if (p.duration_secs != null) {
							setDuration(p.duration_secs);
						}
						setPlaying(p.playing);
						if (p.file_name) {
							setFileName(p.file_name);
						}
					}
				);
				if (cancelled) {
					onProgress();
					return;
				}
				const onEnded = await listen<NativeAudioProgress>(
					NATIVE_AUDIO_ENDED_EVENT,
					(event) => {
						if (cancelled) {
							return;
						}
						const p = event.payload;
						setPlaying(false);
						setPosition(p.position_secs);
						if (p.duration_secs != null) {
							setDuration(p.duration_secs);
						}
					}
				);
				if (cancelled) {
					onProgress();
					onEnded();
					return;
				}
				unlisteners.push(onProgress, onEnded);
			} catch (e) {
				if (!cancelled) {
					setError(
						e instanceof Error
							? e.message
							: 'Не удалось подписаться на события плеера'
					);
				}
			}
		})();

		return () => {
			cancelled = true;
			for (const u of unlisteners) {
				u();
			}
			if (hasTrackRef.current) {
				void nativeAudioStop().catch(() => {
					/* unmount best-effort */
				});
			}
		};
	}, []);

	async function onPickLocalTrack() {
		setError(null);
		setBusy(true);
		try {
			const grant = await fileGrantPick('audio_play');
			const view = await nativeAudioPlayFromGrant(grant.grant_id);
			if (!view.ok) {
				hasTrackRef.current = false;
				setPlaying(false);
				setFileName(null);
				setPosition(0);
				setDuration(null);
				setError(view.message || 'Не удалось начать воспроизведение');
				return;
			}
			hasTrackRef.current = true;
			setFileName(view.file_name ?? 'track');
			setPlaying(Boolean(view.playing));
			setPosition(view.position_secs ?? 0);
			setDuration(view.duration_secs ?? null);
			if (typeof view.volume === 'number') {
				setVolume(view.volume);
			}
		} catch (e) {
			hasTrackRef.current = false;
			setPlaying(false);
			setFileName(null);
			setPosition(0);
			setDuration(null);
			const msg =
				e instanceof Error ? e.message : 'Не удалось выбрать аудиофайл';
			if (!/grant_pick_cancelled/i.test(msg)) {
				setError(msg);
			}
		} finally {
			setBusy(false);
		}
	}

	async function onTogglePlay() {
		if (transportInFlightRef.current) {
			return;
		}
		transportInFlightRef.current = true;
		setBusy(true);
		try {
			const view = playingRef.current
				? await nativeAudioPause()
				: await nativeAudioResume();
			applyView(
				view,
				setError,
				setFileName,
				setPlaying,
				setPosition,
				setDuration
			);
		} catch (e) {
			setError(
				e instanceof Error ? e.message : 'Ошибка управления воспроизведением'
			);
		} finally {
			transportInFlightRef.current = false;
			setBusy(false);
		}
	}

	async function onStop() {
		setBusy(true);
		try {
			const view = await nativeAudioStop();
			applyView(
				view,
				setError,
				setFileName,
				setPlaying,
				setPosition,
				setDuration
			);
			hasTrackRef.current = false;
			setFileName(null);
			setDuration(null);
			setPosition(0);
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Не удалось остановить');
		} finally {
			setBusy(false);
		}
	}

	async function onSeek(next: number) {
		try {
			const view = await nativeAudioSeek(next);
			applyView(
				view,
				setError,
				setFileName,
				setPlaying,
				setPosition,
				setDuration
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Не удалось перемотать');
		}
	}

	async function onVolume(next: number) {
		setVolume(next);
		try {
			const view = await nativeAudioSetVolume(next);
			if (!view.ok) {
				setError(view.message);
			}
		} catch (e) {
			setError(
				e instanceof Error ? e.message : 'Не удалось изменить громкость'
			);
		}
	}

	const max = duration && duration > 0 ? duration : Math.max(position, 1);
	const transportReady = Boolean(fileName) && hasTrackRef.current;

	return (
		<section
			className="panel offline-app-panel"
			aria-labelledby="music-heading"
		>
			<div className="offline-app-toolbar">
				<button type="button" className="secondary" onClick={onBack}>
					← Каталог
				</button>
			</div>
			<h2 id="music-heading">Музыка</h2>
			<p className="muted">
				Воспроизведение локального файла на устройстве через нативный плеер.
				Облачная библиотека недоступна офлайн.
			</p>
			<p className={`status${error ? ' status-warn' : ''}`} role="status">
				{error ??
					(fileName ? `Файл: ${fileName}` : 'Выберите аудиофайл на диске')}
			</p>
			<button
				type="button"
				disabled={busy}
				aria-label="Выбрать аудиофайл"
				onClick={() => {
					void onPickLocalTrack();
				}}
			>
				Выбрать аудиофайл
			</button>
			{transportReady ? (
				<section
					className="offline-native-audio"
					aria-label="Нативное воспроизведение"
				>
					<div className="offline-native-audio-clock muted">
						{formatClock(position)}
						{duration != null ? ` / ${formatClock(duration)}` : ''}
					</div>
					<input
						type="range"
						min={0}
						max={max}
						step={0.1}
						value={Math.min(position, max)}
						aria-label="Позиция трека"
						disabled={busy || duration == null}
						onChange={(e) => {
							const next = Number(e.target.value);
							setPosition(next);
						}}
						onMouseUp={(e) => {
							void onSeek(Number((e.target as HTMLInputElement).value));
						}}
						onTouchEnd={(e) => {
							void onSeek(Number((e.target as HTMLInputElement).value));
						}}
						onKeyUp={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								void onSeek(Number((e.target as HTMLInputElement).value));
							}
						}}
					/>
					<div className="offline-native-audio-actions">
						<button
							type="button"
							disabled={busy}
							onClick={() => {
								void onTogglePlay();
							}}
						>
							{playing ? 'Пауза' : 'Играть'}
						</button>
						<button
							type="button"
							className="secondary"
							disabled={busy}
							onClick={() => {
								void onStop();
							}}
						>
							Стоп
						</button>
					</div>
					<label className="offline-native-audio-volume">
						<span className="muted">Громкость</span>
						<input
							type="range"
							min={0}
							max={1}
							step={0.01}
							value={volume}
							aria-label="Громкость"
							disabled={busy}
							onChange={(e) => {
								void onVolume(Number(e.target.value));
							}}
						/>
					</label>
				</section>
			) : null}
			<OfflineSpaDeepLinkCta appId="MusicPlayer" appBase={appBase} />
		</section>
	);
}
