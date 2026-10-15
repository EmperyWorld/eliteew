/**
 * TwoFactorSetup Component
 * Complete 2FA setup and management
 */

import { useState } from 'react';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	CheckCircleIcon,
	CheckIcon,
	DevicePhoneMobileIcon,
	DocumentDuplicateIcon,
	ExclamationCircleIcon,
	KeyIcon,
	ShieldCheckIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import type { Enable2FAResponse } from '../../types/profile';
import profileService from '../../services/profileService';
import { log } from '../../utils/logger';
import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';

interface TwoFactorSetupProps {
	isEnabled: boolean;
	onClose: () => void;
	onSuccess: () => void;
}

export default function TwoFactorSetup({
	isEnabled,
	onClose,
	onSuccess,
}: TwoFactorSetupProps): JSX.Element {
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const [step, setStep] = useState<'confirm' | 'setup' | 'verify' | 'backup'>(
		'confirm'
	);
	const [setupData, setSetupData] = useState<Enable2FAResponse | null>(null);
	const [verificationCode, setVerificationCode] = useState('');
	const [disablePassword, setDisablePassword] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [copiedSecret, setCopiedSecret] = useState(false);
	const [downloadedBackupCodes, setDownloadedBackupCodes] = useState(false);

	// Enable 2FA
	const handleEnable2FA = async (): Promise<void> => {
		setIsLoading(true);
		setError(null);

		try {
			const data = await profileService.enable2FA();
			setSetupData(data);
			setStep('setup');
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error(String(err));
			log.error('TwoFactorSetup', 'Failed to enable 2FA', error);
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
					: 'Не удалось включить 2FA';
			setError(errorMessage);
		} finally {
			setIsLoading(false);
		}
	};

	// Verify 2FA
	const handleVerify2FA = async (): Promise<void> => {
		if (verificationCode?.length !== 6) {
			setError('Введите 6-значный код');
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			await profileService.verify2FA(verificationCode);
			setStep('backup');
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error(String(err));
			log.error('TwoFactorSetup', 'Failed to verify 2FA', error);
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
					: 'Неверный код подтверждения';
			setError(errorMessage);
		} finally {
			setIsLoading(false);
		}
	};

	// Disable 2FA
	const handleDisable2FA = async (): Promise<void> => {
		if (!disablePassword) {
			setError('Введите пароль');
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			await profileService.disable2FA(disablePassword);
			onSuccess();
			onClose();
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error(String(err));
			log.error('TwoFactorSetup', 'Failed to disable 2FA', error);
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
					: 'Не удалось отключить 2FA';
			setError(errorMessage);
		} finally {
			setIsLoading(false);
		}
	};

	// DocumentDuplicateIcon secret to clipboard
	const handleCopySecret = async (): Promise<void> => {
		if (!setupData?.secret) {
			return;
		}

		try {
			await navigator.clipboard.writeText(setupData.secret);
			setCopiedSecret(true);
			setTimeout(() => setCopiedSecret(false), 3000);
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error(String(err));
			log.error('TwoFactorSetup', 'Failed to copy secret', error);
		}
	};

	// ArrowDownTrayIcon backup codes
	const handleDownloadBackupCodes = (): void => {
		if (!setupData?.backup_codes) {
			return;
		}

		const content = `# Резервные коды 2FA\n# Сохраните их в безопасном месте!\n# Каждый код можно использовать только один раз\n\n${setupData.backup_codes.join('\n')}`;
		const blob = new Blob([content], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `2fa-backup-codes-${Date.now()}.txt`;
		a.click();
		URL.revokeObjectURL(url);

		setDownloadedBackupCodes(true);
	};

	// Complete setup
	const handleComplete = (): void => {
		onSuccess();
		onClose();
	};

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-6"
			style={{ zIndex: embeddedModalZ.backdrop }}
			onClick={onClose}
		>
			<motion.div
				initial={{ opacity: 0, scale: 0.9 }}
				animate={{ opacity: 1, scale: 1 }}
				exit={{ opacity: 0, scale: 0.9 }}
				onClick={(e) => e.stopPropagation()}
				className="bg-slate-900 border border-white/10 rounded-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
				style={{ zIndex: embeddedModalZ.content }}
			>
				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<div className="flex items-center gap-3">
						<ShieldCheckIcon className="w-6 h-6 text-blue-400" />
						<h2 className="text-2xl font-bold text-white">
							{isEnabled
								? 'Отключить 2FA'
								: 'Настройка двухфакторной аутентификации'}
						</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="text-white/60 hover:text-white transition-colors"
					>
						<XMarkIcon className="w-6 h-6" />
					</button>
				</div>

				{/* Error banner */}
				<AnimatePresence>
					{error && (
						<motion.div
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -10 }}
							className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-center gap-3 mb-6"
						>
							<ExclamationCircleIcon className="w-5 h-5 text-red-400 shrink-0" />
							<p className="text-red-400 flex-1">{error}</p>
							<button
								type="button"
								onClick={() => setError(null)}
								className="text-red-400 hover:text-red-300 transition-colors"
							>
								<XMarkIcon className="w-5 h-5" />
							</button>
						</motion.div>
					)}
				</AnimatePresence>

				{/* Disable 2FA */}
				{isEnabled ? (
					<div className="space-y-6">
						<div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 flex items-start gap-3">
							<ExclamationCircleIcon className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
							<div>
								<p className="text-yellow-400 font-medium mb-1">
									Предупреждение
								</p>
								<p className="text-yellow-400/80 text-sm">
									Отключение двухфакторной аутентификации снизит уровень
									безопасности вашего аккаунта. Для подтверждения введите ваш
									пароль.
								</p>
							</div>
						</div>

						<div>
							<label
								htmlFor="twofa-disable-password"
								className="block text-sm font-medium text-white/80 mb-2"
							>
								Подтвердите пароль
							</label>
							<input
								id="twofa-disable-password"
								type="password"
								value={disablePassword}
								onChange={(e) => setDisablePassword(e.target.value)}
								placeholder="Введите ваш пароль"
								className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-hidden focus:border-blue-500/50 transition-colors"
							/>
						</div>

						<div className="flex gap-3">
							<button
								type="button"
								onClick={onClose}
								className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg transition-all"
							>
								Отмена
							</button>
							<button
								type="button"
								onClick={handleDisable2FA}
								disabled={!disablePassword || isLoading}
								className="flex-1 px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
							>
								{isLoading ? (
									<>
										<ArrowPathIcon className="w-5 h-5 animate-spin" />
										Отключение...
									</>
								) : (
									<>
										<ShieldCheckIcon className="w-5 h-5" />
										Отключить 2FA
									</>
								)}
							</button>
						</div>
					</div>
				) : (
					// Enable 2FA flow
					<>
						{step === 'confirm' && (
							<div className="space-y-6">
								<div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-6">
									<h3 className="text-lg font-bold text-white mb-3">
										Что такое двухфакторная аутентификация?
									</h3>
									<p className="text-white/80 mb-4">
										2FA добавляет дополнительный уровень защиты вашего аккаунта.
										После включения, помимо пароля, вам потребуется вводить
										временный код из приложения-аутентификатора.
									</p>
									<ul className="space-y-2">
										<li className="flex items-start gap-3 text-white/80">
											<CheckCircleIcon className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
											<span>Защита от несанкционированного доступа</span>
										</li>
										<li className="flex items-start gap-3 text-white/80">
											<CheckCircleIcon className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
											<span>Работает даже при компрометации пароля</span>
										</li>
										<li className="flex items-start gap-3 text-white/80">
											<CheckCircleIcon className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
											<span>Резервные коды на случай потери телефона</span>
										</li>
									</ul>
								</div>

								<div className="bg-white/5 border border-white/10 rounded-lg p-6">
									<h3 className="text-lg font-bold text-white mb-3">
										Что вам понадобится:
									</h3>
									<ul className="space-y-2">
										<li className="flex items-center gap-3 text-white/80">
											<DevicePhoneMobileIcon className="w-5 h-5 text-blue-400" />
											<span>
												Приложение-аутентификатор (Google Authenticator, Authy,
												или аналогичное)
											</span>
										</li>
										<li className="flex items-center gap-3 text-white/80">
											<ArrowDownTrayIcon className="w-5 h-5 text-blue-400" />
											<span>Возможность сохранить резервные коды</span>
										</li>
									</ul>
								</div>

								<div className="flex gap-3">
									<button
										type="button"
										onClick={onClose}
										className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg transition-all"
									>
										Отмена
									</button>
									<button
										type="button"
										onClick={handleEnable2FA}
										disabled={isLoading}
										className="flex-1 px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/50 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
									>
										{isLoading ? (
											<>
												<ArrowPathIcon className="w-5 h-5 animate-spin" />
												Подготовка...
											</>
										) : (
											<>
												<ShieldCheckIcon className="w-5 h-5" />
												Начать настройку
											</>
										)}
									</button>
								</div>
							</div>
						)}

						{step === 'setup' && setupData && (
							<div className="space-y-6">
								<div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-6">
									<h3 className="text-lg font-bold text-white mb-4">
										Шаг 1: Сканируйте QR-код
									</h3>

									<div className="bg-white p-6 rounded-lg mb-4 flex items-center justify-center">
										<img
											src={setupData.qr_code_url}
											alt="QR Code"
											className="w-64 h-64"
										/>
									</div>

									<p className="text-white/80 mb-4">
										Откройте приложение-аутентификатор и отсканируйте этот
										QR-код.
									</p>

									<div className="bg-white/5 border border-white/10 rounded-lg p-4">
										<p className="text-white/60 text-sm mb-2">
											Или введите код вручную:
										</p>
										<div className="flex items-center gap-2">
											<code className="flex-1 bg-black/30 rounded-sm px-3 py-2 text-white font-mono text-sm break-all">
												{setupData.secret}
											</code>
											<button
												type="button"
												onClick={handleCopySecret}
												className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 rounded-lg transition-all flex items-center gap-2"
											>
												{copiedSecret ? (
													<>
														<CheckIcon className="w-4 h-4 text-green-400" />
														<span className="text-green-400">Скопировано</span>
													</>
												) : (
													<>
														<DocumentDuplicateIcon className="w-4 h-4" />
														<span>Копировать</span>
													</>
												)}
											</button>
										</div>
									</div>
								</div>

								<button
									type="button"
									onClick={() => setStep('verify')}
									className="w-full px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/50 rounded-lg transition-all"
								>
									Продолжить к подтверждению
								</button>
							</div>
						)}

						{step === 'verify' && (
							<div className="space-y-6">
								<div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-6">
									<h3 className="text-lg font-bold text-white mb-4">
										Шаг 2: Подтвердите настройку
									</h3>
									<p className="text-white/80 mb-4">
										Введите 6-значный код из вашего приложения-аутентификатора:
									</p>

									<input
										type="text"
										value={verificationCode}
										onChange={(e) =>
											setVerificationCode(
												e.target.value.replace(/\D/g, '').slice(0, 6)
											)
										}
										placeholder="000000"
										maxLength={6}
										className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-lg text-white text-center text-2xl font-mono placeholder:text-white/40 focus:outline-hidden focus:border-blue-500/50 transition-colors"
									/>
								</div>

								<div className="flex gap-3">
									<button
										type="button"
										onClick={() => setStep('setup')}
										disabled={isLoading}
										className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg transition-all"
									>
										Назад
									</button>
									<button
										type="button"
										onClick={handleVerify2FA}
										disabled={verificationCode.length !== 6 || isLoading}
										className="flex-1 px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/50 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
									>
										{isLoading ? (
											<>
												<ArrowPathIcon className="w-5 h-5 animate-spin" />
												Проверка...
											</>
										) : (
											<>
												<CheckIcon className="w-5 h-5" />
												Подтвердить
											</>
										)}
									</button>
								</div>
							</div>
						)}

						{step === 'backup' && setupData && (
							<div className="space-y-6">
								<div className="bg-green-500/10 border border-green-500/50 rounded-lg p-6">
									<div className="flex items-center gap-3 mb-4">
										<CheckCircleIcon className="w-6 h-6 text-green-400" />
										<h3 className="text-lg font-bold text-white">
											2FA успешно включена!
										</h3>
									</div>
									<p className="text-white/80">
										Теперь сохраните резервные коды на случай потери доступа к
										приложению.
									</p>
								</div>

								<div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-6">
									<div className="flex items-start gap-3 mb-4">
										<KeyIcon className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
										<div>
											<h4 className="text-white font-bold mb-2">
												Резервные коды
											</h4>
											<p className="text-yellow-400/80 text-sm mb-4">
												Каждый код можно использовать только один раз. Сохраните
												их в надежном месте!
											</p>
										</div>
									</div>

									<div className="bg-black/30 rounded-lg p-4 mb-4">
										<div className="grid grid-cols-2 gap-2">
											{setupData.backup_codes.map((code) => (
												<code
													key={code}
													className="text-white font-mono text-sm"
												>
													{code}
												</code>
											))}
										</div>
									</div>

									<button
										type="button"
										onClick={handleDownloadBackupCodes}
										className="w-full px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg transition-all flex items-center justify-center gap-2"
									>
										<ArrowDownTrayIcon className="w-5 h-5" />
										Скачать резервные коды
									</button>
								</div>

								<button
									type="button"
									onClick={handleComplete}
									disabled={!downloadedBackupCodes}
									className="w-full px-6 py-3 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/50 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
								>
									<CheckIcon className="w-5 h-5" />
									{downloadedBackupCodes
										? 'Завершить настройку'
										: 'Сначала скачайте резервные коды'}
								</button>
							</div>
						)}
					</>
				)}
			</motion.div>
		</motion.div>
	);
}
