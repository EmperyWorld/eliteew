/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Runtime form renderer for active Professional Worlds profile and object schemas.
 *
 * Invariants:
 * - The renderer only consumes runtime schema rows; admin-only prompt/provider metadata is not required.
 * - Submitted values are parsed and validated against the supported JSON Schema subset before callbacks run.
 *
 * Related:
 * - types.ts
 * - ProfessionalWorldsApp.tsx
 */

import { useEffect, useId, useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import {
	DesktopAppButton,
	DesktopAppEmptyState,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import {
	ProfessionalWorldsFormField,
	ProfessionalWorldsStatusBanner,
	ProfessionalWorldsWorkspacePanel,
} from './layout';
import { PW_FORM_GRID_CLASS } from './layout/professionalWorldsLayoutTokens';
import type { ProfessionalRuntimeSchema } from './types';

type JsonSchemaType =
	| 'array'
	| 'boolean'
	| 'integer'
	| 'null'
	| 'number'
	| 'object'
	| 'string';

type JsonSchemaProperty = {
	type?: JsonSchemaType | JsonSchemaType[];
	title?: string;
	description?: string;
	enum?: unknown[];
	default?: unknown;
	items?: JsonSchemaProperty;
	format?: string;
	minimum?: number;
	maximum?: number;
};

type RuntimeSchemaUiField = {
	'ui:widget'?: string;
	'ui:placeholder'?: string;
	'ui:help'?: string;
};

type RuntimeSchemaDescriptor = {
	properties: Array<{
		key: string;
		property: JsonSchemaProperty;
		ui: RuntimeSchemaUiField;
		required: boolean;
	}>;
	requiredKeys: Set<string>;
};

type DraftValue = boolean | string;
type DraftState = Record<string, DraftValue>;

const inputClassName =
	'rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim) outline-none focus:border-(--desktop-border-strong)';

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === 'string')
		: [];
}

function fieldType(
	property: JsonSchemaProperty
): Exclude<JsonSchemaType, 'null'> {
	const rawType = Array.isArray(property.type)
		? property.type.find((item) => item !== 'null')
		: property.type;
	return rawType && rawType !== 'null' ? rawType : 'string';
}

function humanizeSchemaKey(value: string): string {
	return value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function fieldLabel(key: string, property: JsonSchemaProperty): string {
	return property.title || humanizeSchemaKey(key);
}

function displayEnumOptionLabel(t: TFunction, value: unknown): string {
	return t('runtimeComponents.schemaForm.enumOptionFallback', {
		value: humanizeSchemaKey(String(value)),
	});
}

function fieldUi(
	uiSchema: Record<string, unknown>,
	key: string
): RuntimeSchemaUiField {
	const value = uiSchema[key];
	return isRecord(value) ? (value as RuntimeSchemaUiField) : {};
}

function describeSchema(
	schema: ProfessionalRuntimeSchema
): RuntimeSchemaDescriptor {
	const root = schema.schema_json ?? {};
	const properties = isRecord(root.properties) ? root.properties : {};
	const requiredKeys = new Set(asStringArray(root.required));
	const uiSchema = schema.ui_schema ?? {};
	const uiOrder = asStringArray(uiSchema['ui:order']);
	const propertyKeys = Object.keys(properties);
	const orderedKeys = [
		...uiOrder.filter((key) => propertyKeys.includes(key)),
		...propertyKeys.filter((key) => !uiOrder.includes(key)),
	];

	return {
		requiredKeys,
		properties: orderedKeys
			.map((key) => {
				const property = properties[key];
				return {
					key,
					property: isRecord(property) ? (property as JsonSchemaProperty) : {},
					ui: fieldUi(uiSchema, key),
					required: requiredKeys.has(key),
				};
			})
			.filter(({ ui }) => ui['ui:widget'] !== 'hidden'),
	};
}

function initialDraftValue(
	value: unknown,
	property: JsonSchemaProperty
): DraftValue {
	if (fieldType(property) === 'boolean') {
		return typeof value === 'boolean'
			? value
			: typeof property.default === 'boolean'
				? property.default
				: false;
	}
	const source = value ?? property.default;
	if (source == null) {
		return '';
	}
	if (typeof source === 'object') {
		return JSON.stringify(source, null, 2);
	}
	return String(source);
}

function createInitialDraft(
	descriptor: RuntimeSchemaDescriptor,
	value: Record<string, unknown>
): DraftState {
	return Object.fromEntries(
		descriptor.properties.map(({ key, property }) => [
			key,
			initialDraftValue(value[key], property),
		])
	);
}

function parseJsonField(
	text: string,
	key: string,
	expectedType: 'array' | 'object',
	errorText: {
		array: string;
		object: string;
	}
): unknown {
	if (!text.trim()) {
		return expectedType === 'array' ? [] : {};
	}
	const parsed = JSON.parse(text) as unknown;
	if (expectedType === 'array' && !Array.isArray(parsed)) {
		throw new Error(errorText.array.replace('{{field}}', key));
	}
	if (expectedType === 'object' && !isRecord(parsed)) {
		throw new Error(errorText.object.replace('{{field}}', key));
	}
	return parsed;
}

function parseFieldValue({
	key,
	property,
	required,
	value,
	errorText,
}: {
	key: string;
	property: JsonSchemaProperty;
	required: boolean;
	value: DraftValue;
	errorText: {
		array: string;
		number: string;
		object: string;
		required: string;
	};
}): unknown {
	const type = fieldType(property);
	if (type === 'boolean') {
		return Boolean(value);
	}
	const text = String(value);
	if (!text.trim()) {
		if (required) {
			throw new Error(
				errorText.required.replace('{{field}}', fieldLabel(key, property))
			);
		}
		return null;
	}
	if (type === 'number' || type === 'integer') {
		const parsed = Number(text);
		if (!Number.isFinite(parsed)) {
			throw new Error(
				errorText.number.replace('{{field}}', fieldLabel(key, property))
			);
		}
		return type === 'integer' ? Math.trunc(parsed) : parsed;
	}
	if (type === 'array' || type === 'object') {
		return parseJsonField(text, fieldLabel(key, property), type, errorText);
	}
	return text;
}

function parseDraft(
	descriptor: RuntimeSchemaDescriptor,
	draft: DraftState,
	errorText: {
		array: string;
		number: string;
		object: string;
		required: string;
	}
): Record<string, unknown> {
	return Object.fromEntries(
		descriptor.properties.map(({ key, property, required }) => [
			key,
			parseFieldValue({
				key,
				property,
				required,
				value: draft[key] ?? '',
				errorText,
			}),
		])
	);
}

export function SchemaDrivenForm({
	schema,
	value,
	onChange,
	onSubmit,
	submitLabel,
	disabled = false,
}: {
	schema: ProfessionalRuntimeSchema | null;
	value: Record<string, unknown>;
	onChange?: (nextValue: Record<string, unknown>) => void;
	onSubmit: (nextValue: Record<string, unknown>) => void | Promise<void>;
	submitLabel?: string;
	disabled?: boolean;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const errorText = useMemo(
		() => ({
			array: t('runtimeComponents.schemaForm.arrayError'),
			number: t('runtimeComponents.schemaForm.numberError'),
			object: t('runtimeComponents.schemaForm.objectError'),
			required: t('runtimeComponents.schemaForm.requiredError'),
		}),
		[t]
	);
	const formId = useId();
	const descriptor = useMemo(
		() => (schema ? describeSchema(schema) : null),
		[schema]
	);
	const [draft, setDraft] = useState<DraftState>({});
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (!descriptor) {
			setDraft({});
			return;
		}
		setDraft(createInitialDraft(descriptor, value));
		setError(null);
	}, [descriptor, value]);

	if (!schema || !descriptor) {
		return (
			<DesktopAppEmptyState
				title={t('runtimeComponents.schemaForm.noActiveTitle')}
				description={t('runtimeComponents.schemaForm.noActiveDescription')}
			/>
		);
	}

	if (descriptor.properties.length === 0) {
		return (
			<DesktopAppEmptyState
				title={t('runtimeComponents.schemaForm.emptyTitle')}
				description={t('runtimeComponents.schemaForm.emptyDescription')}
			/>
		);
	}

	function updateDraft(key: string, nextValue: DraftValue) {
		setDraft((current) => {
			const nextDraft = { ...current, [key]: nextValue };
			if (descriptor) {
				try {
					onChange?.(parseDraft(descriptor, nextDraft, errorText));
				} catch {
					// Live change parsing is best-effort; submit still reports the field error.
				}
			}
			return nextDraft;
		});
	}

	async function handleSubmit() {
		if (!descriptor) {
			return;
		}
		setBusy(true);
		setError(null);
		try {
			await onSubmit(parseDraft(descriptor, draft, errorText));
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: t('runtimeComponents.schemaForm.submitFailed')
			);
		} finally {
			setBusy(false);
		}
	}

	return (
		<ProfessionalWorldsWorkspacePanel
			title={schema.title}
			className="grid gap-4 p-4"
			actions={
				<span className="rounded-full border border-(--desktop-border-subtle) px-2 py-1 text-[11px] text-(--desktop-text-secondary)">
					{t('runtimeComponents.schemaForm.fieldsCount', {
						count: descriptor.properties.length,
					})}
				</span>
			}
		>
			<p className="text-xs text-(--desktop-text-secondary)">
				{t('runtimeComponents.schemaForm.versionLabel', {
					version: schema.version,
				})}
			</p>
			<div className={PW_FORM_GRID_CLASS}>
				{descriptor.properties.map(({ key, property, required, ui }) => {
					const id = `${formId}-${key}`;
					const label = fieldLabel(key, property);
					const type = fieldType(property);
					const draftValue =
						draft[key] ?? initialDraftValue(undefined, property);
					const helpText = ui['ui:help'] || property.description;

					return (
						<ProfessionalWorldsFormField
							key={key}
							htmlFor={id}
							label={
								<span>
									{label}
									{required ? (
										<span
											className="ml-1 text-rose-300"
											title={t('runtimeComponents.schemaForm.required')}
											aria-hidden
										>
											*
										</span>
									) : null}
								</span>
							}
						>
							{property.enum ? (
								<select
									id={id}
									value={String(draftValue)}
									disabled={disabled || busy}
									onChange={(event) => updateDraft(key, event.target.value)}
									className={inputClassName}
								>
									{!required && (
										<option value="">
											{t('runtimeComponents.schemaForm.notSet')}
										</option>
									)}
									{property.enum.map((option) => (
										<option key={String(option)} value={String(option)}>
											{displayEnumOptionLabel(t, option)}
										</option>
									))}
								</select>
							) : type === 'boolean' ? (
								<input
									id={id}
									type="checkbox"
									checked={Boolean(draftValue)}
									disabled={disabled || busy}
									onChange={(event) => updateDraft(key, event.target.checked)}
									className="h-4 w-4 accent-[rgb(var(--desktop-accent-rgb))]"
								/>
							) : type === 'array' ||
								type === 'object' ||
								ui['ui:widget'] === 'textarea' ? (
								<textarea
									id={id}
									value={String(draftValue)}
									disabled={disabled || busy}
									placeholder={ui['ui:placeholder']}
									onChange={(event) => updateDraft(key, event.target.value)}
									className={`${inputClassName} min-h-24 font-mono text-xs md:col-span-2`}
								/>
							) : (
								<input
									id={id}
									type={
										type === 'number' || type === 'integer'
											? 'number'
											: property.format === 'date'
												? 'date'
												: 'text'
									}
									value={String(draftValue)}
									disabled={disabled || busy}
									placeholder={ui['ui:placeholder']}
									onChange={(event) => updateDraft(key, event.target.value)}
									className={inputClassName}
								/>
							)}
							{helpText && (
								<span className="text-[11px] font-normal text-(--desktop-text-dim)">
									{helpText}
								</span>
							)}
						</ProfessionalWorldsFormField>
					);
				})}
			</div>
			{error ? (
				<ProfessionalWorldsStatusBanner kind="error">
					{error}
				</ProfessionalWorldsStatusBanner>
			) : null}
			<DesktopAppButton
				disabled={disabled || busy}
				onClick={() => void handleSubmit()}
			>
				{submitLabel ?? t('runtimeComponents.schemaForm.save')}
			</DesktopAppButton>
		</ProfessionalWorldsWorkspacePanel>
	);
}
