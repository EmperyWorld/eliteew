/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Script mode v1 — template with ``{topic}`` variables (U2.5).
 *
 * Invariants:
 * - Variables substituted client-side before send; no server script engine yet.
 *
 * Related:
 * - src/features/ewa/companionOutputSurface/CompanionOutputSurface.tsx
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CompanionSurfacePanel } from '@/features/ewa/companionOutputSurface/CompanionSurfacePanel';
import { EWA_COMPANION_TYPOGRAPHY } from '@/features/ewa/ewaShellTypography';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

const VARIABLE_PATTERN = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/gu;

export function extractScriptVariables(template: string): string[] {
	const found = new Set<string>();
	for (const match of template.matchAll(VARIABLE_PATTERN)) {
		const name = match[1]?.trim();
		if (name) found.add(name);
	}
	return [...found];
}

export function renderScriptTemplate(
	template: string,
	values: Record<string, string>
): string {
	return template.replace(VARIABLE_PATTERN, (_full, name: string) => {
		const value = values[name]?.trim();
		return value || `{${name}}`;
	});
}

export type CompanionScriptModeProps = {
	onBackToChat: () => void;
	onSubmitPrompt: (text: string) => void | Promise<void>;
	onSaveAsWorkflowStep?: (text: string) => void;
	initialTemplate?: string;
};

export function CompanionScriptMode({
	onBackToChat,
	onSubmitPrompt,
	onSaveAsWorkflowStep,
	initialTemplate = '',
}: CompanionScriptModeProps) {
	const { t } = useTranslation('marketing');
	const [template, setTemplate] = useState(
		initialTemplate.trim() || t('ewaCompanion.scriptMode.defaultTemplate')
	);
	const variables = useMemo(() => extractScriptVariables(template), [template]);
	const [values, setValues] = useState<Record<string, string>>({});

	const preview = useMemo(
		() => renderScriptTemplate(template, values),
		[template, values]
	);
	const ready = variables.every((name) => values[name]?.trim());

	return (
		<CompanionSurfacePanel
			title={t('ewaCompanion.scriptMode.title')}
			subtitle={t('ewaCompanion.scriptMode.subtitle')}
			onBack={onBackToChat}
			backLabel={t('ewaCompanion.outputSurfaceBackToChat')}
			testId="ewa-companion-script-mode"
		>
			<label className="flex flex-col gap-1">
				<span
					className={cn(
						EWA_COMPANION_TYPOGRAPHY.cardTitle,
						'text-(--companion-text-soft)'
					)}
				>
					{t('ewaCompanion.scriptMode.templateLabel')}
				</span>
				<textarea
					rows={4}
					value={template}
					onChange={(e) => setTemplate(e.target.value)}
					className={cn(
						'rounded-lg border border-white/10 bg-black/20 px-3 py-2',
						EWA_COMPANION_TYPOGRAPHY.bodyCompact,
						'text-(--desktop-text-primary)',
						DESKTOP_CHROME_FOCUS_VISIBLE
					)}
				/>
			</label>
			{variables.length > 0 ? (
				<div className="mt-3 flex flex-col gap-2">
					<p
						className={cn(
							EWA_COMPANION_TYPOGRAPHY.cardTitle,
							'text-(--companion-text-soft)'
						)}
					>
						{t('ewaCompanion.scriptMode.variablesLabel')}
					</p>
					<div className="flex flex-wrap gap-1">
						{variables.map((name) => (
							<button
								key={`chip-${name}`}
								type="button"
								className={cn(
									'rounded-full border border-(--companion-divider)/80 px-2 py-0.5',
									EWA_COMPANION_TYPOGRAPHY.micro,
									'text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft)/30',
									DESKTOP_CHROME_FOCUS_VISIBLE
								)}
								aria-label={t('ewaCompanion.scriptMode.variableChipAria', {
									name,
								})}
								onClick={() =>
									setValues((prev) => ({
										...prev,
										[name]: prev[name] ?? '',
									}))
								}
							>
								{`{${name}}`}
							</button>
						))}
					</div>
					{variables.map((name) => (
						<label key={name} className="flex flex-col gap-0.5">
							<span
								className={cn(
									EWA_COMPANION_TYPOGRAPHY.micro,
									'text-(--companion-text-soft)'
								)}
							>
								{name}
							</span>
							<input
								type="text"
								value={values[name] ?? ''}
								onChange={(e) =>
									setValues((prev) => ({ ...prev, [name]: e.target.value }))
								}
								className={cn(
									'rounded-md border border-white/10 bg-black/20 px-2 py-1',
									EWA_COMPANION_TYPOGRAPHY.bodyCompact,
									DESKTOP_CHROME_FOCUS_VISIBLE
								)}
							/>
						</label>
					))}
				</div>
			) : null}
			<div className="mt-3 rounded-lg border border-(--companion-divider)/60 bg-white/4 px-3 py-2">
				<p
					className={cn(
						EWA_COMPANION_TYPOGRAPHY.overline,
						'font-medium tracking-wider text-(--companion-aura)'
					)}
				>
					{t('ewaCompanion.scriptMode.previewLabel')}
				</p>
				<p
					className={cn(
						EWA_COMPANION_TYPOGRAPHY.bodyCompact,
						'mt-1 leading-snug text-(--desktop-text-primary)'
					)}
				>
					{preview}
				</p>
			</div>
			<div className="mt-3 flex flex-wrap gap-2">
				<DesktopAppButton
					type="button"
					variant="accent"
					size="sm"
					disabled={!ready || !preview.trim()}
					onClick={() => void onSubmitPrompt(preview)}
				>
					{t('ewaCompanion.scriptMode.sendToChat')}
				</DesktopAppButton>
				{onSaveAsWorkflowStep ? (
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						disabled={!ready || !preview.trim()}
						onClick={() => onSaveAsWorkflowStep(preview)}
					>
						{t('ewaCompanion.scriptMode.saveAsWorkflowStep')}
					</DesktopAppButton>
				) : null}
			</div>
		</CompanionSurfacePanel>
	);
}
