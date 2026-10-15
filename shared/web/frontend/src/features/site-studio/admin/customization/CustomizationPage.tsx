import { Button } from '@components/atoms/Button';
import { Card } from '@components/atoms/Card';
import { themePresets, type ThemeId } from '@constants/themePresets';
import { useSiteSettingsStore } from '@store/slices/siteSettingsSlice';
import clsx from 'clsx';
import * as React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
	ArrowDownTrayIcon,
	ArrowUturnLeftIcon,
	CheckIcon,
	SwatchIcon,
} from '@heroicons/react/24/outline';

function assignDomCssVars(
	el: HTMLElement | null,
	props: Record<string, string | undefined>
) {
	if (!el) return;
	for (const [key, value] of Object.entries(props)) {
		if (value !== undefined && value !== '') el.style.setProperty(key, value);
		else el.style.removeProperty(key);
	}
}

function ThemePreviewSwatch({ preview }: { preview: string }) {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		assignDomCssVars(ref.current, { background: preview });
	}, [preview]);
	return <div ref={ref} className="w-full h-16 rounded-lg mb-3" />;
}

function ThemeAdminPreview({ selectedTheme }: { selectedTheme: ThemeId }) {
	const outerRef = useRef<HTMLDivElement>(null);
	const cardRef = useRef<HTMLDivElement>(null);
	const headingRef = useRef<HTMLHeadingElement>(null);
	const bodyRef = useRef<HTMLParagraphElement>(null);

	useLayoutEffect(() => {
		const preset = themePresets.find((t) => t.id === selectedTheme);
		const v = preset?.variables;
		assignDomCssVars(outerRef.current, {
			background: v?.['--gradient-app'] ?? '#fff',
		});
		assignDomCssVars(cardRef.current, {
			background: v?.['--theme-card-surface'] ?? 'white',
			borderColor: v?.['--theme-card-border'] ?? '#e5e5e5',
			borderWidth: '1px',
			borderStyle: 'solid',
		});
		assignDomCssVars(headingRef.current, {
			color: v?.['--theme-heading-color'] ?? '#000',
		});
		assignDomCssVars(bodyRef.current, {
			color: v?.['--theme-body-text'] ?? '#666',
		});
	}, [selectedTheme]);

	return (
		<div ref={outerRef} className="p-6 rounded-xl border dark:border-slate-600">
			<div className="max-w-md mx-auto space-y-4">
				<div ref={cardRef} className="p-4 rounded-xl backdrop-blur-sm">
					<h3 ref={headingRef} className="font-semibold mb-2">
						Пример карточки
					</h3>
					<p ref={bodyRef} className="text-sm">
						Так будет выглядеть контент на сайте с выбранной темой.
					</p>
				</div>
			</div>
		</div>
	);
}

export const CustomizationPage: React.FC = () => {
	const siteSettings = useSiteSettingsStore((state) => state.siteSettings);
	const updateSiteSettings = useSiteSettingsStore(
		(state) => state.updateSiteSettings
	);
	const [selectedTheme, setSelectedTheme] = useState<ThemeId>(
		(siteSettings?.defaultTheme as ThemeId) || 'verdant-aurora'
	);
	const [isSaving, setIsSaving] = useState(false);
	const [message, setMessage] = useState<{
		type: 'success' | 'error';
		text: string;
	} | null>(null);

	useEffect(() => {
		if (siteSettings?.defaultTheme) {
			setSelectedTheme(siteSettings.defaultTheme as ThemeId);
		}
	}, [siteSettings]);

	const handleSave = async () => {
		setIsSaving(true);
		setMessage(null);
		try {
			await updateSiteSettings({
				defaultTheme: selectedTheme,
			});
			setMessage({
				type: 'success',
				text: 'Тема сохранена! Новые пользователи увидят эту тему по умолчанию.',
			});
		} catch {
			setMessage({ type: 'error', text: 'Ошибка сохранения темы' });
		} finally {
			setIsSaving(false);
		}
	};

	const handleReset = () => {
		setSelectedTheme('verdant-aurora');
	};

	const savedThemeId =
		(siteSettings?.defaultTheme as ThemeId | undefined) || 'verdant-aurora';
	const savedPreset = themePresets.find((t) => t.id === savedThemeId);
	const selectedPreset = themePresets.find((t) => t.id === selectedTheme);
	const previewShowsUnsavedDraft = selectedTheme !== savedThemeId;

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-display font-semibold text-neutral-900 dark:text-white">
						Кастомизация
					</h1>
					<p className="text-neutral-500 dark:text-slate-400 text-sm mt-1">
						Настройка внешнего вида сайта для всех посетителей
					</p>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" size="sm" onClick={handleReset}>
						<ArrowUturnLeftIcon width={16} height={16} className="mr-1" />
						Сбросить
					</Button>
					<Button size="sm" onClick={handleSave} disabled={isSaving}>
						<ArrowDownTrayIcon width={16} height={16} className="mr-1" />
						{isSaving ? 'Сохранение...' : 'Сохранить'}
					</Button>
				</div>
			</div>

			{message && (
				<div
					className={clsx(
						'p-4 rounded-xl text-sm',
						message.type === 'success'
							? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-200'
							: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200'
					)}
				>
					{message.text}
				</div>
			)}

			{previewShowsUnsavedDraft && (
				<div
					role="status"
					className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100"
				>
					<p className="font-medium">Предпросмотр ниже — черновик</p>
					<p className="mt-1 text-amber-900/90 dark:text-amber-200/90">
						Сейчас выбрана тема «{selectedPreset?.name ?? selectedTheme}». На
						сайте у новых посетителей по умолчанию действует «
						{savedPreset?.name ?? savedThemeId}», пока не нажмёте «Сохранить».
						Блок «Предпросмотр» показывает только выбранную тему, без записи в
						настройки.
					</p>
				</div>
			)}

			<Card className="p-6">
				<div className="flex items-center gap-3 mb-6">
					<div className="p-2 bg-primary-100 rounded-xl">
						<SwatchIcon width={24} height={24} className="text-primary-600" />
					</div>
					<div>
						<h2 className="text-lg font-semibold text-neutral-900">
							Тема по умолчанию
						</h2>
						<p className="text-sm text-neutral-500">
							Выберите тему, которую увидят все новые посетители сайта
						</p>
					</div>
				</div>

				<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
					{themePresets.map((theme) => (
						<button
							key={theme.id}
							type="button"
							onClick={() => setSelectedTheme(theme.id as ThemeId)}
							className={clsx(
								'relative p-4 rounded-xl border-2 transition-[border-color,background-color,box-shadow] duration-200 text-left',
								selectedTheme === theme.id
									? 'border-primary-500 bg-primary-50'
									: 'border-neutral-200 hover:border-neutral-300 bg-white'
							)}
						>
							{selectedTheme === theme.id && (
								<div className="absolute top-2 right-2 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
									<CheckIcon width={12} height={12} className="text-white" />
								</div>
							)}
							<ThemePreviewSwatch preview={theme.preview} />
							<h3 className="font-medium text-neutral-900 text-sm">
								{theme.name}
							</h3>
							<p className="text-xs text-neutral-500 mt-1 line-clamp-2">
								{theme.description}
							</p>
						</button>
					))}
				</div>
			</Card>

			<Card className="p-6 dark:bg-slate-800 dark:border-slate-700">
				<h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">
					Предпросмотр
				</h2>
				<p className="text-sm text-neutral-500 dark:text-slate-400 mb-4">
					Как могут смотреться фон и карточка на витрине с выбранной темой
					(локально в админке, до сохранения).
				</p>
				<ThemeAdminPreview selectedTheme={selectedTheme} />
			</Card>

			<Card className="p-6 bg-amber-50 border-amber-200">
				<h3 className="font-semibold text-amber-800 mb-2">
					💡 Как это работает
				</h3>
				<ul className="text-sm text-amber-700 space-y-1">
					<li>
						• Выбранная тема будет применяться для всех новых посетителей сайта
					</li>
					<li>• Пользователи могут переключить тему через виджет на сайте</li>
					<li>• Их выбор сохраняется в браузере и имеет приоритет</li>
					<li>
						• При очистке кэша браузера снова применится тема по умолчанию
					</li>
				</ul>
			</Card>
		</div>
	);
};
