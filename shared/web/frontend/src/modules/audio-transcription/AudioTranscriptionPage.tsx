import { useCallback, useState } from 'react';
import { MicrophoneIcon } from '@heroicons/react/24/outline';
import { FileUploadArea } from './components/FileUploadArea';
import { TranscriptionResult } from './components/TranscriptionResult';
import { useAudioTranscription } from './hooks/useAudioTranscription';
import type { FileValidationResult } from './lib/audioTranscription.validators';

export function AudioTranscriptionPage() {
	const { transcribe, loading, error, result } = useAudioTranscription();
	const [file, setFile] = useState<File | null>(null);
	const [validation, setValidation] = useState<FileValidationResult | null>(
		null
	);
	const [selectedLanguage, setSelectedLanguage] = useState<string>('auto');
	const [selectedModel, setSelectedModel] = useState<string>('large-v3');

	const handleFileSelect = useCallback(
		(selectedFile: File, validationResult: FileValidationResult) => {
			setFile(selectedFile);
			setValidation(validationResult);
		},
		[]
	);

	const handleTranscribe = useCallback(async () => {
		if (!file) {
			return;
		}
		if (validation && !validation.valid) {
			// Не запускаем транскрибацию, если файл не прошёл валидацию
			return;
		}

		await transcribe(file, {
			language: selectedLanguage,
			model: selectedModel,
		});
	}, [file, validation, selectedLanguage, selectedModel, transcribe]);

	const fileError =
		validation && !validation.valid
			? (validation.error ?? 'Неверный файл')
			: error;

	return (
		<div className="min-h-screen bg-linear-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-50">
			<main className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 lg:px-6 lg:py-12">
				<header className="mb-8 space-y-4">
					<div className="flex items-center justify-between gap-4">
						<div className="space-y-3">
							<div className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1 text-[11px] font-medium text-slate-300">
								<span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
								<span>UGS · транскрипция · диаризация спикеров</span>
							</div>

							<div className="flex items-center gap-3">
								<div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-purple-600/20 text-purple-300 ring-1 ring-purple-500/40">
									<MicrophoneIcon className="h-4 w-4" />
								</div>
								<div className="space-y-1">
									<h1 className="text-xl font-semibold sm:text-2xl">
										Транскрибация аудио с разделением по спикерам
									</h1>
									<p className="text-xs text-slate-400 sm:text-sm">
										Загрузите аудио или видео и получите аккуратный текст с
										выделенными спикерами и готовыми форматами для экспорта.
									</p>
								</div>
							</div>
						</div>
					</div>
				</header>

				<section className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)] lg:gap-7">
					<FileUploadArea
						file={file}
						onFileSelect={handleFileSelect}
						onTranscribe={handleTranscribe}
						loading={loading}
						error={fileError ?? null}
						validation={validation}
						selectedLanguage={selectedLanguage}
						selectedModel={selectedModel}
						onLanguageChange={setSelectedLanguage}
						onModelChange={setSelectedModel}
					/>

					<TranscriptionResult
						result={result}
						loading={loading}
						fileName={file ? file.name : null}
					/>
				</section>
			</main>
		</div>
	);
}
