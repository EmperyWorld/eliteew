/**
 * SecuritySettings Component
 * Password change, active sessions management
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
	SecuritySettings as SecuritySettingsType,
	PasswordChangeData,
	UserSessionInfo,
} from '../../types/profile';
import {
	validatePassword,
	formatDate,
	formatRelativeTime,
} from '../../types/profile';
import { ConfirmDeleteModal } from '../ui/modals/ConfirmDeleteModal';
import TwoFactorSetup from './TwoFactorSetup';
import { APIError } from '../../services/api';
import profileService from '../../services/profileService';
import { log } from '../../utils/logger';
import {
	ArrowPathIcon,
	ArrowRightStartOnRectangleIcon,
	CheckCircleIcon,
	CheckIcon,
	ClockIcon,
	ComputerDesktopIcon,
	DevicePhoneMobileIcon,
	DeviceTabletIcon,
	ExclamationCircleIcon,
	ExclamationTriangleIcon,
	EyeIcon,
	EyeSlashIcon,
	LockClosedIcon,
	MapPinIcon,
	ShieldCheckIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

function getSessionDeviceLabel(session: UserSessionInfo): string {
	const d = session.device_info?.device;
	if (typeof d === 'string' && d.trim()) return d;
	if (typeof d === 'number' || typeof d === 'boolean') return String(d);
	return 'Неизвестное устройство';
}

interface SecuritySettingsProps {
	security: SecuritySettingsType;
	onSecurityUpdate: (security: SecuritySettingsType) => void;
}

export default function SecuritySettings({
	security,
	onSecurityUpdate,
}: SecuritySettingsProps): JSX.Element {
	// Password change state
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [showCurrentPassword, setShowCurrentPassword] = useState(false);
	const [showNewPassword, setShowNewPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [isChangingPassword, setIsChangingPassword] = useState(false);
	const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);

	// Sessions state
	const [sessions, setSessions] = useState<UserSessionInfo[]>([]);
	const [isLoadingSessions, setIsLoadingSessions] = useState(true);
	const [revokingSessionId, setRevokingSessionId] = useState<string | null>(
		null
	);
	const [isRevokingAll, setIsRevokingAll] = useState(false);

	// Error state
	const [error, setError] = useState<string | null>(null);

	// Password validation
	const passwordValidation = newPassword ? validatePassword(newPassword) : null;
	const passwordsMatch =
		newPassword && confirmPassword && newPassword === confirmPassword;
	const canChangePassword =
		currentPassword &&
		newPassword &&
		confirmPassword &&
		passwordValidation?.isValid &&
		passwordsMatch;

	const loadSessions = useCallback(async (): Promise<void> => {
		setIsLoadingSessions(true);
		try {
			const sessionsData = await profileService.getSessions();
			setSessions(sessionsData);
		} catch (err: unknown) {
			const e = err instanceof Error ? err : new Error(String(err));
			log.error('SecuritySettings', 'Failed to load sessions', e);
			setError('Не удалось загрузить список сессий');
		} finally {
			setIsLoadingSessions(false);
		}
	}, []);

	// Load sessions on mount
	useEffect(() => {
		void loadSessions();
	}, [loadSessions]);

	const handleChangePassword = async (): Promise<void> => {
		if (!canChangePassword) {
			return;
		}

		setIsChangingPassword(true);
		setError(null);
		setPasswordChangeSuccess(false);

		try {
			const passwordData: PasswordChangeData = {
				current_password: currentPassword,
				new_password: newPassword,
			};

			await profileService.changePassword(passwordData);

			// Reset form
			setCurrentPassword('');
			setNewPassword('');
			setConfirmPassword('');
			setPasswordChangeSuccess(true);

			// Refresh security settings
			const updatedSecurity = await profileService.getSecuritySettings();
			onSecurityUpdate(updatedSecurity);

			// Reload sessions (all except current will be revoked)
			await loadSessions();

			setTimeout(() => setPasswordChangeSuccess(false), 5000);
		} catch (err: unknown) {
			const e = err instanceof Error ? err : new Error(String(err));
			log.error('SecuritySettings', 'Failed to change password', e);
			let errorMessage = 'Не удалось изменить пароль';
			if (err instanceof APIError) {
				errorMessage = err.message;
			} else if (err && typeof err === 'object' && 'response' in err) {
				const data = (err as { response?: { data?: Record<string, unknown> } })
					.response?.data;
				if (data && typeof data === 'object') {
					const msg = data.error ?? data.detail ?? data.message;
					errorMessage = typeof msg === 'string' ? msg : errorMessage;
				}
			}
			setError(errorMessage);
		} finally {
			setIsChangingPassword(false);
		}
	};

	const [sessionRevokeTargetId, setSessionRevokeTargetId] = useState<
		string | null
	>(null);

	const executeRevokeSession = async (sessionId: string): Promise<void> => {
		setRevokingSessionId(sessionId);
		setError(null);

		try {
			await profileService.revokeSession(sessionId);
			await loadSessions();
		} catch (err: unknown) {
			const e = err instanceof Error ? err : new Error(String(err));
			log.error('SecuritySettings', 'Failed to revoke session', e);
			const errorMessage =
				err instanceof APIError ? err.message : 'Не удалось завершить сессию';
			throw err instanceof Error ? err : new Error(errorMessage);
		} finally {
			setRevokingSessionId(null);
		}
	};

	const [showRevokeAllModal, setShowRevokeAllModal] = useState(false);
	const [show2FASetup, setShow2FASetup] = useState(false);

	const handleRevokeAllSessions = async (): Promise<void> => {
		setIsRevokingAll(true);
		setError(null);

		try {
			await profileService.revokeAllSessions();
			await loadSessions();
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error(String(err));
			log.error('SecuritySettings', 'Failed to revoke all sessions', error);
			setError('Не удалось завершить сессии');
		} finally {
			setIsRevokingAll(false);
		}
	};

	const getDeviceIcon = (userAgent: string | null): JSX.Element => {
		if (!userAgent) {
			return <ComputerDesktopIcon className="w-5 h-5" />;
		}

		const ua = userAgent.toLowerCase();
		if (
			ua.includes('mobile') ||
			ua.includes('android') ||
			ua.includes('iphone')
		) {
			return <DevicePhoneMobileIcon className="w-5 h-5" />;
		}
		if (ua.includes('tablet') || ua.includes('ipad')) {
			return <DeviceTabletIcon className="w-5 h-5" />;
		}
		return <ComputerDesktopIcon className="w-5 h-5" />;
	};

	return (
		<div className="space-y-6">
			{/* Error banner */}
			<AnimatePresence>
				{error && (
					<motion.div
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-center gap-3"
					>
						<ExclamationCircleIcon className="w-5 h-5 text-red-400 shrink-0" />
						<p className="text-red-400 flex-1">{error}</p>
						<button
							type="button"
							onClick={() => setError(null)}
							className="text-red-400 hover:text-red-300 transition-colors"
							aria-label="Закрыть сообщение об ошибке"
							title="Закрыть"
						>
							<XMarkIcon className="w-5 h-5" aria-hidden />
						</button>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Success banner */}
			<AnimatePresence>
				{passwordChangeSuccess && (
					<motion.div
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						className="bg-green-500/10 border border-green-500/50 rounded-xl p-4 flex items-center gap-3"
					>
						<CheckCircleIcon className="w-5 h-5 text-green-400 shrink-0" />
						<p className="text-green-400">
							Пароль успешно изменен. Все сессии обновлены.
						</p>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Security Info */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6"
			>
				<div className="flex items-center gap-3 mb-6">
					<ShieldCheckIcon className="w-5 h-5 text-blue-400" />
					<h2 className="text-xl font-bold text-white">
						Информация о безопасности
					</h2>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div className="bg-white/5 rounded-lg p-4">
						<p className="text-white/60 text-sm mb-1">Последняя смена пароля</p>
						<p className="text-white font-medium">
							{formatDate(security.last_password_change)}
						</p>
					</div>

					<div className="bg-white/5 rounded-lg p-4">
						<p className="text-white/60 text-sm mb-1">Активных сессий</p>
						<p className="text-white font-medium">
							{security.active_sessions_count}
						</p>
						{security.active_sessions_count === 0 && (
							<p className="text-white/40 text-xs mt-1">
								При входе через SSO (OAuth2) сессии могут не отображаться
							</p>
						)}
					</div>

					<div className="bg-white/5 rounded-lg p-4">
						<p className="text-white/60 text-sm mb-1">
							Неудачные попытки входа
						</p>
						<p className="text-white font-medium">
							{security.failed_login_attempts > 0 ? (
								<span className="text-yellow-400">
									{security.failed_login_attempts}
								</span>
							) : (
								'0'
							)}
						</p>
					</div>
				</div>
			</motion.div>

			{/* Change Password */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.05 }}
				className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6"
			>
				<div className="flex items-center gap-3 mb-6">
					<LockClosedIcon className="w-5 h-5 text-blue-400" />
					<h2 className="text-xl font-bold text-white">Смена пароля</h2>
				</div>

				<div className="space-y-4">
					{/* Warning */}
					<div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 flex items-start gap-3">
						<ExclamationTriangleIcon className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
						<div>
							<p className="text-yellow-400 font-medium mb-1">Важно</p>
							<p className="text-yellow-400/80 text-sm">
								После смены пароля все активные сессии будут завершены, кроме
								текущей. Вам потребуется войти снова на всех других устройствах.
							</p>
						</div>
					</div>

					{/* Current password */}
					<div>
						<label
							htmlFor="security-current-password"
							className="block text-sm font-medium text-white/80 mb-2"
						>
							Текущий пароль
						</label>
						<div className="relative">
							<input
								id="security-current-password"
								type={showCurrentPassword ? 'text' : 'password'}
								value={currentPassword}
								onChange={(e) => setCurrentPassword(e.target.value)}
								placeholder="Введите текущий пароль"
								className="w-full px-4 py-2 pr-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-hidden focus:border-blue-500/50 transition-colors"
							/>
							<button
								type="button"
								onClick={() => setShowCurrentPassword(!showCurrentPassword)}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
								aria-label={
									showCurrentPassword ? 'Скрыть пароль' : 'Показать пароль'
								}
							>
								{showCurrentPassword ? (
									<EyeSlashIcon className="w-5 h-5" />
								) : (
									<EyeIcon className="w-5 h-5" />
								)}
							</button>
						</div>
					</div>

					{/* New password */}
					<div>
						<label
							htmlFor="security-new-password"
							className="block text-sm font-medium text-white/80 mb-2"
						>
							Новый пароль
						</label>
						<div className="relative">
							<input
								id="security-new-password"
								type={showNewPassword ? 'text' : 'password'}
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								placeholder="Введите новый пароль"
								className="w-full px-4 py-2 pr-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-hidden focus:border-blue-500/50 transition-colors"
							/>
							<button
								type="button"
								onClick={() => setShowNewPassword(!showNewPassword)}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
								aria-label={
									showNewPassword ? 'Скрыть пароль' : 'Показать пароль'
								}
							>
								{showNewPassword ? (
									<EyeSlashIcon className="w-5 h-5" />
								) : (
									<EyeIcon className="w-5 h-5" />
								)}
							</button>
						</div>

						{/* Password strength meter */}
						{newPassword && passwordValidation && (
							<div className="mt-2">
								<div className="flex gap-1 mb-2">
									{[1, 2, 3, 4, 5].map((level) => (
										<div
											key={level}
											className={`h-1 flex-1 rounded transition-colors ${
												level <= passwordValidation.strength
													? level <= 2
														? 'bg-red-500'
														: level <= 3
															? 'bg-yellow-500'
															: 'bg-green-500'
													: 'bg-white/10'
											}`}
										/>
									))}
								</div>

								<div className="space-y-1">
									{passwordValidation.errors.map((error) => (
										<div
											key={error}
											className="flex items-center gap-2 text-xs text-red-400"
										>
											<XMarkIcon className="w-3 h-3" />
											{error}
										</div>
									))}
									{passwordValidation.isValid && (
										<div className="flex items-center gap-2 text-xs text-green-400">
											<CheckIcon className="w-3 h-3" />
											Пароль соответствует требованиям
										</div>
									)}
								</div>
							</div>
						)}
					</div>

					{/* Confirm password */}
					<div>
						<label
							htmlFor="security-confirm-password"
							className="block text-sm font-medium text-white/80 mb-2"
						>
							Подтверждение пароля
						</label>
						<div className="relative">
							<input
								id="security-confirm-password"
								type={showConfirmPassword ? 'text' : 'password'}
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								placeholder="Повторите новый пароль"
								className="w-full px-4 py-2 pr-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-hidden focus:border-blue-500/50 transition-colors"
							/>
							<button
								type="button"
								onClick={() => setShowConfirmPassword(!showConfirmPassword)}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
								aria-label={
									showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'
								}
							>
								{showConfirmPassword ? (
									<EyeSlashIcon className="w-5 h-5" />
								) : (
									<EyeIcon className="w-5 h-5" />
								)}
							</button>
						</div>

						{confirmPassword && (
							<div className="mt-2">
								{passwordsMatch ? (
									<div className="flex items-center gap-2 text-xs text-green-400">
										<CheckIcon className="w-3 h-3" />
										Пароли совпадают
									</div>
								) : (
									<div className="flex items-center gap-2 text-xs text-red-400">
										<XMarkIcon className="w-3 h-3" />
										Пароли не совпадают
									</div>
								)}
							</div>
						)}
					</div>

					{/* Submit button */}
					<button
						type="button"
						onClick={handleChangePassword}
						disabled={!canChangePassword || isChangingPassword}
						className="w-full px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/50 rounded-lg transition-[background-color,border-color,color,opacity] duration-200 motion-reduce:transition-none flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{isChangingPassword ? (
							<>
								<ArrowPathIcon className="w-5 h-5 animate-spin" />
								Изменение пароля...
							</>
						) : (
							<>
								<LockClosedIcon className="w-5 h-5" />
								Изменить пароль
							</>
						)}
					</button>
				</div>
			</motion.div>

			{/* Active Sessions */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.1 }}
				className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6"
			>
				<div className="flex items-center justify-between mb-6">
					<div className="flex items-center gap-3">
						<ComputerDesktopIcon className="w-5 h-5 text-blue-400" />
						<h2 className="text-xl font-bold text-white">Активные сессии</h2>
					</div>

					{sessions.length > 1 && (
						<button
							type="button"
							onClick={() => setShowRevokeAllModal(true)}
							disabled={isRevokingAll}
							className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded-lg transition-[background-color,border-color,color,opacity] duration-200 motion-reduce:transition-none flex items-center gap-2 disabled:opacity-50"
						>
							{isRevokingAll ? (
								<ArrowPathIcon className="w-4 h-4 animate-spin" />
							) : (
								<ArrowRightStartOnRectangleIcon className="w-4 h-4" />
							)}
							Завершить все сессии
						</button>
					)}
				</div>

				{isLoadingSessions ? (
					<div className="flex items-center justify-center py-12">
						<ArrowPathIcon className="w-8 h-8 text-blue-400 animate-spin" />
					</div>
				) : sessions.length === 0 ? (
					<div className="text-center py-12">
						<ComputerDesktopIcon className="w-12 h-12 text-white/20 mx-auto mb-4" />
						<p className="text-white/60">Нет активных сессий</p>
						<p className="text-white/40 text-sm mt-2 max-w-sm mx-auto">
							При входе через SSO (OAuth2) текущая сессия управляется
							провайдером входа и может не отображаться в этом списке.
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{sessions.map((session) => (
							<div
								key={session.id}
								className={`bg-white/5 border rounded-lg p-4 ${
									session.is_current
										? 'border-blue-500/50 bg-blue-500/5'
										: 'border-white/10'
								}`}
							>
								<div className="flex items-start gap-4">
									<div className="text-white/60 mt-1">
										{getDeviceIcon(session.user_agent)}
									</div>

									<div className="flex-1">
										<div className="flex items-start justify-between mb-2">
											<div>
												<p className="text-white font-medium mb-1">
													{(() => {
														const d = session.device_info?.device;
														if (typeof d === 'string' && d.trim()) return d;
														if (
															typeof d === 'number' ||
															typeof d === 'boolean'
														) {
															return String(d);
														}
														return 'Неизвестное устройство';
													})()}
													{session.is_current && (
														<span className="ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-sm">
															Текущая
														</span>
													)}
												</p>
												<div className="flex items-center gap-4 text-sm text-white/60">
													{session.ip_address && (
														<div className="flex items-center gap-1">
															<MapPinIcon className="w-4 h-4" />
															{session.ip_address}
														</div>
													)}
													<div className="flex items-center gap-1">
														<ClockIcon className="w-4 h-4" />
														{formatRelativeTime(session.last_used_at)}
													</div>
												</div>
											</div>

											{!session.is_current && (
												<button
													type="button"
													onClick={() => setSessionRevokeTargetId(session.id)}
													disabled={revokingSessionId === session.id}
													className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded-lg transition-[background-color,border-color,color,opacity] duration-200 motion-reduce:transition-none flex items-center gap-2 disabled:opacity-50 text-sm"
												>
													{revokingSessionId === session.id ? (
														<ArrowPathIcon className="w-4 h-4 animate-spin" />
													) : (
														<ArrowRightStartOnRectangleIcon className="w-4 h-4" />
													)}
													Завершить
												</button>
											)}
										</div>

										{session.user_agent && (
											<p className="text-xs text-white/40 font-mono">
												{session.user_agent}
											</p>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</motion.div>

			{/* 2FA Setup Modal */}
			<AnimatePresence>
				{show2FASetup && (
					<TwoFactorSetup
						isEnabled={security.two_factor_enabled}
						onClose={() => setShow2FASetup(false)}
						onSuccess={async () => {
							const updatedSecurity =
								await profileService.getSecuritySettings();
							onSecurityUpdate(updatedSecurity);
							setShow2FASetup(false);
						}}
					/>
				)}
			</AnimatePresence>
			{/* Revoke single session */}
			<ConfirmDeleteModal
				isOpen={sessionRevokeTargetId !== null}
				onClose={() => setSessionRevokeTargetId(null)}
				onConfirm={async () => {
					if (!sessionRevokeTargetId) return;
					await executeRevokeSession(sessionRevokeTargetId);
				}}
				title="Завершить сессию?"
				warningMessage={(() => {
					const s = sessions.find((x) => x.id === sessionRevokeTargetId);
					if (!s) {
						return 'Вы уверены, что хотите завершить эту сессию? Пользователю на этом устройстве потребуется войти снова.';
					}
					const label = getSessionDeviceLabel(s);
					const ip = s.ip_address?.trim() ? ` (${s.ip_address})` : '';
					return `Будет завершена сессия на устройстве «${label}»${ip}. На этом устройстве потребуется войти снова.`;
				})()}
				cancelButtonLabel="Отмена"
				confirmButtonLabel="Завершить"
				confirmButtonLoadingLabel="Завершение…"
				confirmIcon={<ArrowRightStartOnRectangleIcon width={18} height={18} />}
			/>
			{/* Revoke All Sessions Confirmation Modal */}
			<ConfirmDeleteModal
				isOpen={showRevokeAllModal}
				onClose={() => setShowRevokeAllModal(false)}
				onConfirm={async () => {
					setShowRevokeAllModal(false);
					await handleRevokeAllSessions();
				}}
				title="Завершить все сессии"
				warningMessage="Вы уверены, что хотите завершить все сессии кроме текущей? Вам потребуется войти снова на всех других устройствах."
				cancelButtonLabel="Отмена"
				confirmButtonLabel="Завершить все"
				confirmButtonLoadingLabel="Завершение…"
				confirmIcon={<ArrowRightStartOnRectangleIcon width={18} height={18} />}
			/>
		</div>
	);
}
