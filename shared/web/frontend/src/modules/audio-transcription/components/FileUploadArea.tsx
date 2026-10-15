import * as React from 'react';
import { useCallback, useState } from 'react';
import { UnifiedContentPickerModal } from '@/components/UnifiedContent/picker/UnifiedContentPickerModal';
import { DESKTOP_Z_INDEX } from '@/pages/Desktop/constants';
import type { Content } from '@/components/UnifiedContent/types';
import { apiClient } from '@/services/api';
import { ContentType } from '@/types/fileExchange';
import {
	validateAudioFile,
	type FileValidationResult,
} from '../lib/audioTranscription.validators';
import {
	ArrowUpTrayIcon,
	CircleStackIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

import {
	LANGUAGE_OPTIONS,
	WHISPER_MODELS,
	type SelectOption,
} from '../lib/audioTranscription.constants';

interface FileUploadAreaProps {
	readonly file: File | null;
	readonly onFileSelect: (file: File, validation: FileValidationResult) => void;
	readonly onTranscribe: () => void;
	readonly loading: boolean;
	readonly error: string | null;
	readonly validation: FileValidationResult | null;
	readonly selectedLanguage: string;
	readonly selectedModel: string;
	readonly onLanguageChange: (value: string) => void;
	readonly onModelChange: (value: string) => void;
}

const AUDIO_VIDEO_TYPES = [ContentType.AUDIO, ContentType.VIDEO] as const;

export function FileUploadArea({
	file,
	onFileSelect,
	onTranscribe,
	loading,
	error,
	validation,
	selectedLanguage,
	selectedModel,
	onLanguageChange,
	onModelChange,
}: FileUploadAreaProps) {
	const fileInputRef = React.useRef<HTMLInputElement>(null);
	const [showContentPicker, setShowContentPicker] = useState(false);

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const selectedFile = e.target.files?.[0];
			if (!selectedFile) {
				return;
			}

			const validationResult = validateAudioFile(selectedFile);
			onFileSelect(selectedFile, validationResult);
		},
		[onFileSelect]
	);

	const loadContentAsFile = useCallback(
		async (content: Content) => {
			const response = await apiClient.get(
				`/api/v1/content/${content.id}/download`,
				{
					responseType: 'blob',
				}
			);

			const mime = content.mime_type ?? undefined;
			const blob = new Blob([response.data], { type: mime });
			const fileFromContent = new File([blob], content.name, {
				type: mime,
			});

			const validationResult = validateAudioFile(fileFromContent);
			onFileSelect(fileFromContent, validationResult);
			setShowContentPicker(false);
		},
		[onFileSelect]
	);

	return (
		<section className="space-y-5 rounded-lg border border-slate-700 bg-slate-900/70 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.75)] backdrop-blur">
			<div className="grid grid-cols-2 gap-3">
				<label
					htmlFor="audio-upload-input"
					className="relative block cursor-pointer rounded-lg border-2 border-dashed border-slate-600/80 bg-slate-900/60 p-4 text-center transition-colors hover:border-purple-400/50 hover:bg-slate-800/50"
				>
					<input
						ref={fileInputRef}
						id="audio-upload-input"
						type="file"
						accept=".mp3,.wav,.m4a,.flac,.ogg,.aac,.wma,.mp4,.avi,.mov,.mkv"
						onChange={handleChange}
						className="sr-only"
					/>

					<div className="flex flex-col items-center gap-2">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-600/20 text-purple-300 ring-1 ring-purple-500/40">
							<ArrowUpTrayIcon className="h-5 w-5" />
						</div>
						<div>
							<p className="text-sm font-medium text-slate-50">Загрузить</p>
							<p className="text-xs text-slate-400">с компьютера</p>
						</div>
					</div>
				</label>

				<button
					type="button"
					className="relative cursor-pointer rounded-lg border-2 border-dashed border-slate-600/80 bg-slate-900/60 p-4 text-center transition-colors hover:border-emerald-400/50 hover:bg-slate-800/50"
					onClick={() => setShowContentPicker(true)}
					aria-label="Выбрать из библиотеки"
				>
					<div className="flex flex-col items-center gap-2">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600/20 text-emerald-300 ring-1 ring-emerald-500/40">
							<CircleStackIcon className="h-5 w-5" />
						</div>
						<div>
							<p className="text-sm font-medium text-slate-50">Библиотека</p>
							<p className="text-xs text-slate-400">выбрать файл</p>
						</div>
					</div>
				</button>
			</div>

			<UnifiedContentPickerModal
				open={showContentPicker}
				onClose={() => setShowContentPicker(false)}
				onConfirm={(items) => {
					const content = items[0];
					if (!content) {
						return;
					}
					void loadContentAsFile(content).catch((err) => {
						console.error('Failed to load file from content manager:', err);
					});
				}}
				mode="single"
				maxFiles={1}
				allowedContentTypes={AUDIO_VIDEO_TYPES}
				title="Выберите аудио/видео файл"
				hideTypeFilter
				portalZIndex={DESKTOP_Z_INDEX.STUDIO_MODULE_PORTAL}
			/>

			{file && (
				<div className="flex items-center gap-3 rounded-lg border border-slate-600 bg-slate-800/50 p-3">
					<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600/20 text-purple-300">
						<ArrowUpTrayIcon className="h-4 w-4" />
					</div>
					<div className="flex-1 min-w-0">
						<p className="text-sm font-medium text-slate-50 truncate">
							{file.name}
						</p>
						<p className="text-xs text-slate-400">
							{(file.size / 1024 / 1024).toFixed(2)} MB
						</p>
					</div>
					<button
						type="button"
						onClick={() =>
							onFileSelect(null as unknown as File, {
								valid: false,
								error: undefined,
							})
						}
						className="p-1 text-slate-400 hover:text-red-400 transition-colors"
						aria-label="Удалить файл"
					>
						<XMarkIcon className="h-4 w-4" />
					</button>
				</div>
			)}

			{error && <p className="text-sm text-red-400">{error}</p>}

			{validation?.warnings?.length ? (
				<ul className="text-xs text-yellow-300 space-y-1 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
					{validation.warnings.map((warning) => (
						<li key={warning}>{warning}</li>
					))}
				</ul>
			) : null}

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<FieldSelect
					id="language-select"
					label="Язык"
					value={selectedLanguage}
					options={LANGUAGE_OPTIONS}
					onChange={onLanguageChange}
				/>
				<FieldSelect
					id="model-select"
					label="Модель"
					value={selectedModel}
					options={WHISPER_MODELS}
					onChange={onModelChange}
				/>
			</div>

			<button
				type="button"
				onClick={onTranscribe}
				disabled={!file || loading || Boolean(validation && !validation.valid)}
				className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-purple-900/40 transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{loading ? 'Транскрибация…' : 'Запустить транскрибацию'}
			</button>
		</section>
	);
}

interface FieldSelectProps {
	readonly id: string;
	readonly label: string;
	readonly value: string;
	readonly options: readonly SelectOption[];
	readonly onChange: (value: string) => void;
}

function FieldSelect({
	id,
	label,
	value,
	options,
	onChange,
}: FieldSelectProps) {
	return (
		<label htmlFor={id} className="text-left space-y-1">
			<span className="text-xs uppercase tracking-wide text-slate-400">
				{label}
			</span>
			<select
				id={id}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="w-full bg-slate-900/70 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
			>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</label>
	);
}
