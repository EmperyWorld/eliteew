/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF voice message inline player: fetch blob via chat API, waveform UI, play/pause control.
 *
 * Invariants:
 * - Recipient playback does not depend on content_shares ACL.
 *
 * Related:
 * - gafChatApi.ts · GafChatDesktopIconTooltip.tsx
 */
import { contentApi } from '@/services/contentApi';
import { cn } from '@/utils/cn';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ArrowPathIcon,
	PauseIcon,
	PlayIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { downloadGafMessageAttachmentBlob } from '../api/gafChatApi';
import { GAF_OPTIMISTIC_ID_PREFIX } from '../gafChatMessageUtils';
import { GafChatDesktopIconTooltip } from '../gafChatDesktopIconTooltip';

function hashSeed(id: string): number {
	let h = 0;
	for (let i = 0; i < id.length; i++) {
		h = Math.imul(31, h) + id.charCodeAt(i);
	}
	return Math.abs(h);
}

function waveformHeights(seedKey: string, count: number): number[] {
	let h = hashSeed(seedKey);
	const out: number[] = [];
	for (let i = 0; i < count; i++) {
		h = (h * 1103515245 + 12345) & 0x7fffffff;
		out.push(8 + (h % 22));
	}
	return out;
}

function formatVoiceTime(sec: number): string {
	if (!Number.isFinite(sec) || sec < 0) return '0:00';
	const m = Math.floor(sec / 60);
	const s = Math.floor(sec % 60);
	return `${m}:${s.toString().padStart(2, '0')}`;
}

export function GafChatVoiceMessagePlayer({
	chatId,
	messageId,
	fallbackContentId,
	mimeHint,
	isMine = false,
}: {
	chatId: string;
	messageId: string;
	fallbackContentId: string | null;
	mimeHint?: string | null;
	isMine?: boolean;
}): JSX.Element {
	const { t } = useTranslation('gafChat');
	const lucideStroke = DESKTOP_LUCIDE.stroke;
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const [blobUrl, setBlobUrl] = useState<string | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [playing, setPlaying] = useState(false);
	const [duration, setDuration] = useState(0);
	const [current, setCurrent] = useState(0);

	const isOptimistic = messageId.startsWith(GAF_OPTIMISTIC_ID_PREFIX);
	const barHeights = useMemo(
		() => waveformHeights(messageId || 'voice', 22),
		[messageId]
	);

	useEffect(() => {
		let cancelled = false;
		let objectUrl: string | null = null;
		(async () => {
			setLoading(true);
			setLoadError(null);
			try {
				let blob: Blob;
				if (isOptimistic && fallbackContentId) {
					const r = await contentApi.downloadContentBlob(fallbackContentId);
					blob = r.blob;
				} else {
					blob = await downloadGafMessageAttachmentBlob(chatId, messageId);
				}
				const hint = (mimeHint || '').trim();
				const typed =
					hint &&
					(!blob.type ||
						blob.type === 'application/octet-stream' ||
						blob.type === '')
						? new Blob([blob], { type: hint })
						: blob;
				objectUrl = URL.createObjectURL(typed);
				if (cancelled) {
					URL.revokeObjectURL(objectUrl);
					return;
				}
				setBlobUrl(objectUrl);
			} catch {
				if (!cancelled) setLoadError(t('voicePlayerLoadFailed'));
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [chatId, messageId, fallbackContentId, isOptimistic, mimeHint, t]);

	const toggle = useCallback(() => {
		const el = audioRef.current;
		if (!el || !blobUrl) return;
		if (playing) {
			el.pause();
			setPlaying(false);
		} else {
			void el.play().then(
				() => setPlaying(true),
				() => setPlaying(false)
			);
		}
	}, [blobUrl, playing]);

	useEffect(() => {
		if (!blobUrl) return;
		const el = audioRef.current;
		if (!el) return;
		const onEnded = () => setPlaying(false);
		const onPause = () => setPlaying(false);
		const onPlay = () => setPlaying(true);
		const onTime = () => setCurrent(el.currentTime);
		const onMeta = () => {
			const d = el.duration;
			if (Number.isFinite(d)) setDuration(d);
		};
		el.addEventListener('ended', onEnded);
		el.addEventListener('pause', onPause);
		el.addEventListener('play', onPlay);
		el.addEventListener('timeupdate', onTime);
		el.addEventListener('loadedmetadata', onMeta);
		return () => {
			el.removeEventListener('ended', onEnded);
			el.removeEventListener('pause', onPause);
			el.removeEventListener('play', onPlay);
			el.removeEventListener('timeupdate', onTime);
			el.removeEventListener('loadedmetadata', onMeta);
		};
	}, [blobUrl]);

	const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

	if (loadError) {
		return (
			<p
				className={cn(DESKTOP_TYPOGRAPHY.meta, 'text-amber-300/90')}
				role="status"
			>
				{loadError}
			</p>
		);
	}

	const shell = isMine
		? cn(
				'border-[rgb(var(--desktop-accent-rgb)/0.4)]',
				'bg-gradient-to-br from-[rgb(var(--desktop-accent-rgb)/0.2)] to-[rgb(var(--desktop-accent-rgb)/0.06)]',
				'shadow-[inset_0_1px_0_rgb(var(--desktop-accent-rgb)/0.15)]'
			)
		: cn(
				'border-(--desktop-border-subtle)',
				'bg-[color-mix(in_srgb,var(--desktop-surface-elevated)_92%,rgb(0_0_0/0.08))]',
				'shadow-[inset_0_1px_0_rgb(255/0.05)]'
			);

	const playBtn = isMine
		? cn(
				'bg-[rgb(var(--desktop-accent-rgb))]',
				'text-[rgb(var(--desktop-fg-primary-rgb))]',
				'shadow-[0_2px_12px_rgb(var(--desktop-accent-rgb)/0.4)]',
				'focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.55)]'
			)
		: cn(
				'bg-(--desktop-surface-soft)',
				'text-[rgb(var(--desktop-accent-rgb))]',
				'border border-[rgb(var(--desktop-accent-rgb)/0.35)]',
				'shadow-sm',
				'focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.35)]'
			);

	const barActive = isMine
		? 'bg-[rgb(var(--desktop-accent-rgb)/0.9)]'
		: 'bg-[rgb(var(--desktop-accent-rgb)/0.72)]';
	const barIdle = isMine
		? 'bg-[rgb(var(--desktop-accent-rgb)/0.38)]'
		: 'bg-[rgb(var(--desktop-accent-rgb)/0.26)]';

	if (loading) {
		return (
			<div
				className={cn(
					'relative w-full max-w-[min(100%,min(380px,100vw))] overflow-hidden rounded-[1.15rem] border',
					shell,
					'px-3 py-3 shadow-[0_4px_18px_rgba(0,0,0,0.07)]'
				)}
				role="status"
				aria-busy="true"
				aria-label={t('attachmentAudioLoading')}
			>
				<div className="mb-2 flex items-center justify-between gap-2">
					<span
						className={cn(
							'font-semibold uppercase tracking-wide',
							DESKTOP_TYPOGRAPHY.captionInherit,
							isMine
								? 'text-[rgb(var(--desktop-accent-rgb)/0.9)]'
								: 'text-(--desktop-text-muted)'
						)}
					>
						{t('voiceMessageLabel')}
					</span>
					<ArrowPathIcon
						className="h-3.5 w-3.5 shrink-0 animate-spin motion-reduce:animate-none text-(--desktop-text-dim)"
						aria-hidden
						strokeWidth={lucideStroke}
					/>
				</div>
				<div className="flex items-center gap-2.5">
					<div
						className={cn(
							'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
							playBtn
						)}
						aria-hidden
					>
						<ArrowPathIcon
							className="h-4 w-4 animate-spin motion-reduce:animate-none opacity-80"
							strokeWidth={lucideStroke}
						/>
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex h-7 items-end gap-[2px] overflow-hidden px-0.5 opacity-50">
							{barHeights.map((h, i) => (
								<span
									key={`sk-${messageId}-${i}`}
									className="w-[2.5px] shrink-0 rounded-full bg-(--desktop-border-subtle)"
									style={{ height: `${h}px`, maxHeight: '100%' }}
								/>
							))}
						</div>
						<div
							className={cn(
								'mt-1.5 h-1 w-full overflow-hidden rounded-full',
								isMine
									? 'bg-[rgb(var(--desktop-accent-rgb)/0.12)]'
									: 'bg-(--desktop-border-subtle)'
							)}
							aria-hidden
						/>
					</div>
					<div
						className={cn(
							'shrink-0 tabular-nums text-(--desktop-text-dim) opacity-50',
							DESKTOP_TYPOGRAPHY.shellCopy13,
							'min-w-12 text-right font-semibold'
						)}
					>
						…
					</div>
				</div>
				<p
					className={cn(
						'mt-2 text-center',
						DESKTOP_TYPOGRAPHY.caption,
						'text-(--desktop-text-dim)'
					)}
				>
					{t('attachmentAudioLoading')}
				</p>
			</div>
		);
	}

	return (
		<div
			className={cn(
				'relative w-full max-w-[min(100%,min(380px,100vw))] overflow-hidden rounded-[1.15rem] border',
				shell,
				'px-3 py-2.5'
			)}
		>
			<div className="mb-2 flex items-center justify-between gap-2">
				<span
					className={cn(
						'font-semibold uppercase tracking-wide',
						DESKTOP_TYPOGRAPHY.captionInherit,
						isMine
							? 'text-[rgb(var(--desktop-accent-rgb)/0.95)]'
							: 'text-(--desktop-text-muted)'
					)}
				>
					{t('voiceMessageLabel')}
				</span>
				<span
					className={cn(
						'tabular-nums text-(--desktop-text-dim)',
						DESKTOP_TYPOGRAPHY.caption
					)}
				>
					{duration > 0 ? formatVoiceTime(duration) : '…'}
				</span>
			</div>

			<div className="flex items-center gap-2.5">
				<GafChatDesktopIconTooltip
					content={playing ? t('voicePauseAria') : t('voicePlayAria')}
					placement="top"
					offsetExtra={4}
					disabled={!blobUrl}
				>
					<button
						type="button"
						onClick={() => toggle()}
						disabled={!blobUrl}
						className={cn(
							'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
							'outline-none transition-[transform,box-shadow] active:scale-[0.96]',
							'disabled:cursor-not-allowed disabled:opacity-45',
							'focus-visible:ring-2',
							playBtn
						)}
						aria-label={playing ? t('voicePauseAria') : t('voicePlayAria')}
					>
						{playing ? (
							<PauseIcon
								className="h-4 w-4 fill-current"
								aria-hidden
								strokeWidth={lucideStroke}
							/>
						) : (
							<PlayIcon
								className="ml-0.5 h-4 w-4 fill-current"
								aria-hidden
								strokeWidth={lucideStroke}
							/>
						)}
					</button>
				</GafChatDesktopIconTooltip>

				<div className="min-w-0 flex-1">
					<div className="flex h-7 items-end gap-[2px] overflow-hidden px-0.5">
						{barHeights.map((h, i) => (
							<span
								key={`${messageId}-w-${i}-${h}`}
								className={cn(
									'w-[2.5px] shrink-0 rounded-full transition-colors duration-200 motion-reduce:transition-none',
									playing ? barActive : barIdle
								)}
								style={{
									height: `${h}px`,
									maxHeight: '100%',
								}}
							/>
						))}
					</div>
					<div
						className={cn(
							'mt-1.5 h-1 w-full overflow-hidden rounded-full',
							isMine
								? 'bg-[rgb(var(--desktop-accent-rgb)/0.12)]'
								: 'bg-(--desktop-border-subtle)'
						)}
						aria-hidden
					>
						<div
							className={cn(
								'h-full rounded-full transition-[width] duration-150 ease-linear',
								isMine
									? 'bg-[rgb(var(--desktop-accent-rgb)/0.7)]'
									: 'bg-[rgb(var(--desktop-accent-rgb)/0.48)]'
							)}
							style={{ width: `${progress}%` }}
						/>
					</div>
				</div>

				<div
					className={cn(
						'shrink-0 tabular-nums text-(--desktop-text-primary)',
						DESKTOP_TYPOGRAPHY.shellCopy13,
						'min-w-12 text-right font-semibold'
					)}
				>
					{formatVoiceTime(current)}
				</div>
			</div>

			{blobUrl ? (
				<>
					{/* biome-ignore lint/a11y/useMediaCaption: raw voice clip */}
					<audio
						ref={audioRef}
						src={blobUrl}
						preload="metadata"
						className="hidden"
						aria-hidden
					/>
				</>
			) : null}
		</div>
	);
}
