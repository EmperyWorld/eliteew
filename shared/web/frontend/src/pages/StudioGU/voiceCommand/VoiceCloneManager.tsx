/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Управление клоном голоса (XTTS): загрузка образцов, предпрослушивание, тест синтеза. В MVP отключено (`MVP_XTTS_DISABLED`).
 *
 * Invariants:
 * - Воспроизведение `data:audio/...;base64` нормализуем через `resolveAudioUrlForPlayback`; отзываем blob URL после воспроизведения.
 * - Не вызывать API XTTS при MVP-заглушке.
 *
 * Related:
 * - `voice-command` центр, `/api/v1/live-voice/tts/xtts`.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import * as React from 'react';
import {
	ArrowPathIcon,
	ArrowUpTrayIcon,
	CheckIcon,
	ExclamationCircleIcon,
	MicrophoneIcon,
	MusicalNoteIcon,
	PauseIcon,
	PlayIcon,
	SparklesIcon,
	SpeakerWaveIcon,
	TrashIcon,
	UserIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { api } from '@/services/api/client';
import { registerMicActive } from '@/voice-core/micActive';
import { resolveAudioUrlForPlayback } from '@/voice-core/utils/resolveAudioUrlForPlayback';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppInput,
} from '@/pages/Desktop/components/DesktopAppChrome';

/** Stack9 MVP: XTTS voice clone disabled; only silero is in use. */
const MVP_XTTS_DISABLED = true;

interface VoiceProfile {
	id: string;
	name: string;
	audioBase64: string;
	createdAt: Date;
	duration: number; // seconds
}

interface VoiceCloneManagerProps {
	onVoiceSelect?: (profile: VoiceProfile | null) => void;
	selectedVoiceId?: string | null;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MIN_DURATION = 6; // seconds
const MAX_DURATION = 30; // seconds
const SUPPORTED_FORMATS = [
	'audio/wav',
	'audio/mp3',
	'audio/mpeg',
	'audio/webm',
	'audio/ogg',
];

function fileToBase64(file: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result as string;
			const base64 = result.split(',')[1];
			resolve(base64);
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

function getAudioDuration(file: Blob): Promise<number> {
	return new Promise((resolve) => {
		const audio = new Audio();
		audio.src = URL.createObjectURL(file);
		audio.onloadedmetadata = () => {
			resolve(audio.duration);
			URL.revokeObjectURL(audio.src);
		};
		audio.onerror = () => resolve(0);
	});
}

export const VoiceCloneManager: React.FC<VoiceCloneManagerProps> = ({
	onVoiceSelect,
	selectedVoiceId,
}) => {
	const { isAuthenticated } = useAuth();
	const [voices, setVoices] = useState<VoiceProfile[]>(() => {
		const saved = localStorage.getItem('voice_profiles');
		return saved ? JSON.parse(saved) : [];
	});
	const [isUploading, setIsUploading] = useState(false);
	const [isRecording, setIsRecording] = useState(false);
	const [isTesting, setIsTesting] = useState(false);
	const [testText, setTestText] = useState(
		'Привет! Это тест клонированного голоса.'
	);
	const [error, setError] = useState<string | null>(null);
	const [recordingTime, setRecordingTime] = useState(0);
	const [playingId, setPlayingId] = useState<string | null>(null);
	const [showAddNew, setShowAddNew] = useState(false);
	const [newVoiceName, setNewVoiceName] = useState('');

	const fileInputRef = useRef<HTMLInputElement>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
		null
	);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const revokePlaybackRef = useRef<(() => void) | null>(null);
	const unregisterMicRef = useRef<(() => void) | null>(null);
	const reduceMotion = useReducedMotion();

	useEffect(() => {
		return (): void => {
			revokePlaybackRef.current?.();
			revokePlaybackRef.current = null;
		};
	}, []);

	// Save voices to localStorage
	const saveVoices = useCallback((newVoices: VoiceProfile[]) => {
		setVoices(newVoices);
		localStorage.setItem('voice_profiles', JSON.stringify(newVoices));
	}, []);

	// Handle file upload
	const handleFileUpload = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;

			setError(null);
			setIsUploading(true);

			try {
				// Validate file type
				if (!SUPPORTED_FORMATS.includes(file.type)) {
					throw new Error(
						'Неподдерживаемый формат. Используйте WAV, MP3 или WebM.'
					);
				}

				// Validate file size
				if (file.size > MAX_FILE_SIZE) {
					throw new Error('Файл слишком большой. Максимум 10MB.');
				}

				// Get duration
				const duration = await getAudioDuration(file);
				if (duration < MIN_DURATION) {
					throw new Error(
						`Запись слишком короткая. Минимум ${MIN_DURATION} секунд.`
					);
				}
				if (duration > MAX_DURATION) {
					throw new Error(
						`Запись слишком длинная. Максимум ${MAX_DURATION} секунд.`
					);
				}

				// Convert to base64
				const audioBase64 = await fileToBase64(file);

				// Create profile
				const profile: VoiceProfile = {
					id: `voice_${Date.now()}`,
					name: newVoiceName || file.name.replace(/\.[^/.]+$/, ''),
					audioBase64,
					createdAt: new Date(),
					duration: Math.round(duration),
				};

				saveVoices([...voices, profile]);
				setShowAddNew(false);
				setNewVoiceName('');

				// Auto-select new voice
				onVoiceSelect?.(profile);
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Ошибка загрузки');
			} finally {
				setIsUploading(false);
				if (fileInputRef.current) {
					fileInputRef.current.value = '';
				}
			}
		},
		[voices, newVoiceName, saveVoices, onVoiceSelect]
	);

	const stopRecording = useCallback(() => {
		unregisterMicRef.current?.();
		unregisterMicRef.current = null;
		if (recordingIntervalRef.current) {
			clearInterval(recordingIntervalRef.current);
		}
		if (
			mediaRecorderRef.current &&
			mediaRecorderRef.current.state !== 'inactive'
		) {
			mediaRecorderRef.current.stop();
		}
		setIsRecording(false);
	}, []);

	// Start recording
	const startRecording = useCallback(async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

			mediaRecorderRef.current = new MediaRecorder(stream, {
				mimeType: 'audio/webm;codecs=opus',
			});
			audioChunksRef.current = [];

			mediaRecorderRef.current.ondataavailable = (e) => {
				if (e.data.size > 0) {
					audioChunksRef.current.push(e.data);
				}
			};

			mediaRecorderRef.current.onstop = async () => {
				unregisterMicRef.current?.();
				unregisterMicRef.current = null;
				stream.getTracks().forEach((track) => {
					track.stop();
				});

				const audioBlob = new Blob(audioChunksRef.current, {
					type: 'audio/webm',
				});
				const duration = recordingTime;

				if (duration < MIN_DURATION) {
					setError(`Запись слишком короткая. Минимум ${MIN_DURATION} секунд.`);
					return;
				}

				try {
					const audioBase64 = await fileToBase64(audioBlob);

					const profile: VoiceProfile = {
						id: `voice_${Date.now()}`,
						name: newVoiceName || `Запись ${new Date().toLocaleString('ru')}`,
						audioBase64,
						createdAt: new Date(),
						duration: Math.round(duration),
					};

					saveVoices([...voices, profile]);
					setShowAddNew(false);
					setNewVoiceName('');
					onVoiceSelect?.(profile);
				} catch {
					setError('Ошибка сохранения записи');
				}
			};

			mediaRecorderRef.current.start();
			unregisterMicRef.current = registerMicActive();
			setIsRecording(true);
			setRecordingTime(0);

			// Update recording time
			recordingIntervalRef.current = setInterval(() => {
				setRecordingTime((t) => {
					if (t >= MAX_DURATION) {
						stopRecording();
						return t;
					}
					return t + 1;
				});
			}, 1000);
		} catch {
			setError('Не удалось получить доступ к микрофону');
		}
	}, [
		newVoiceName,
		voices,
		saveVoices,
		onVoiceSelect,
		recordingTime,
		stopRecording,
	]);

	// Delete voice profile
	const deleteVoice = useCallback(
		(id: string) => {
			const newVoices = voices.filter((v) => v.id !== id);
			saveVoices(newVoices);
			if (selectedVoiceId === id) {
				onVoiceSelect?.(null);
			}
		},
		[voices, selectedVoiceId, saveVoices, onVoiceSelect]
	);

	// PlayIcon voice sample
	const playVoice = useCallback(
		(profile: VoiceProfile) => {
			if (playingId === profile.id) {
				audioRef.current?.pause();
				revokePlaybackRef.current?.();
				revokePlaybackRef.current = null;
				setPlayingId(null);
				return;
			}

			audioRef.current?.pause();
			revokePlaybackRef.current?.();
			revokePlaybackRef.current = null;

			void (async (): Promise<void> => {
				const src = `data:audio/webm;base64,${profile.audioBase64}`;
				let playUrl: string;
				let revoke: () => void;
				try {
					const resolved = await resolveAudioUrlForPlayback(src);
					playUrl = resolved.playUrl;
					revoke = resolved.revoke;
				} catch {
					setPlayingId(null);
					return;
				}
				revokePlaybackRef.current = revoke;
				const audio = new Audio(playUrl);
				audio.onended = () => {
					revokePlaybackRef.current?.();
					revokePlaybackRef.current = null;
					setPlayingId(null);
				};
				audio.onerror = () => {
					revokePlaybackRef.current?.();
					revokePlaybackRef.current = null;
					setPlayingId(null);
				};
				try {
					await audio.play();
					audioRef.current = audio;
					setPlayingId(profile.id);
				} catch {
					revokePlaybackRef.current?.();
					revokePlaybackRef.current = null;
				}
			})();
		},
		[playingId]
	);

	// Test XTTS with selected voice (via canonical API client)
	const testVoice = useCallback(
		async (profile: VoiceProfile) => {
			if (!isAuthenticated) return;

			setIsTesting(true);
			setError(null);

			try {
				const result = await api.post<{ audio_base64?: string }>(
					'/api/v1/live-voice/tts/xtts',
					{
						text: testText,
						language: 'ru',
						speaker_wav_base64: profile.audioBase64,
					}
				);

				if (result?.audio_base64) {
					void (async (): Promise<void> => {
						const src = `data:audio/wav;base64,${result.audio_base64}`;
						const { playUrl, revoke } = await resolveAudioUrlForPlayback(src);
						try {
							const audio = new Audio(playUrl);
							audio.onended = () => revoke();
							audio.onerror = () => revoke();
							await audio.play();
						} catch {
							revoke();
						}
					})();
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Ошибка тестирования');
			} finally {
				setIsTesting(false);
			}
		},
		[isAuthenticated, testText]
	);

	if (MVP_XTTS_DISABLED) {
		return (
			<div className="rounded-(--desktop-radius-lg) border border-[color-mix(in_srgb,rgb(245_158_11)_40%,var(--desktop-border-subtle))] bg-[color-mix(in_srgb,var(--desktop-surface-soft)_88%,rgb(245_158_11)_12%)] p-4 text-sm text-(--desktop-text-primary) shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.05)]">
				<div className="flex items-center gap-2 font-medium">
					<ExclamationCircleIcon
						className="h-4 w-4 shrink-0 text-[color-mix(in_srgb,rgb(251_191_36)_90%,var(--desktop-text-primary))]"
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					Клонирование голоса отключено для MVP
				</div>
				<p className="mt-2 text-(--desktop-text-muted)">
					Сейчас доступен синтез через UGS. Для озвучки используйте Голосовой
					Штаб или озвучку в настройках.
				</p>
			</div>
		);
	}

	const panelMotion = {
		initial: reduceMotion ? false : { opacity: 0, height: 0 },
		animate: reduceMotion ? false : { opacity: 1, height: 'auto' },
		exit: reduceMotion ? undefined : { opacity: 0, height: 0 },
	};

	return (
		<div
			className={cn(
				'rounded-(--desktop-radius-xl) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) p-4 shadow-(--desktop-shadow-soft)',
				DESKTOP_TYPOGRAPHY.body
			)}
			data-local-only="true"
			title="Профили голосов хранятся только в этом браузере"
		>
			<div className="mb-4 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<SparklesIcon
						className="h-5 w-5 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.9)]"
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					<h3 className="font-medium text-(--desktop-text-primary)">
						Клонирование голоса
					</h3>
					<span
						className="text-[10px] uppercase tracking-wide text-(--desktop-text-dim)"
						title="Только в этом браузере"
					>
						Только здесь
					</span>
				</div>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => setShowAddNew(!showAddNew)}
					className="border border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[rgb(var(--desktop-accent-rgb)/0.1)] text-(--desktop-text-primary) hover:bg-[rgb(var(--desktop-accent-rgb)/0.16)]"
				>
					{showAddNew ? 'Отмена' : '+ Добавить голос'}
				</DesktopAppButton>
			</div>

			<AnimatePresence>
				{error ? (
					<motion.div
						{...panelMotion}
						className="mb-4 flex items-center gap-2 rounded-(--desktop-radius) border border-red-500/35 bg-[color-mix(in_srgb,var(--desktop-surface-soft)_88%,rgb(127_29_29)_12%)] p-3 text-sm text-red-200/95"
						role="alert"
					>
						<ExclamationCircleIcon
							className="h-4 w-4 shrink-0"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						<span className="min-w-0 flex-1">{error}</span>
						<button
							type="button"
							onClick={() => setError(null)}
							className="ml-auto rounded-md p-1 text-(--desktop-text-muted) transition-colors hover:bg-(--desktop-surface-soft) hover:text-(--desktop-text-primary)"
							title="Закрыть"
							aria-label="Закрыть сообщение об ошибке"
						>
							<XMarkIcon
								className="h-4 w-4"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						</button>
					</motion.div>
				) : null}
			</AnimatePresence>

			<AnimatePresence>
				{showAddNew ? (
					<motion.div
						{...panelMotion}
						className={cn('mb-4', DESKTOP_APP_STYLE_CONTRACT.softCard, 'p-4')}
					>
						<DesktopAppInput
							type="text"
							value={newVoiceName}
							onChange={(e) => setNewVoiceName(e.target.value)}
							placeholder="Название голоса (опционально)"
							className="mb-3"
						/>

						<div className="flex gap-3">
							<DesktopAppButton
								type="button"
								variant="ghost"
								className="flex-1 gap-2 border border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.1)] py-3 text-(--desktop-text-primary) hover:bg-[rgb(var(--desktop-accent-rgb)/0.16)]"
								onClick={() => fileInputRef.current?.click()}
								disabled={isUploading || isRecording}
							>
								{isUploading ? (
									<ArrowPathIcon className="h-5 w-5 shrink-0 animate-spin motion-reduce:animate-none" />
								) : (
									<ArrowUpTrayIcon
										className="h-5 w-5 shrink-0"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								)}
								<span>Загрузить файл</span>
							</DesktopAppButton>

							<DesktopAppButton
								type="button"
								variant="ghost"
								className={cn(
									'flex-1 gap-2 py-3',
									isRecording
										? 'border border-red-500/35 bg-[color-mix(in_srgb,var(--desktop-surface-soft)_88%,rgb(127_29_29)_12%)] text-red-100 hover:bg-[color-mix(in_srgb,var(--desktop-surface-soft)_82%,rgb(127_29_29)_18%)]'
										: 'border border-emerald-500/35 bg-emerald-500/12 text-emerald-100 hover:bg-emerald-500/18'
								)}
								onClick={isRecording ? stopRecording : startRecording}
								disabled={isUploading}
							>
								<MicrophoneIcon
									className={cn(
										'h-5 w-5 shrink-0',
										isRecording && 'motion-reduce:animate-none animate-pulse'
									)}
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
								<span>
									{isRecording ? `Запись ${recordingTime}с` : 'Записать'}
								</span>
							</DesktopAppButton>
						</div>

						<input
							ref={fileInputRef}
							type="file"
							accept="audio/*"
							onChange={handleFileUpload}
							className="hidden"
							aria-label="Загрузить образец голоса (аудио)"
						/>

						<p className={cn('mt-3', DESKTOP_APP_STYLE_CONTRACT.helperText)}>
							Требования: {MIN_DURATION}-{MAX_DURATION} сек, чистая речь без
							шума
						</p>
					</motion.div>
				) : null}
			</AnimatePresence>

			<div className="space-y-2">
				{voices.length === 0 ? (
					<DesktopAppEmptyState
						className="py-6"
						icon={
							<UserIcon
								className="h-10 w-10 opacity-80"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						}
						title="Нет сохранённых голосов"
						description="Добавьте образец для клонирования"
					/>
				) : (
					voices.map((profile) => (
						<motion.div
							key={profile.id}
							layout={!reduceMotion}
							className={cn(
								'cursor-pointer rounded-(--desktop-radius) border p-3 transition-colors motion-reduce:transition-none',
								selectedVoiceId === profile.id
									? 'border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[rgb(var(--desktop-accent-rgb)/0.12)]'
									: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/50 hover:bg-(--desktop-surface-soft-hover)'
							)}
							onClick={() =>
								onVoiceSelect?.(selectedVoiceId === profile.id ? null : profile)
							}
						>
							<div className="flex items-center gap-3">
								<div
									className={cn(
										'flex h-10 w-10 items-center justify-center rounded-full',
										selectedVoiceId === profile.id
											? 'bg-[rgb(var(--desktop-accent-rgb)/0.2)]'
											: 'bg-[color-mix(in_srgb,var(--desktop-surface-panel)_85%,transparent)]'
									)}
								>
									{selectedVoiceId === profile.id ? (
										<CheckIcon
											className="h-5 w-5 text-[rgb(var(--desktop-accent-rgb))]"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
									) : (
										<MusicalNoteIcon
											className="h-5 w-5 text-(--desktop-text-muted)"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
									)}
								</div>

								<div className="min-w-0 flex-1">
									<p className="truncate font-medium text-(--desktop-text-primary)">
										{profile.name}
									</p>
									<p className={DESKTOP_APP_STYLE_CONTRACT.helperText}>
										{profile.duration}с •{' '}
										{new Date(profile.createdAt).toLocaleDateString('ru')}
									</p>
								</div>

								<div className="flex items-center gap-1">
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											playVoice(profile);
										}}
										className="rounded-lg p-2 text-(--desktop-text-muted) transition-colors hover:bg-(--desktop-surface-soft) hover:text-(--desktop-text-primary) motion-reduce:transition-none"
										title="Прослушать образец"
									>
										{playingId === profile.id ? (
											<PauseIcon
												className="h-4 w-4 text-[rgb(var(--desktop-accent-rgb))]"
												strokeWidth={DESKTOP_LUCIDE.stroke}
											/>
										) : (
											<PlayIcon
												className="h-4 w-4"
												strokeWidth={DESKTOP_LUCIDE.stroke}
											/>
										)}
									</button>

									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											testVoice(profile);
										}}
										disabled={isTesting}
										className="rounded-lg p-2 text-[rgb(var(--desktop-accent-rgb)/0.9)] transition-colors hover:bg-(--desktop-surface-soft) disabled:opacity-50 motion-reduce:transition-none"
										title="Тест синтеза"
									>
										{isTesting ? (
											<ArrowPathIcon className="h-4 w-4 animate-spin motion-reduce:animate-none" />
										) : (
											<SpeakerWaveIcon
												className="h-4 w-4"
												strokeWidth={DESKTOP_LUCIDE.stroke}
											/>
										)}
									</button>

									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											deleteVoice(profile.id);
										}}
										className="rounded-lg p-2 text-[color-mix(in_srgb,rgb(252_165_165)_88%,var(--desktop-text-primary))] transition-colors hover:bg-[color-mix(in_srgb,var(--desktop-surface-soft)_82%,rgb(127_29_29)_18%)] motion-reduce:transition-none"
										title="Удалить"
									>
										<TrashIcon
											className="h-4 w-4"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
									</button>
								</div>
							</div>
						</motion.div>
					))
				)}
			</div>

			{voices.length > 0 ? (
				<div className="mt-4 border-t border-(--desktop-border-subtle) pt-4">
					<label
						htmlFor="test-text-input"
						className={cn('mb-2 block', DESKTOP_APP_STYLE_CONTRACT.helperText)}
					>
						Текст для теста:
					</label>
					<DesktopAppInput
						id="test-text-input"
						type="text"
						value={testText}
						onChange={(e) => setTestText(e.target.value)}
						placeholder="Введите текст для синтеза"
					/>
				</div>
			) : null}
		</div>
	);
};

export default VoiceCloneManager;
