/**
 * PreferencesSettings Component
 * Language, theme, notifications, privacy, UI, accessibility
 */

import * as React from 'react';
import { useState, type JSX } from 'react';
import { motion } from 'framer-motion';
import {
	type UserPreferences,
	type UserPreferencesUpdate,
	type Language,
	type ProfileVisibility,
	type EmailFrequency,
	LANGUAGE_LABELS,
} from '../../types/profile';
import profileService from '../../services/profileService';
import {
	updateDesktopConfig,
	toApiTheme,
} from '../../pages/Desktop/services/desktopApi';
import { useUserPreferencesApp } from '../../contexts/UserPreferencesAppContext';
import { log } from '../../utils/logger';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	BellIcon,
	ChatBubbleLeftRightIcon,
	CheckIcon,
	ComputerDesktopIcon,
	DevicePhoneMobileIcon,
	EnvelopeIcon,
	ExclamationCircleIcon,
	EyeIcon,
	GlobeAltIcon,
	LockClosedIcon,
	MoonIcon,
	Squares2X2Icon,
	SunIcon,
	SwatchIcon,
} from '@heroicons/react/24/outline';

interface PreferencesSettingsProps {
	preferences: UserPreferences;
	onPreferencesUpdate: (preferences: UserPreferences) => void;
}

export default function PreferencesSettings({
	preferences,
	onPreferencesUpdate,
}: PreferencesSettingsProps): JSX.Element {
	const [localPrefs, setLocalPrefs] = useState<UserPreferences>(preferences);
	const [isSaving, setIsSaving] = useState(false);
	const [saveSuccess, setSaveSuccess] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const preferencesApp = useUserPreferencesApp();

	const hasChanges = JSON.stringify(localPrefs) !== JSON.stringify(preferences);

	const handleSave = async (): Promise<void> => {
		setIsSaving(true);
		setError(null);
		setSaveSuccess(false);

		try {
			const updateData: UserPreferencesUpdate = {
				language: localPrefs.language,
				theme: localPrefs.theme,
				notifications: localPrefs.notifications,
				privacy: localPrefs.privacy,
				ui: localPrefs.ui,
				accessibility: localPrefs.accessibility,
			};

			const updatedPrefs = await profileService.updatePreferences(updateData);
			onPreferencesUpdate(updatedPrefs);
			setLocalPrefs(updatedPrefs);
			setSaveSuccess(true);
			// Sync theme to desktop config so Desktop and Profile stay in sync
			if (
				updatedPrefs.theme &&
				['dark', 'light', 'auto'].includes(updatedPrefs.theme)
			) {
				updateDesktopConfig({ theme: toApiTheme(updatedPrefs.theme) }).catch(
					() => {}
				);
			}
			// Apply server response (no extra GET)
			preferencesApp?.refresh?.(updatedPrefs);
			setTimeout(() => setSaveSuccess(false), 3000);
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error(String(err));
			log.error('PreferencesSettings', 'Failed to update preferences', error);
			const errorMessage =
				err &&
				typeof err === 'object' &&
				'response' in err &&
				err.response &&
				typeof err.response === 'object' &&
				'data' in err.response &&
				err.response.data &&
				typeof err.response.data === 'object' &&
				'message' in err.response.data &&
				typeof err.response.data.message === 'string'
					? err.response.data.message
					: 'Не удалось сохранить настройки';
			setError(errorMessage);
		} finally {
			setIsSaving(false);
		}
	};

	const handleReset = (): void => {
		setLocalPrefs(preferences);
		setError(null);
	};

	return (
		<div className="space-y-6">
			{/* Error banner */}
			{error && (
				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-center gap-3"
				>
					<ExclamationCircleIcon className="w-5 h-5 text-red-400 shrink-0" />
					<p className="text-red-400 flex-1">{error}</p>
				</motion.div>
			)}

			{/* Language Section */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6"
			>
				<div className="flex items-center gap-3 mb-6">
					<GlobeAltIcon className="w-5 h-5 text-blue-400" />
					<h2 className="text-xl font-bold text-white">Язык интерфейса</h2>
				</div>
				<p className="text-sm text-white/50 mb-4">
					Скоро: переключение языка интерфейса будет применяться по всему
					приложению. Сейчас выбор сохраняется в профиле.
				</p>

				<div className="grid grid-cols-2 gap-3">
					{Object.entries(LANGUAGE_LABELS).map(([code, { label, flag }]) => (
						<button
							type="button"
							key={code}
							onClick={() =>
								setLocalPrefs({ ...localPrefs, language: code as Language })
							}
							className={`p-4 rounded-lg border transition-all ${
								localPrefs.language === code
									? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
									: 'bg-white/5 border-white/10 text-white/80 hover:border-white/20'
							}`}
						>
							<span className="text-2xl mr-2">{flag}</span>
							{label}
						</button>
					))}
				</div>
			</motion.div>

			{/* Theme Section */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.05 }}
				className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6"
			>
				<div className="flex items-center gap-3 mb-6">
					<SwatchIcon className="w-5 h-5 text-blue-400" />
					<h2 className="text-xl font-bold text-white">Тема оформления</h2>
				</div>

				<div className="grid grid-cols-3 gap-3">
					<button
						type="button"
						onClick={() => setLocalPrefs({ ...localPrefs, theme: 'light' })}
						className={`p-4 rounded-lg border transition-all ${
							localPrefs.theme === 'light'
								? 'bg-blue-500/20 border-blue-500/50'
								: 'bg-white/5 border-white/10 hover:border-white/20'
						}`}
					>
						<SunIcon className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
						<p className="text-white text-sm">Светлая</p>
					</button>

					<button
						type="button"
						onClick={() => setLocalPrefs({ ...localPrefs, theme: 'dark' })}
						className={`p-4 rounded-lg border transition-all ${
							localPrefs.theme === 'dark'
								? 'bg-blue-500/20 border-blue-500/50'
								: 'bg-white/5 border-white/10 hover:border-white/20'
						}`}
					>
						<MoonIcon className="w-6 h-6 text-blue-400 mx-auto mb-2" />
						<p className="text-white text-sm">Темная</p>
					</button>

					<button
						type="button"
						onClick={() => setLocalPrefs({ ...localPrefs, theme: 'auto' })}
						className={`p-4 rounded-lg border transition-all ${
							localPrefs.theme === 'auto'
								? 'bg-blue-500/20 border-blue-500/50'
								: 'bg-white/5 border-white/10 hover:border-white/20'
						}`}
					>
						<ComputerDesktopIcon className="w-6 h-6 text-purple-400 mx-auto mb-2" />
						<p className="text-white text-sm">Авто</p>
					</button>
				</div>
			</motion.div>

			{/* Notifications Section */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.1 }}
				className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6"
			>
				<div className="flex items-center gap-3 mb-6">
					<BellIcon className="w-5 h-5 text-blue-400" />
					<h2 className="text-xl font-bold text-white">Уведомления</h2>
				</div>
				<p className="text-sm text-white/60 mb-4">
					Настройки сохраняются и будут учитываться при рассылке уведомлений
					(email, push, в приложении).
				</p>

				<div className="space-y-6">
					{/* Notification channels */}
					<div className="space-y-3">
						<h3 className="text-sm font-medium text-white/80 mb-3">
							Каналы уведомлений
						</h3>

						<ToggleRow
							icon={<EnvelopeIcon className="w-5 h-5" />}
							label="Email уведомления"
							checked={localPrefs.notifications.email}
							onChange={(checked) =>
								setLocalPrefs({
									...localPrefs,
									notifications: {
										...localPrefs.notifications,
										email: checked,
									},
								})
							}
						/>

						<ToggleRow
							icon={<DevicePhoneMobileIcon className="w-5 h-5" />}
							label="Push уведомления"
							checked={localPrefs.notifications.push}
							onChange={(checked) =>
								setLocalPrefs({
									...localPrefs,
									notifications: { ...localPrefs.notifications, push: checked },
								})
							}
						/>

						<ToggleRow
							icon={<ChatBubbleLeftRightIcon className="w-5 h-5" />}
							label="Уведомления в приложении"
							checked={localPrefs.notifications.in_app}
							onChange={(checked) =>
								setLocalPrefs({
									...localPrefs,
									notifications: {
										...localPrefs.notifications,
										in_app: checked,
									},
								})
							}
						/>

						<ToggleRow
							icon={<ComputerDesktopIcon className="w-5 h-5" />}
							label="Desktop уведомления"
							checked={localPrefs.notifications.desktop}
							onChange={(checked) =>
								setLocalPrefs({
									...localPrefs,
									notifications: {
										...localPrefs.notifications,
										desktop: checked,
									},
								})
							}
						/>
					</div>

					{/* Email frequency */}
					<div>
						<label
							htmlFor="prefs-email-frequency"
							className="block text-sm font-medium text-white/80 mb-2"
						>
							Частота email уведомлений
						</label>
						<select
							id="prefs-email-frequency"
							title="Частота email уведомлений"
							value={localPrefs.notifications.email_frequency}
							onChange={(e) =>
								setLocalPrefs({
									...localPrefs,
									notifications: {
										...localPrefs.notifications,
										email_frequency: e.target.value as EmailFrequency,
									},
								})
							}
							className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-hidden focus:border-blue-500/50 transition-colors"
						>
							<option value="instant">Мгновенно</option>
							<option value="hourly">Каждый час</option>
							<option value="daily">Ежедневно</option>
							<option value="weekly">Еженедельно</option>
							<option value="never">Никогда</option>
						</select>
					</div>

					{/* Notification categories */}
					<div className="space-y-3">
						<h3 className="text-sm font-medium text-white/80 mb-3">
							Категории
						</h3>

						<ToggleRow
							icon={<LockClosedIcon className="w-5 h-5" />}
							label="Безопасность"
							checked={localPrefs.notifications.categories.security}
							onChange={(checked) =>
								setLocalPrefs({
									...localPrefs,
									notifications: {
										...localPrefs.notifications,
										categories: {
											...localPrefs.notifications.categories,
											security: checked,
										},
									},
								})
							}
						/>

						<ToggleRow
							icon={<ExclamationCircleIcon className="w-5 h-5" />}
							label="Обновления системы"
							checked={localPrefs.notifications.categories.updates}
							onChange={(checked) =>
								setLocalPrefs({
									...localPrefs,
									notifications: {
										...localPrefs.notifications,
										categories: {
											...localPrefs.notifications.categories,
											updates: checked,
										},
									},
								})
							}
						/>

						<ToggleRow
							icon={<BellIcon className="w-5 h-5" />}
							label="Маркетинговые"
							checked={localPrefs.notifications.categories.marketing}
							onChange={(checked) =>
								setLocalPrefs({
									...localPrefs,
									notifications: {
										...localPrefs.notifications,
										categories: {
											...localPrefs.notifications.categories,
											marketing: checked,
										},
									},
								})
							}
						/>
					</div>
				</div>
			</motion.div>

			{/* Privacy Section */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.15 }}
				className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6"
			>
				<div className="flex items-center gap-3 mb-6">
					<EyeIcon className="w-5 h-5 text-blue-400" />
					<h2 className="text-xl font-bold text-white">Приватность</h2>
				</div>

				<div className="space-y-6">
					{/* Profile visibility */}
					<div>
						<label
							htmlFor="prefs-profile-visibility"
							className="block text-sm font-medium text-white/80 mb-2"
						>
							Видимость профиля
						</label>
						<select
							id="prefs-profile-visibility"
							title="Видимость профиля"
							value={localPrefs.privacy.profile_visibility}
							onChange={(e) =>
								setLocalPrefs({
									...localPrefs,
									privacy: {
										...localPrefs.privacy,
										profile_visibility: e.target.value as ProfileVisibility,
									},
								})
							}
							className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-hidden focus:border-blue-500/50 transition-colors"
						>
							<option value="public">Публичный</option>
							<option value="private">Приватный</option>
							<option value="friends_only">Только друзья</option>
						</select>
					</div>

					{/* Privacy toggles */}
					<div className="space-y-3">
						<ToggleRow
							label="Показывать email"
							checked={localPrefs.privacy.show_email}
							onChange={(checked) =>
								setLocalPrefs({
									...localPrefs,
									privacy: { ...localPrefs.privacy, show_email: checked },
								})
							}
						/>

						<ToggleRow
							label="Показывать активность"
							checked={localPrefs.privacy.show_activity}
							onChange={(checked) =>
								setLocalPrefs({
									...localPrefs,
									privacy: { ...localPrefs.privacy, show_activity: checked },
								})
							}
						/>

						<ToggleRow
							label="Показывать статистику"
							checked={localPrefs.privacy.show_stats}
							onChange={(checked) =>
								setLocalPrefs({
									...localPrefs,
									privacy: { ...localPrefs.privacy, show_stats: checked },
								})
							}
						/>

						<ToggleRow
							label="Разрешить сообщения"
							checked={localPrefs.privacy.allow_messaging}
							onChange={(checked) =>
								setLocalPrefs({
									...localPrefs,
									privacy: { ...localPrefs.privacy, allow_messaging: checked },
								})
							}
						/>
					</div>
				</div>
			</motion.div>

			{/* UI Preferences Section */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.2 }}
				className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6"
			>
				<div className="flex items-center gap-3 mb-6">
					<Squares2X2Icon className="w-5 h-5 text-blue-400" />
					<h2 className="text-xl font-bold text-white">Интерфейс</h2>
				</div>
				<p className="text-sm text-white/60 mb-4">
					Настройки применяются глобально (компактный режим, анимации) и на
					рабочем столе (боковая панель, вид по умолчанию).
				</p>

				<div className="space-y-3">
					<ToggleRow
						label="Компактный режим"
						checked={localPrefs.ui.compact_mode}
						onChange={(checked) =>
							setLocalPrefs({
								...localPrefs,
								ui: { ...localPrefs.ui, compact_mode: checked },
							})
						}
					/>

					<ToggleRow
						label="Анимации"
						checked={localPrefs.ui.animations_enabled}
						onChange={(checked) =>
							setLocalPrefs({
								...localPrefs,
								ui: { ...localPrefs.ui, animations_enabled: checked },
							})
						}
					/>

					<ToggleRow
						label="Свернуть панель папок (Проводник и Контент)"
						checked={localPrefs.ui.sidebar_collapsed}
						onChange={(checked) =>
							setLocalPrefs({
								...localPrefs,
								ui: { ...localPrefs.ui, sidebar_collapsed: checked },
							})
						}
					/>

					<div>
						<label
							htmlFor="prefs-default-view"
							className="block text-sm font-medium text-white/80 mb-2"
						>
							Вид по умолчанию
						</label>
						<input
							id="prefs-default-view"
							type="text"
							value={localPrefs.ui.default_view}
							onChange={(e) =>
								setLocalPrefs({
									...localPrefs,
									ui: { ...localPrefs.ui, default_view: e.target.value },
								})
							}
							placeholder="dashboard"
							className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-hidden focus:border-blue-500/50 transition-colors"
						/>
					</div>
				</div>
			</motion.div>

			{/* Accessibility Section */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.25 }}
				className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6"
			>
				<div className="flex items-center gap-3 mb-6">
					<EyeIcon className="w-5 h-5 text-blue-400" />
					<h2 className="text-xl font-bold text-white">Доступность</h2>
				</div>
				<p className="text-sm text-white/60 mb-4">
					Настройки применяются глобально (контраст, размер текста, уменьшение
					движения).
				</p>

				<div className="space-y-3">
					<ToggleRow
						label="Высокая контрастность"
						checked={localPrefs.accessibility.high_contrast}
						onChange={(checked) =>
							setLocalPrefs({
								...localPrefs,
								accessibility: {
									...localPrefs.accessibility,
									high_contrast: checked,
								},
							})
						}
					/>

					<ToggleRow
						label="Крупный текст"
						checked={localPrefs.accessibility.large_text}
						onChange={(checked) =>
							setLocalPrefs({
								...localPrefs,
								accessibility: {
									...localPrefs.accessibility,
									large_text: checked,
								},
							})
						}
					/>

					<ToggleRow
						label="Уменьшить движение"
						checked={localPrefs.accessibility.reduce_motion}
						onChange={(checked) =>
							setLocalPrefs({
								...localPrefs,
								accessibility: {
									...localPrefs.accessibility,
									reduce_motion: checked,
								},
							})
						}
					/>

					<ToggleRow
						label="Режим экранного диктора"
						checked={localPrefs.accessibility.screen_reader}
						onChange={(checked) =>
							setLocalPrefs({
								...localPrefs,
								accessibility: {
									...localPrefs.accessibility,
									screen_reader: checked,
								},
							})
						}
					/>
				</div>
			</motion.div>

			{/* Action buttons */}
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.3 }}
				className="flex items-center justify-between bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4"
			>
				<div className="flex items-center gap-2">
					{saveSuccess && (
						<motion.div
							initial={{ opacity: 0, scale: 0.9 }}
							animate={{ opacity: 1, scale: 1 }}
							className="flex items-center gap-2 text-green-400"
						>
							<CheckIcon className="w-5 h-5" />
							<span className="text-sm">Настройки сохранены</span>
						</motion.div>
					)}
				</div>

				<div className="flex gap-2">
					<button
						type="button"
						onClick={handleReset}
						disabled={!hasChanges || isSaving}
						className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Сбросить
					</button>

					<button
						type="button"
						onClick={handleSave}
						disabled={!hasChanges || isSaving}
						className="px-6 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/50 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{isSaving ? (
							<>
								<ArrowPathIcon className="w-4 h-4 animate-spin" />
								Сохранение...
							</>
						) : (
							<>
								<ArrowDownTrayIcon className="w-4 h-4" />
								Сохранить
							</>
						)}
					</button>
				</div>
			</motion.div>
		</div>
	);
}

// ============================================================================
// ToggleRow Component
// ============================================================================

interface ToggleRowProps {
	icon?: React.ReactNode;
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}

function ToggleRow({
	icon,
	label,
	checked,
	onChange,
}: ToggleRowProps): JSX.Element {
	return (
		<div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
			<div className="flex items-center gap-3">
				{icon && <div className="text-white/60">{icon}</div>}
				<span className="text-white">{label}</span>
			</div>

			<button
				type="button"
				title={label}
				onClick={() => onChange(!checked)}
				className={`relative w-12 h-6 rounded-full transition-colors ${
					checked ? 'bg-blue-500' : 'bg-white/20'
				}`}
			>
				<motion.div
					animate={{ x: checked ? 24 : 0 }}
					transition={{ type: 'spring', stiffness: 500, damping: 30 }}
					className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"
				/>
			</button>
		</div>
	);
}
