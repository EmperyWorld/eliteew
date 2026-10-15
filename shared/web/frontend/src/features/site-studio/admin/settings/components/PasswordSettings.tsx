import * as React from 'react';
import { useId, useState } from 'react';
import {
	EyeIcon,
	EyeSlashIcon,
	LockClosedIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Card } from '@components/atoms/Card';
import { Button } from '@components/atoms/Button';
import { Input } from '@components/atoms/Input';

interface PasswordSettingsProps {
	onChangePassword: (current: string, newPass: string) => Promise<boolean>;
}

export const PasswordSettings: React.FC<PasswordSettingsProps> = ({
	onChangePassword,
}) => {
	const { t } = useTranslation('siteStudio');
	const [passwordData, setPasswordData] = useState({
		currentPassword: '',
		newPassword: '',
		confirmPassword: '',
	});
	const [showPasswords, setShowPasswords] = useState(false);
	const [passwordError, setPasswordError] = useState('');
	const [passwordSuccess, setPasswordSuccess] = useState('');
	const [isChangingPassword, setIsChangingPassword] = useState(false);
	const currentPasswordId = useId();
	const newPasswordId = useId();
	const confirmPasswordId = useId();
	const errorId = useId();
	const successId = useId();
	const passwordFieldsId = `${currentPasswordId} ${newPasswordId} ${confirmPasswordId}`;

	const handlePasswordChange = async (e: React.FormEvent) => {
		e.preventDefault();
		setPasswordError('');
		setPasswordSuccess('');

		if (passwordData.newPassword !== passwordData.confirmPassword) {
			setPasswordError(t('workspace.settings.mismatch'));
			return;
		}

		if (passwordData.newPassword.length < 6) {
			setPasswordError(t('workspace.settings.tooShort'));
			return;
		}

		setIsChangingPassword(true);
		const success = await onChangePassword(
			passwordData.currentPassword,
			passwordData.newPassword
		);
		setIsChangingPassword(false);

		if (success) {
			setPasswordSuccess(t('workspace.settings.passwordChanged'));
			setPasswordData({
				currentPassword: '',
				newPassword: '',
				confirmPassword: '',
			});
			setTimeout(() => setPasswordSuccess(''), 3000);
		} else {
			setPasswordError(t('workspace.settings.wrongCurrent'));
		}
	};

	return (
		<Card className="p-4 sm:p-6 space-y-6 max-w-full min-w-0 border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 shadow-sm">
			<div className="flex items-center gap-3 min-w-0">
				<div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30 shrink-0">
					<LockClosedIcon
						width={20}
						height={20}
						className="text-amber-600 dark:text-amber-400"
					/>
				</div>
				<h2 className="text-lg font-semibold text-neutral-900 dark:text-slate-100">
					{t('workspace.settings.passwordCardTitle')}
				</h2>
			</div>

			<form onSubmit={handlePasswordChange} className="space-y-4 min-w-0">
				<div className="grid grid-cols-1 gap-4 max-w-3xl">
					<div className="min-w-0">
						<label
							htmlFor={currentPasswordId}
							className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
						>
							{t('workspace.settings.currentPassword')}
						</label>
						<Input
							id={currentPasswordId}
							type={showPasswords ? 'text' : 'password'}
							value={passwordData.currentPassword}
							onChange={(e) =>
								setPasswordData((prev) => ({
									...prev,
									currentPassword: e.target.value,
								}))
							}
							placeholder="••••••••"
							autoComplete="current-password"
							aria-invalid={Boolean(passwordError)}
							aria-describedby={
								passwordError
									? errorId
									: passwordSuccess
										? successId
										: undefined
							}
							className="text-neutral-900 dark:text-slate-100 border-neutral-200 dark:border-slate-600"
						/>
					</div>

					<div className="min-w-0">
						<label
							htmlFor={newPasswordId}
							className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
						>
							{t('workspace.settings.newPassword')}
						</label>
						<Input
							id={newPasswordId}
							type={showPasswords ? 'text' : 'password'}
							value={passwordData.newPassword}
							onChange={(e) =>
								setPasswordData((prev) => ({
									...prev,
									newPassword: e.target.value,
								}))
							}
							placeholder="••••••••"
							autoComplete="new-password"
							className="text-neutral-900 dark:text-slate-100 border-neutral-200 dark:border-slate-600"
						/>
					</div>

					<div className="min-w-0">
						<label
							htmlFor={confirmPasswordId}
							className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
						>
							{t('workspace.settings.confirmPassword')}
						</label>
						<Input
							id={confirmPasswordId}
							type={showPasswords ? 'text' : 'password'}
							value={passwordData.confirmPassword}
							onChange={(e) =>
								setPasswordData((prev) => ({
									...prev,
									confirmPassword: e.target.value,
								}))
							}
							placeholder="••••••••"
							autoComplete="new-password"
							className="text-neutral-900 dark:text-slate-100 border-neutral-200 dark:border-slate-600"
						/>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setShowPasswords(!showPasswords)}
						aria-pressed={showPasswords}
						aria-controls={passwordFieldsId}
						aria-label={t('workspace.settings.toggleAria')}
						className="min-h-11 min-w-11 px-3 rounded-lg text-sm text-neutral-600 dark:text-slate-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-slate-700 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
					>
						{showPasswords ? (
							<EyeSlashIcon width={16} height={16} aria-hidden />
						) : (
							<EyeIcon width={16} height={16} aria-hidden />
						)}
						<span className="text-left">
							{showPasswords
								? t('workspace.settings.toggleHide')
								: t('workspace.settings.toggleShow')}
						</span>
					</button>
				</div>

				{passwordError && (
					<div
						id={errorId}
						role="alert"
						className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl border border-red-200 dark:border-red-800"
					>
						{passwordError}
					</div>
				)}

				{passwordSuccess && (
					<div
						id={successId}
						role="status"
						aria-live="polite"
						className="text-green-600 dark:text-emerald-400 text-sm bg-green-50 dark:bg-emerald-900/20 px-4 py-2 rounded-xl border border-green-200 dark:border-emerald-800"
					>
						{passwordSuccess}
					</div>
				)}

				<Button
					type="submit"
					variant="outline"
					disabled={
						isChangingPassword ||
						!passwordData.currentPassword ||
						!passwordData.newPassword
					}
				>
					<LockClosedIcon width={16} height={16} className="mr-2" />
					{isChangingPassword
						? t('workspace.settings.changing')
						: t('workspace.settings.changeButton')}
				</Button>
			</form>
		</Card>
	);
};
