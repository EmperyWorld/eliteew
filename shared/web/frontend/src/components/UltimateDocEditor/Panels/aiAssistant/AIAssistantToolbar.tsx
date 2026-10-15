/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Quick actions + context/action mode selects for AIAssistantPanel.
 *
 * Invariants:
 * - Quick actions use Heroicons via compose (no emoji).
 *
 * Related:
 * - useAIAssistantCompose.ts, aiAssistantPanelChrome.ts
 */

import type { Dispatch, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import { cn } from '@/utils/cn';
import {
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
	DesktopAppButton,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';
import type {
	AIAssistantActionMode,
	AIAssistantContextScope,
	AIAssistantQuickActionItem,
} from '@/components/UltimateDocEditor/Panels/aiAssistant/aiAssistantTypes';
import {
	DOC_EDITOR_AI_META_HINT_CLASS,
	DOC_EDITOR_AI_QUICK_ACTION_CLASS,
	DOC_EDITOR_AI_TOOLBAR_PAD_CLASS,
} from '@/components/UltimateDocEditor/Panels/aiAssistant/aiAssistantPanelChrome';

type AIAssistantToolbarProps = {
	t: TFunction<'docEditorPanels'>;
	headerStripClass: string;
	selectedText?: string;
	quickActionItems: AIAssistantQuickActionItem[];
	onQuickAction: (action: string) => void;
	contextScope: AIAssistantContextScope;
	setContextScope: Dispatch<SetStateAction<AIAssistantContextScope>>;
	actionMode: AIAssistantActionMode;
	setActionMode: Dispatch<SetStateAction<AIAssistantActionMode>>;
	estimatedTokenBudget: number;
};

export function AIAssistantToolbar({
	t,
	headerStripClass,
	selectedText,
	quickActionItems,
	onQuickAction,
	contextScope,
	setContextScope,
	actionMode,
	setActionMode,
	estimatedTokenBudget,
}: AIAssistantToolbarProps) {
	return (
		<div className={cn(DOC_EDITOR_AI_TOOLBAR_PAD_CLASS, headerStripClass)}>
			<div className="flex flex-wrap items-center gap-1.5">
				{quickActionItems.map(({ action, label, icon }) => {
					const disabled = !selectedText;
					return (
						<DesktopAppButton
							key={action}
							onClick={() => onQuickAction(action)}
							disabled={disabled}
							title={disabled ? t('ai.quickActions.needSelection') : label}
							variant={disabled ? 'neutral' : 'ghost'}
							size="sm"
							className={DOC_EDITOR_AI_QUICK_ACTION_CLASS}
						>
							<span className="flex items-center gap-1">
								{icon}
								<span>{label}</span>
							</span>
						</DesktopAppButton>
					);
				})}
			</div>
			{!selectedText && (
				<p className={cn(DOC_EDITOR_AI_META_HINT_CLASS, 'mt-1.5')}>
					{t('ai.quickActionsHint')}
				</p>
			)}
			<div className="mt-2 grid grid-cols-2 gap-2">
				<DesktopNativeSelect
					aria-label={t('ai.select.contextAria')}
					value={contextScope}
					onChange={(event) => {
						const value = event.target.value;
						if (
							value === 'selection' ||
							value === 'section' ||
							value === 'document'
						) {
							setContextScope(value);
						}
					}}
					className="text-[11px]"
				>
					<option
						value="selection"
						className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
					>
						{t('ai.labels.contextWithLabel', {
							label: t('ai.scopeShort.selection'),
						})}
					</option>
					<option
						value="section"
						className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
					>
						{t('ai.labels.contextWithLabel', {
							label: t('ai.scopeShort.section'),
						})}
					</option>
					<option
						value="document"
						className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
					>
						{t('ai.labels.contextWithLabel', {
							label: t('ai.scopeShort.document'),
						})}
					</option>
				</DesktopNativeSelect>
				<DesktopNativeSelect
					aria-label={t('ai.select.actionAria')}
					value={actionMode}
					onChange={(event) => {
						const value = event.target.value;
						if (
							value === 'rewrite' ||
							value === 'expand' ||
							value === 'summarize' ||
							value === 'translate' ||
							value === 'free'
						) {
							setActionMode(value);
						}
					}}
					className="text-[11px]"
				>
					<option
						value="free"
						className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
					>
						{t('ai.labels.actionWithLabel', {
							label: t('ai.actionShort.free'),
						})}
					</option>
					<option
						value="rewrite"
						className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
					>
						{t('ai.labels.actionWithLabel', {
							label: t('ai.actionShort.rewrite'),
						})}
					</option>
					<option
						value="expand"
						className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
					>
						{t('ai.labels.actionWithLabel', {
							label: t('ai.actionShort.expand'),
						})}
					</option>
					<option
						value="summarize"
						className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
					>
						{t('ai.labels.actionWithLabel', {
							label: t('ai.actionShort.summarize'),
						})}
					</option>
					<option
						value="translate"
						className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
					>
						{t('ai.labels.actionWithLabel', {
							label: t('ai.actionShort.translate'),
						})}
					</option>
				</DesktopNativeSelect>
			</div>
			<p className={cn(DOC_EDITOR_AI_META_HINT_CLASS, 'mt-1')}>
				{t('ai.tokenBudget', { count: estimatedTokenBudget })}
			</p>
		</div>
	);
}
