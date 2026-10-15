import { Button } from '@components/atoms/Button';
import { useAdminStore } from '@store/slices/adminSlice';
import { useSiteSettingsStore } from '@store/slices/siteSettingsSlice';
import { APIError } from '@services/api/client';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { maskPhoneInput, normalizePhoneForSave } from './contactPhoneMask';
import {
	ContactSettings,
	validateContactFields,
	type ContactFieldErrors,
} from './components/ContactSettings';
import { PasswordSettings } from './components/PasswordSettings';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

export const SettingsPage: React.FC = () => {
	const { t } = useTranslation('siteStudio');
	const { changePassword } = useAdminStore();
	const siteSettings = useSiteSettingsStore((state) => state.siteSettings);
	const updateSiteSettings = useSiteSettingsStore(
		(state) => state.updateSiteSettings
	);
	const [isSaving, setIsSaving] = useState(false);
	const [successMessage, setSuccessMessage] = useState('');
	const [apiError, setApiError] = useState<string | null>(null);
	const [contactErrors, setContactErrors] = useState<ContactFieldErrors>({});

	const [formData, setFormData] = useState({
		contactPhone: siteSettings?.contactPhone || '',
		contactEmail: siteSettings?.contactEmail || '',
		contactAddress: siteSettings?.contactAddress || '',
		workingHours: siteSettings?.workingHours || '',
	});

	const handleContactChange = (field: string, value: string) => {
		setContactErrors((prev) => {
			const next = { ...prev };
			if (field === 'contactPhone') delete next.contactPhone;
			if (field === 'contactEmail') delete next.contactEmail;
			return next;
		});
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	useEffect(() => {
		setFormData({
			contactPhone: maskPhoneInput(siteSettings?.contactPhone || ''),
			contactEmail: siteSettings?.contactEmail || '',
			contactAddress: siteSettings?.contactAddress || '',
			workingHours: siteSettings?.workingHours || '',
		});
		setContactErrors({});
		setApiError(null);
	}, [siteSettings]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setApiError(null);
		const errs = validateContactFields(formData, t);
		setContactErrors(errs);
		if (Object.keys(errs).length > 0) {
			return;
		}

		setIsSaving(true);
		setSuccessMessage('');

		try {
			await updateSiteSettings({
				...formData,
				contactPhone: normalizePhoneForSave(formData.contactPhone),
			});
			setSuccessMessage(t('workspace.settings.savedLive'));
			setTimeout(() => setSuccessMessage(''), 4000);
		} catch (err) {
			if (err instanceof APIError && err.statusCode === 401) {
				setApiError(t('workspace.settings.unauthorized'));
			} else {
				setApiError(t('workspace.settings.saveError'));
			}
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="space-y-6 min-w-0 max-w-full">
			<div>
				<h1 className="text-2xl sm:text-3xl font-display font-semibold text-neutral-900 dark:text-slate-100">
					{t('workspace.settings.pageTitle')}
				</h1>
				<p className="text-neutral-500 dark:text-slate-400 mt-1 text-sm sm:text-base">
					{t('workspace.settings.pageSubtitle')}
				</p>
			</div>

			{apiError && (
				<div
					role="alert"
					className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3"
				>
					{apiError}
				</div>
			)}

			<div className="sr-only" aria-live="polite">
				{successMessage}
			</div>

			<form onSubmit={handleSubmit} className="space-y-6 min-w-0">
				<ContactSettings
					formData={formData}
					errors={contactErrors}
					onChange={handleContactChange}
				/>

				<div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
					<div className="min-h-6" aria-live="polite">
						{successMessage && (
							<span className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">
								{successMessage}
							</span>
						)}
					</div>
					<Button
						type="submit"
						disabled={isSaving}
						className="shrink-0 min-h-11 w-full sm:w-auto"
					>
						<ArrowDownTrayIcon width={18} height={18} className="mr-2" />
						{isSaving
							? t('workspace.settings.saving')
							: t('workspace.settings.saveButton')}
					</Button>
				</div>
			</form>

			<PasswordSettings onChangePassword={changePassword} />
		</div>
	);
};
