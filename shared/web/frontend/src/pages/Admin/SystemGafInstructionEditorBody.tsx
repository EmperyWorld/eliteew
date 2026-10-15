/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Welcome/thanks fields, loading skeleton, fetch error, and steps editor for GAF instruction template.
 *
 * Related:
 * - `pages/Admin/SystemGafInstructionSection.tsx`
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '../Desktop/constants';
import { ADMIN_SHELL_INPUT } from './shell/adminFormClasses';
import { SystemGafInstructionStepsEditor } from './SystemGafInstructionStepsEditor';
import {
	MAX_WELCOME_THANKS,
	type InstructionStep,
} from './systemGafInstructionShared';

type Props = {
	loading: boolean;
	loadError: unknown;
	welcome: string;
	setWelcome: (v: string) => void;
	thanks: string;
	setThanks: (v: string) => void;
	steps: InstructionStep[];
	setSteps: React.Dispatch<React.SetStateAction<InstructionStep[]>>;
	duplicateStep: (idx: number) => void;
};

export function SystemGafInstructionEditorBody({
	loading,
	loadError,
	welcome,
	setWelcome,
	thanks,
	setThanks,
	steps,
	setSteps,
	duplicateStep,
}: Props): React.ReactElement {
	const { t } = useTranslation('desktopUi', {
		keyPrefix: 'adminGafInstruction',
	});

	return (
		<>
			<p className={`${DESKTOP_TYPOGRAPHY.meta} mb-4 text-slate-400`}>
				{t('editor.intro')}
			</p>

			{loadError != null ? (
				<div
					className="mb-4 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200"
					role="alert"
				>
					{t('editor.loadError')}{' '}
					{loadError instanceof Error ? loadError.message : String(loadError)}
				</div>
			) : null}

			{loading ? (
				<div
					role="status"
					aria-live="polite"
					aria-busy="true"
					aria-label={t('editor.loadingAria')}
					className="space-y-4 mb-6"
				>
					<div className="h-24 rounded-lg bg-slate-800/80 animate-pulse" />
					<div className="h-20 rounded-lg bg-slate-800/80 animate-pulse" />
					<div className="h-32 rounded-lg bg-slate-800/80 animate-pulse" />
				</div>
			) : (
				<>
					<label className="block mb-2">
						<span
							className={`flex justify-between gap-2 ${DESKTOP_TYPOGRAPHY.caption}`}
						>
							<span>{t('editor.welcome')}</span>
							<span className="text-slate-500 tabular-nums">
								{welcome.length}/{MAX_WELCOME_THANKS}
							</span>
						</span>
						<textarea
							value={welcome}
							onChange={(e) => setWelcome(e.target.value)}
							rows={4}
							maxLength={MAX_WELCOME_THANKS}
							className={`mt-1 ${ADMIN_SHELL_INPUT}`}
						/>
					</label>
					<label className="block mb-4">
						<span
							className={`flex justify-between gap-2 ${DESKTOP_TYPOGRAPHY.caption}`}
						>
							<span>{t('editor.thanks')}</span>
							<span className="text-slate-500 tabular-nums">
								{thanks.length}/{MAX_WELCOME_THANKS}
							</span>
						</span>
						<textarea
							value={thanks}
							onChange={(e) => setThanks(e.target.value)}
							rows={3}
							maxLength={MAX_WELCOME_THANKS}
							className={`mt-1 ${ADMIN_SHELL_INPUT}`}
						/>
					</label>

					<SystemGafInstructionStepsEditor
						steps={steps}
						setSteps={setSteps}
						duplicateStep={duplicateStep}
						disabled={false}
					/>
				</>
			)}
		</>
	);
}
