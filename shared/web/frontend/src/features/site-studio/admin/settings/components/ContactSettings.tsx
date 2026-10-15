import { Card } from '@components/atoms/Card';
import { Input } from '@components/atoms/Input';
import * as React from 'react';
import { useId } from 'react';
import {
	ClockIcon,
	EnvelopeIcon,
	GlobeAltIcon,
	MapPinIcon,
	PhoneIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import {
	isValidEmail,
	isValidPhone,
	maskPhoneInput,
} from '../contactPhoneMask';

export interface ContactFieldErrors {
	contactPhone?: string;
	contactEmail?: string;
}

interface ContactSettingsProps {
	formData: {
		contactPhone: string;
		contactEmail: string;
		contactAddress: string;
		workingHours: string;
	};
	errors: ContactFieldErrors;
	onChange: (field: string, value: string) => void;
}

export const ContactSettings: React.FC<ContactSettingsProps> = ({
	formData,
	errors,
	onChange,
}) => {
	const { t } = useTranslation('siteStudio');
	const phoneId = useId();
	const emailId = useId();
	const addressId = useId();
	const hoursId = useId();
	const phoneErrId = useId();
	const emailErrId = useId();

	const phoneInvalid = Boolean(errors.contactPhone);
	const emailInvalid = Boolean(errors.contactEmail);

	return (
		<Card className="p-4 sm:p-6 space-y-6 max-w-full min-w-0 border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 shadow-sm">
			<div className="flex items-center gap-3 min-w-0">
				<div className="p-2 rounded-xl bg-primary-100 dark:bg-primary-900/30 shrink-0">
					<GlobeAltIcon
						width={20}
						height={20}
						className="text-primary-600 dark:text-primary-400"
					/>
				</div>
				<h2 className="text-lg font-semibold text-neutral-900 dark:text-slate-100 min-w-0">
					{t('workspace.settings.contactCardTitle')}
				</h2>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 min-w-0">
				<div className="min-w-0 space-y-1.5">
					<label
						htmlFor={phoneId}
						className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
					>
						<PhoneIcon
							width={16}
							height={16}
							className="text-neutral-400 shrink-0"
						/>
						{t('workspace.settings.phoneLabel')}
					</label>
					<Input
						id={phoneId}
						inputMode="tel"
						autoComplete="tel"
						aria-invalid={phoneInvalid}
						aria-describedby={phoneInvalid ? phoneErrId : undefined}
						value={formData.contactPhone}
						onChange={(e) =>
							onChange('contactPhone', maskPhoneInput(e.target.value))
						}
						placeholder={t('workspace.settings.phonePlaceholder')}
						className={
							phoneInvalid
								? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10'
								: ''
						}
					/>
					{phoneInvalid && (
						<p
							id={phoneErrId}
							className="text-xs text-red-600 dark:text-red-400"
						>
							{errors.contactPhone}
						</p>
					)}
				</div>

				<div className="min-w-0 space-y-1.5">
					<label
						htmlFor={emailId}
						className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
					>
						<EnvelopeIcon
							width={16}
							height={16}
							className="text-neutral-400 shrink-0"
						/>
						{t('workspace.settings.emailLabel')}
					</label>
					<Input
						id={emailId}
						type="email"
						autoComplete="email"
						aria-invalid={emailInvalid}
						aria-describedby={emailInvalid ? emailErrId : undefined}
						value={formData.contactEmail}
						onChange={(e) => onChange('contactEmail', e.target.value)}
						placeholder={t('workspace.settings.emailPlaceholder')}
						className={
							emailInvalid
								? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10'
								: ''
						}
					/>
					{emailInvalid && (
						<p
							id={emailErrId}
							className="text-xs text-red-600 dark:text-red-400"
						>
							{errors.contactEmail}
						</p>
					)}
				</div>

				<div className="min-w-0 md:col-span-2 space-y-1.5">
					<label
						htmlFor={addressId}
						className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
					>
						<MapPinIcon
							width={16}
							height={16}
							className="text-neutral-400 shrink-0"
						/>
						{t('workspace.settings.addressLabel')}
					</label>
					<Input
						id={addressId}
						value={formData.contactAddress}
						onChange={(e) => onChange('contactAddress', e.target.value)}
						placeholder={t('workspace.settings.addressPlaceholder')}
						className="text-neutral-900 dark:text-slate-100 border-neutral-200 dark:border-slate-600"
					/>
				</div>

				<div className="min-w-0 md:col-span-2 space-y-1.5">
					<label
						htmlFor={hoursId}
						className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
					>
						<ClockIcon
							width={16}
							height={16}
							className="text-neutral-400 shrink-0"
						/>
						{t('workspace.settings.hoursLabel')}
					</label>
					<Input
						id={hoursId}
						value={formData.workingHours}
						onChange={(e) => onChange('workingHours', e.target.value)}
						placeholder={t('workspace.settings.hoursPlaceholder')}
						className="text-neutral-900 dark:text-slate-100 border-neutral-200 dark:border-slate-600"
					/>
				</div>
			</div>
		</Card>
	);
};

export function validateContactFields(
	formData: ContactSettingsProps['formData'],
	t: (k: string) => string
): ContactFieldErrors {
	const errors: ContactFieldErrors = {};
	if (!isValidPhone(formData.contactPhone)) {
		errors.contactPhone = t('workspace.settings.phoneInvalid');
	}
	if (!isValidEmail(formData.contactEmail)) {
		errors.contactEmail = t('workspace.settings.emailInvalid');
	}
	return errors;
}
