/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Step list editor for system GAF onboarding instruction template.
 *
 * Related:
 * - `pages/Admin/SystemGafInstructionEditorBody.tsx`
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopNativeSelect,
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
} from '../Desktop/components/DesktopAppChrome';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_SURFACE,
	DESKTOP_TYPOGRAPHY,
} from '../Desktop/constants';
import { ADMIN_SHELL_INPUT } from './shell/adminFormClasses';
import {
	DocumentDuplicateIcon,
	PlusIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';

import {
	COMPONENT_OPTIONS,
	EMPTY_STEP,
	MAX_STEP_BODY,
	MAX_STEP_TITLE,
	MAX_STEPS,
	type InstructionStep,
} from './systemGafInstructionShared';

type Props = {
	steps: InstructionStep[];
	setSteps: React.Dispatch<React.SetStateAction<InstructionStep[]>>;
	duplicateStep: (idx: number) => void;
	disabled: boolean;
};

export function SystemGafInstructionStepsEditor({
	steps,
	setSteps,
	duplicateStep,
	disabled,
}: Props): React.ReactElement {
	const { t } = useTranslation('desktopUi', {
		keyPrefix: 'adminGafInstruction',
	});

	return (
		<div className="space-y-4 mb-6">
			<div className="flex items-center justify-between">
				<span className={DESKTOP_TYPOGRAPHY.caption}>
					{t('steps.heading', { count: steps.length, max: MAX_STEPS })}
				</span>
				<button
					type="button"
					onClick={() =>
						setSteps((s) => (s.length >= MAX_STEPS ? s : [...s, EMPTY_STEP()]))
					}
					disabled={disabled || steps.length >= MAX_STEPS}
					className="inline-flex items-center gap-1 text-sm text-violet-300 hover:text-violet-200 disabled:opacity-40"
				>
					<PlusIcon className="h-4 w-4" />
					{t('steps.add')}
				</button>
			</div>
			{steps.map((step, idx) => (
				<div
					key={step.id}
					className={`rounded-lg border border-white/10 p-4 ${DESKTOP_SURFACE.radius}`}
				>
					<div className="flex justify-between gap-2 mb-2">
						<span className={DESKTOP_TYPOGRAPHY.caption}>
							{t('steps.stepN', { n: idx + 1 })}
						</span>
						<div className="flex items-center gap-1 shrink-0">
							<button
								type="button"
								onClick={() => duplicateStep(idx)}
								disabled={disabled || steps.length >= MAX_STEPS}
								className={`p-1.5 rounded text-slate-500 hover:text-violet-300 hover:bg-white/5 disabled:opacity-40 ${DESKTOP_INTERACTIVE.focusRing}`}
								title={t('steps.duplicateTitle')}
								aria-label={t('steps.duplicateAria')}
							>
								<DocumentDuplicateIcon className="h-4 w-4" />
							</button>
							<button
								type="button"
								onClick={() =>
									setSteps((s) =>
										s.length <= 1 ? s : s.filter((_, i) => i !== idx)
									)
								}
								disabled={disabled || steps.length <= 1}
								className={`p-1.5 rounded text-slate-500 hover:text-red-300 disabled:opacity-40 ${DESKTOP_INTERACTIVE.focusRing}`}
								aria-label={t('steps.deleteAria')}
							>
								<TrashIcon className="h-4 w-4" />
							</button>
						</div>
					</div>
					<input
						type="text"
						value={step.title}
						onChange={(e) => {
							const v = e.target.value;
							setSteps((s) =>
								s.map((x, i) => (i === idx ? { ...x, title: v } : x))
							);
						}}
						placeholder={t('steps.titlePlaceholder')}
						maxLength={MAX_STEP_TITLE}
						disabled={disabled}
						className={`mb-2 ${ADMIN_SHELL_INPUT}`}
					/>
					<p className="text-right text-[10px] text-slate-600 mb-1 tabular-nums">
						{step.title.length}/{MAX_STEP_TITLE}
					</p>
					<textarea
						value={step.body}
						onChange={(e) => {
							const v = e.target.value;
							setSteps((s) =>
								s.map((x, i) => (i === idx ? { ...x, body: v } : x))
							);
						}}
						placeholder={t('steps.bodyPlaceholder')}
						rows={3}
						maxLength={MAX_STEP_BODY}
						disabled={disabled}
						className={`mb-2 ${ADMIN_SHELL_INPUT}`}
					/>
					<p className="text-right text-[10px] text-slate-600 mb-2 tabular-nums">
						{step.body.length}/{MAX_STEP_BODY}
					</p>
					<div className="grid gap-2 sm:grid-cols-2">
						<label className="block text-xs text-slate-400">
							{t('steps.openApp')}
							<div className="mt-1 w-full">
								<DesktopNativeSelect
									value={step.open_app_component ?? ''}
									onChange={(e) => {
										const v = e.target.value || null;
										setSteps((s) =>
											s.map((x, i) =>
												i === idx ? { ...x, open_app_component: v } : x
											)
										);
									}}
									disabled={disabled}
									className="text-sm"
									aria-label={t('steps.openAppAria')}
								>
									<option
										className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
										value=""
									>
										—
									</option>
									{COMPONENT_OPTIONS.map((c) => (
										<option
											key={c}
											className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
											value={c}
										>
											{c}
										</option>
									))}
								</DesktopNativeSelect>
							</div>
						</label>
						<label className="block text-xs text-slate-400">
							{t('steps.buttonLabel')}
							<input
								type="text"
								value={step.button_label}
								onChange={(e) => {
									const v = e.target.value;
									setSteps((s) =>
										s.map((x, i) => (i === idx ? { ...x, button_label: v } : x))
									);
								}}
								disabled={disabled}
								className={`mt-1 ${ADMIN_SHELL_INPUT}`}
							/>
						</label>
					</div>
				</div>
			))}
		</div>
	);
}
