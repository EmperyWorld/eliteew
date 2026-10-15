import { useCallback, useMemo, useState } from 'react';
import {
	ArrowDownTrayIcon,
	DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import { notify } from '@/notifications';
import { apiClient } from '../../../services/api';
import { ContentType } from '../../../types/fileExchange';
import type {
	TranscriptionResponse,
	TranscriptionSegment,
} from '../lib/audioTranscription.types';

interface TranscriptionResultProps {
	readonly result: TranscriptionResponse | null;
	readonly loading: boolean;
	readonly fileName?: string | null;
}

type TabKey = 'plain' | 'speakers' | 'srt' | 'vtt';

interface SpeakerWithSegments {
	readonly speakerId: string;
	readonly speakerName: string;
	readonly segments: readonly TranscriptionSegment[];
	readonly totalDuration: number;
	readonly wordCount: number;
}

export function TranscriptionResult({
	result,
	loading,
	fileName,
}: TranscriptionResultProps) {
	const [activeTab, setActiveTab] = useState<TabKey>('plain');
	const [saving, setSaving] = useState(false);

	const formatTime = useCallback((seconds: number): string => {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = Math.floor(seconds % 60);
		const ms = Math.floor((seconds % 1) * 1000);

		return `${hours.toString().padStart(2, '0')}:${minutes
			.toString()
			.padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms
			.toString()
			.padStart(3, '0')}`;
	}, []);

	const groupSegmentsBySpeaker = useCallback(
		(segments: readonly TranscriptionSegment[]): SpeakerWithSegments[] => {
			const speakerMap = new Map<string, TranscriptionSegment[]>();

			segments.forEach((segment) => {
				const speakerId = segment.speaker || 'SPEAKER_00';
				if (!speakerMap.has(speakerId)) {
					speakerMap.set(speakerId, []);
				}
				speakerMap.get(speakerId)?.push(segment);
			});

			const speakers: SpeakerWithSegments[] = Array.from(
				speakerMap.entries()
			).map(([speakerId, speakerSegments]) => {
				const totalDuration = speakerSegments.reduce(
					(sum, seg) => sum + (seg.end - seg.start),
					0
				);
				const wordCount = speakerSegments.reduce(
					(sum, seg) => sum + seg.text.split(' ').length,
					0
				);

				return {
					speakerId,
					speakerName: `Спикер ${speakerId.replace('SPEAKER_', '')}`,
					segments: speakerSegments.sort((a, b) => a.start - b.start),
					totalDuration,
					wordCount,
				};
			});

			return speakers.sort((a, b) => b.totalDuration - a.totalDuration);
		},
		[]
	);

	const getSpeakerColor = useCallback((speakerId: string): string => {
		const colors = [
			'bg-blue-500',
			'bg-green-500',
			'bg-purple-500',
			'bg-orange-500',
			'bg-pink-500',
			'bg-cyan-500',
			'bg-indigo-500',
			'bg-yellow-500',
		];
		const speakerIdStr = speakerId || 'SPEAKER_00';
		const speakerNum = parseInt(
			speakerIdStr.replace('SPEAKER_', '') || '0',
			10
		);
		return colors[speakerNum % colors.length];
	}, []);

	const segments = result?.segments ?? [];

	const speakers = useMemo(
		() => (segments.length > 0 ? groupSegmentsBySpeaker(segments) : []),
		[groupSegmentsBySpeaker, segments]
	);

	const formatTranscriptionWithSpeakers = useCallback(
		(segments: readonly TranscriptionSegment[]): string => {
			if (segments.length === 0) {
				return '';
			}

			const grouped = groupSegmentsBySpeaker(segments);
			if (grouped.length === 0) {
				return segments
					.slice()
					.sort((a, b) => a.start - b.start)
					.map((seg) => seg.text)
					.join(' ');
			}

			const speakerNameById = new Map<string, string>(
				grouped.map((speaker) => [speaker.speakerId, speaker.speakerName])
			);

			const sortedSegments = segments.slice().sort((a, b) => a.start - b.start);

			const lines: string[] = [];
			let currentSpeakerId: string | null = null;
			let currentSpeakerLabel: string | null = null;
			let currentTextParts: string[] = [];

			const flushCurrent = (): void => {
				if (!currentSpeakerLabel || currentTextParts.length === 0) {
					return;
				}
				lines.push(`${currentSpeakerLabel}:`);
				lines.push(currentTextParts.join(' '));
				lines.push('');
			};

			sortedSegments.forEach((segment) => {
				const speakerId = segment.speaker || 'SPEAKER_00';
				const speakerLabel =
					speakerNameById.get(speakerId) ??
					`Спикер ${speakerId.replace('SPEAKER_', '') || '0'}`;

				if (currentSpeakerId === null) {
					currentSpeakerId = speakerId;
					currentSpeakerLabel = speakerLabel;
					currentTextParts = [segment.text];
					return;
				}

				if (speakerId !== currentSpeakerId) {
					flushCurrent();
					currentSpeakerId = speakerId;
					currentSpeakerLabel = speakerLabel;
					currentTextParts = [segment.text];
				} else {
					currentTextParts.push(segment.text);
				}
			});

			flushCurrent();

			return lines.join('\n').trim();
		},
		[groupSegmentsBySpeaker]
	);

	const formatSRTWithSpeakers = useCallback(
		(segments: readonly TranscriptionSegment[]): string => {
			if (segments.length === 0) {
				return '';
			}

			const grouped = groupSegmentsBySpeaker(segments);
			const speakerNameById = new Map<string, string>(
				grouped.map((speaker) => [speaker.speakerId, speaker.speakerName])
			);

			const sortedSegments = segments.slice().sort((a, b) => a.start - b.start);

			let srtContent = '';
			let index = 1;
			let lastSpeakerId: string | null = null;

			sortedSegments.forEach((segment) => {
				const speakerId = segment.speaker || 'SPEAKER_00';
				if (speakerId !== lastSpeakerId) {
					const speakerName =
						speakerNameById.get(speakerId) ??
						`Спикер ${speakerId.replace('SPEAKER_', '') || '0'}`;
					srtContent += `\n// ${speakerName}\n`;
					lastSpeakerId = speakerId;
				}

				srtContent += `${index}\n${formatTime(segment.start)} --> ${formatTime(
					segment.end
				)}\n${segment.text}\n\n`;
				index += 1;
			});

			return srtContent.trim();
		},
		[formatTime, groupSegmentsBySpeaker]
	);

	const formatVTTWithSpeakers = useCallback(
		(segments: readonly TranscriptionSegment[]): string => {
			if (segments.length === 0) {
				return '';
			}

			const grouped = groupSegmentsBySpeaker(segments);
			const speakerNameById = new Map<string, string>(
				grouped.map((speaker) => [speaker.speakerId, speaker.speakerName])
			);

			const sortedSegments = segments.slice().sort((a, b) => a.start - b.start);

			let vttContent = 'WEBVTT\n\n';
			let lastSpeakerId: string | null = null;

			sortedSegments.forEach((segment) => {
				const speakerId = segment.speaker || 'SPEAKER_00';
				if (speakerId !== lastSpeakerId) {
					const speakerName =
						speakerNameById.get(speakerId) ??
						`Спикер ${speakerId.replace('SPEAKER_', '') || '0'}`;
					vttContent += `\n// ${speakerName}\n`;
					lastSpeakerId = speakerId;
				}

				vttContent += `${formatTime(segment.start)} --> ${formatTime(
					segment.end
				)}\n${segment.text}\n\n`;
			});

			return vttContent.trim();
		},
		[formatTime, groupSegmentsBySpeaker]
	);

	const getFormattedContent = useCallback(
		(tab: TabKey): string => {
			if (!result) {
				return '';
			}
			if (tab === 'plain') {
				return result.text;
			}
			if (tab === 'speakers') {
				return formatTranscriptionWithSpeakers(result.segments);
			}
			if (tab === 'srt') {
				return formatSRTWithSpeakers(result.segments);
			}
			if (tab === 'vtt') {
				return formatVTTWithSpeakers(result.segments);
			}
			return result.text;
		},
		[
			formatSRTWithSpeakers,
			formatTranscriptionWithSpeakers,
			formatVTTWithSpeakers,
			result,
		]
	);

	const formattedContent = useMemo(
		() => getFormattedContent(activeTab),
		[activeTab, getFormattedContent]
	);

	const handleSaveToContentManager = useCallback(async (): Promise<void> => {
		if (!result || !fileName || saving) {
			return;
		}

		setSaving(true);

		try {
			const baseName = fileName.replace(/\.[^/.]+$/, '');
			const speakerAwareContent =
				formatTranscriptionWithSpeakers(result.segments) || result.text;
			const blob = new Blob([speakerAwareContent], { type: 'text/plain' });

			const formData = new FormData();
			formData.append('file', blob, `${baseName}_transcription.txt`);
			formData.append('content_type', ContentType.DOCUMENT);
			formData.append(
				'description',
				`Транскрибация аудио: ${fileName}\nЯзык: ${result.language}\nТочность: ${(result.confidence * 100).toFixed(1)}%\nМодель: ${result.whisperModel}\nДлительность: ${(result.durationMs / 1000).toFixed(1)}с\nСпикеры: ${
					speakers.length || 1
				}`
			);
			formData.append(
				'tags',
				JSON.stringify([
					'transcription',
					'audio',
					result.language,
					result.whisperModel,
				])
			);

			const response = await apiClient.post('/api/v1/content', formData, {
				headers: {
					'Content-Type': 'multipart/form-data',
				},
			});

			if (response.data?.id) {
				notify.success(
					`Результат сохранен в Content Manager: ID ${response.data.id}`
				);
			} else {
				notify.error('Не удалось сохранить в Content Manager');
			}
		} catch (error: unknown) {
			const anyError = error as {
				response?: { data?: { message?: string; detail?: string } | string };
				message?: string;
			};
			let message: string;
			if (typeof anyError.response?.data === 'string') {
				message = anyError.response.data;
			} else {
				message =
					anyError.response?.data?.message ||
					anyError.response?.data?.detail ||
					anyError.message ||
					'Неизвестная ошибка сохранения в Content Manager';
			}
			// eslint-disable-next-line no-console
			console.error('Error saving to Content Manager:', error);
			notify.error(`Ошибка сохранения в Content Manager: ${message}`);
		} finally {
			setSaving(false);
		}
	}, [
		fileName,
		formatTranscriptionWithSpeakers,
		result,
		saving,
		speakers.length,
	]);

	if (loading && !result) {
		return (
			<section
				className="rounded-lg border border-slate-700 bg-slate-900/70 p-6 text-slate-200 shadow-[0_18px_45px_rgba(15,23,42,0.75)] backdrop-blur"
				aria-live="polite"
			>
				Обработка аудио...
			</section>
		);
	}

	if (!result) {
		return (
			<section className="rounded-lg border border-dashed border-slate-700/70 bg-slate-900/40 p-6 text-sm text-slate-400">
				Результат транскрибации появится здесь после обработки файла.
			</section>
		);
	}

	const downloadText = (): void => {
		const ext = activeTab === 'plain' ? 'txt' : activeTab;
		const blob = new Blob([formattedContent], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `transcription-${Date.now()}.${ext}`;
		link.click();
		URL.revokeObjectURL(url);
	};

	const copyText = async (): Promise<void> => {
		await navigator.clipboard.writeText(formattedContent);
	};

	return (
		<section className="space-y-5 rounded-lg border border-slate-700 bg-slate-900/70 p-5 text-slate-100 shadow-[0_18px_45px_rgba(15,23,42,0.75)] backdrop-blur">
			<header className="flex items-start justify-between gap-4">
				<div>
					<h2 className="text-sm font-semibold text-slate-100 sm:text-base">
						Результат транскрибации
					</h2>
					<p className="text-xs text-slate-400">
						Готово к копированию, экспорту и сохранению в Content Manager
					</p>
				</div>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={handleSaveToContentManager}
						disabled={!fileName || saving}
						className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 shadow-sm shadow-slate-900/60 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<ArrowDownTrayIcon className="w-3 h-3" /> Сохранить в CM
					</button>
					<button
						type="button"
						onClick={copyText}
						className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 shadow-sm shadow-slate-900/60 transition-colors hover:bg-slate-700"
					>
						<DocumentDuplicateIcon className="w-3 h-3" /> Скопировать
					</button>
					<button
						type="button"
						onClick={downloadText}
						className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 shadow-sm shadow-slate-900/60 transition-colors hover:bg-slate-700"
					>
						<ArrowDownTrayIcon className="w-3 h-3" /> Скачать
					</button>
				</div>
			</header>

			<dl className="grid grid-cols-2 gap-3 rounded-lg bg-slate-900/80 p-3 text-xs text-slate-300 ring-1 ring-slate-800/80">
				<MetadataItem label="Язык" value={result.language.toUpperCase()} />
				<MetadataItem
					label="Точность"
					value={`${(result.confidence * 100).toFixed(1)}%`}
				/>
				<MetadataItem
					label="Длительность"
					value={`${(result.durationMs / 1000).toFixed(1)}с`}
				/>
				<MetadataItem label="Модель" value={result.whisperModel} />
				<MetadataItem
					label="Размер"
					value={`${(result.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`}
				/>
				<MetadataItem label="Формат" value={result.format.toUpperCase()} />
			</dl>

			{speakers.length > 0 && (
				<div className="flex flex-wrap gap-2 text-[11px]">
					{speakers.map((speaker) => (
						<div
							key={speaker.speakerId}
							className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/70 px-3 py-1.5"
						>
							<span
								className={`h-1.5 w-1.5 rounded-full ${getSpeakerColor(speaker.speakerId)}`}
								aria-hidden="true"
							/>
							<span className="font-medium text-slate-100">
								{speaker.speakerName}
							</span>
							<span className="text-slate-400">
								{`${Math.round(speaker.totalDuration)}с`} • {speaker.wordCount}{' '}
								слов
							</span>
						</div>
					))}
				</div>
			)}

			<div className="space-y-3">
				<div className="inline-flex rounded-full bg-slate-900/80 p-1 text-xs ring-1 ring-slate-800/80">
					{[
						{ key: 'plain' as TabKey, label: 'Текст' },
						{ key: 'speakers' as TabKey, label: 'По спикерам' },
						{ key: 'srt' as TabKey, label: 'SRT' },
						{ key: 'vtt' as TabKey, label: 'VTT' },
					].map((tab) => (
						<button
							key={tab.key}
							type="button"
							onClick={() => setActiveTab(tab.key)}
							className={`px-3 py-1 rounded-md font-medium transition-colors ${
								activeTab === tab.key
									? 'bg-slate-100 text-slate-900 shadow-sm'
									: 'text-slate-300 hover:text-slate-50'
							}`}
						>
							{tab.label}
						</button>
					))}
				</div>

				<article
					className="h-[55vh] overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 p-4"
					aria-label="Текст транскрибации"
				>
					<pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap text-slate-100">
						{formattedContent}
					</pre>
				</article>
			</div>
		</section>
	);
}

interface MetadataItemProps {
	readonly label: string;
	readonly value: string;
}

function MetadataItem({ label, value }: MetadataItemProps) {
	return (
		<div className="rounded-md bg-slate-900/60 p-3">
			<dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
				{label}
			</dt>
			<dd className="mt-0.5 text-sm font-medium text-slate-100">{value}</dd>
		</div>
	);
}
