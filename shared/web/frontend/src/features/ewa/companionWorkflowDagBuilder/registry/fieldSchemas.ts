/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Per-node field definitions for the DAG properties inspector (mirrors engine config + io profiles).
 *
 * Related:
 * - registry/ioProfiles.ts
 * - api/ewa_platform/schemas/pydantic/companion_workflow_v2.py
 */

import {
	inputFieldsForProfile,
	NODE_INPUT_PROFILE_BY_TYPE,
} from '@/features/ewa/companionWorkflowDagBuilder/registry/ioProfiles';
import type {
	CompanionWorkflowNodeTypeV2,
	CompanionWorkflowOutputTypeV2,
} from '@/features/ewa/companionWorkflowDagBuilder/types/companionWorkflowV2';

export type FieldKind = 'text' | 'textarea' | 'number' | 'select' | 'boolean';

export type FieldSection = 'meta' | 'mode' | 'config' | 'inputs' | 'on_error';

export type SchemaField = {
	key: string;
	section: FieldSection;
	kind: FieldKind;
	labelRu: string;
	labelEn: string;
	tooltipRu?: string;
	tooltipEn?: string;
	min?: number;
	max?: number;
	step?: number;
	options?: Array<{ value: string; labelRu: string; labelEn: string }>;
	placeholderSupport?: boolean;
	valueType?: CompanionWorkflowOutputTypeV2;
	required?: boolean;
};

/** Human-readable RU/EN labels for IO profile and inline input keys. */
export const INPUT_FIELD_LABELS: Record<
	string,
	{ labelRu: string; labelEn: string; tooltipRu?: string; tooltipEn?: string }
> = {
	prompt: {
		labelRu: 'Промпт',
		labelEn: 'Prompt',
		tooltipRu: 'Текст запроса или шаблон с {{переменными}}.',
	},
	text: {
		labelRu: 'Текст',
		labelEn: 'Text',
		tooltipRu: 'Основной текстовый вход.',
	},
	body: { labelRu: 'Тело', labelEn: 'Body' },
	reply: { labelRu: 'Ответ', labelEn: 'Reply' },
	user_line: { labelRu: 'Реплика пользователя', labelEn: 'User line' },
	paperless_id: {
		labelRu: 'ID документа Paperless',
		labelEn: 'Paperless document ID',
		tooltipRu: 'Числовой идентификатор документа в каталоге.',
	},
	unified_content_id: {
		labelRu: 'Unified content ID',
		labelEn: 'Unified content ID',
		tooltipRu: 'Идентификатор контента после импорта.',
	},
	document_id: { labelRu: 'ID документа', labelEn: 'Document ID' },
	filename: { labelRu: 'Имя файла', labelEn: 'Filename' },
	mime_type: { labelRu: 'MIME-тип', labelEn: 'MIME type' },
	file_base64: {
		labelRu: 'Файл (Base64)',
		labelEn: 'File (Base64)',
		tooltipRu: 'Содержимое файла в Base64, если нет ID.',
	},
	message_text: { labelRu: 'Текст сообщения', labelEn: 'Message text' },
	chat_id: {
		labelRu: 'Chat ID Telegram',
		labelEn: 'Telegram chat ID',
		tooltipRu: 'Идентификатор чата или канала.',
	},
	to: { labelRu: 'Кому (email)', labelEn: 'To (email)' },
	subject: { labelRu: 'Тема письма', labelEn: 'Email subject' },
	html: { labelRu: 'HTML-тело', labelEn: 'HTML body' },
	image_url: { labelRu: 'URL изображения', labelEn: 'Image URL' },
	attachment_id: { labelRu: 'ID вложения', labelEn: 'Attachment ID' },
	question: { labelRu: 'Вопрос', labelEn: 'Question' },
	data_base64: { labelRu: 'Изображение (Base64)', labelEn: 'Image (Base64)' },
	instruction: { labelRu: 'Инструкция', labelEn: 'Instruction' },
	categories: { labelRu: 'Категории', labelEn: 'Categories' },
	labels: { labelRu: 'Метки', labelEn: 'Labels' },
	rules: { labelRu: 'Правила', labelEn: 'Rules' },
	contains: { labelRu: 'Содержит', labelEn: 'Contains' },
	items: { labelRu: 'Элементы (JSON)', labelEn: 'Items (JSON)' },
	value: {
		labelRu: 'Значение',
		labelEn: 'Value',
		tooltipRu: 'JSON или текст для преобразования.',
	},
	input: { labelRu: 'Вход', labelEn: 'Input' },
	find: {
		labelRu: 'Найти',
		labelEn: 'Find',
		tooltipRu: 'Подстрока для string_replace.',
	},
	replace: { labelRu: 'Заменить на', labelEn: 'Replace with' },
	needle: {
		labelRu: 'Игла поиска',
		labelEn: 'Needle',
		tooltipRu: 'Подстрока для фильтра массива.',
	},
	field: {
		labelRu: 'Поле объекта',
		labelEn: 'Object field',
		tooltipRu: 'Ключ JSON-объекта для pick_field.',
	},
	start: { labelRu: 'Начало среза', labelEn: 'Slice start' },
	end: { labelRu: 'Конец среза', labelEn: 'Slice end' },
	topic: { labelRu: 'Тема', labelEn: 'Topic' },
	title: { labelRu: 'Заголовок', labelEn: 'Title' },
	num_slides: { labelRu: 'Число слайдов', labelEn: 'Slide count' },
	extra_context: { labelRu: 'Доп. контекст', labelEn: 'Extra context' },
};

export const TRANSFORM_OP_OPTIONS: Array<{
	value: string;
	labelRu: string;
	labelEn: string;
}> = [
	{ value: 'identity', labelRu: 'Без изменений', labelEn: 'Identity' },
	{
		value: 'json_stringify',
		labelRu: 'JSON → строка',
		labelEn: 'JSON stringify',
	},
	{ value: 'json_parse', labelRu: 'Строка → JSON', labelEn: 'JSON parse' },
	{ value: 'string_trim', labelRu: 'Обрезка пробелов', labelEn: 'Trim' },
	{ value: 'string_lower', labelRu: 'Нижний регистр', labelEn: 'Lowercase' },
	{ value: 'string_upper', labelRu: 'Верхний регистр', labelEn: 'Uppercase' },
	{
		value: 'string_replace',
		labelRu: 'Замена подстроки',
		labelEn: 'String replace',
	},
	{ value: 'string_slice', labelRu: 'Срез строки', labelEn: 'String slice' },
	{
		value: 'array_filter_contains',
		labelRu: 'Фильтр массива',
		labelEn: 'Array filter',
	},
	{ value: 'array_length', labelRu: 'Длина массива', labelEn: 'Array length' },
	{ value: 'pick_field', labelRu: 'Выбор поля JSON', labelEn: 'Pick field' },
];

function labelForInputKey(
	key: string
): Pick<SchemaField, 'labelRu' | 'labelEn' | 'tooltipRu' | 'tooltipEn'> {
	const entry = INPUT_FIELD_LABELS[key];
	if (entry) {
		return {
			labelRu: entry.labelRu,
			labelEn: entry.labelEn,
			tooltipRu: entry.tooltipRu,
			tooltipEn: entry.tooltipEn,
		};
	}
	return { labelRu: key, labelEn: key };
}

function schemaFieldFromInputKey(
	key: string,
	valueType: CompanionWorkflowOutputTypeV2
): SchemaField {
	const labels = labelForInputKey(key);
	return {
		key,
		section: 'inputs',
		kind:
			valueType === 'number'
				? 'number'
				: key === 'prompt' ||
						key === 'text' ||
						key === 'body' ||
						key === 'value' ||
						key === 'items'
					? 'textarea'
					: 'text',
		...labels,
		placeholderSupport: true,
		valueType,
	};
}

const LLM_CONFIG_FIELDS: SchemaField[] = [
	{
		key: 'temperature',
		section: 'config',
		kind: 'number',
		labelRu: 'Температура',
		labelEn: 'Temperature',
		tooltipRu: 'Случайность ответа модели (0–2).',
		min: 0,
		max: 2,
		step: 0.1,
	},
	{
		key: 'max_tokens',
		section: 'config',
		kind: 'number',
		labelRu: 'Макс. токенов',
		labelEn: 'Max tokens',
		min: 1,
		max: 128000,
		step: 1,
	},
	{
		key: 'top_p',
		section: 'config',
		kind: 'number',
		labelRu: 'Top P',
		labelEn: 'Top P',
		min: 0,
		max: 1,
		step: 0.05,
	},
];

const ON_ERROR_FIELDS: SchemaField[] = [
	{
		key: 'strategy',
		section: 'on_error',
		kind: 'select',
		labelRu: 'При ошибке',
		labelEn: 'On error',
		options: [
			{ value: 'stop', labelRu: 'Остановить', labelEn: 'Stop' },
			{ value: 'retry', labelRu: 'Повторить', labelEn: 'Retry' },
			{
				value: 'fallback_value',
				labelRu: 'Подставить значение',
				labelEn: 'Fallback',
			},
		],
	},
	{
		key: 'max_attempts',
		section: 'on_error',
		kind: 'number',
		labelRu: 'Попыток',
		labelEn: 'Max attempts',
		min: 1,
		max: 5,
		step: 1,
	},
];

const META_FIELDS: SchemaField[] = [
	{
		key: 'title_ru',
		section: 'meta',
		kind: 'text',
		labelRu: 'Название (RU)',
		labelEn: 'Title (RU)',
	},
	{
		key: 'title_en',
		section: 'meta',
		kind: 'text',
		labelRu: 'Название (EN)',
		labelEn: 'Title (EN)',
	},
];

const MODE_FIELD: SchemaField = {
	key: 'mode',
	section: 'mode',
	kind: 'select',
	labelRu: 'Режим',
	labelEn: 'Mode',
	options: [
		{
			value: 'stateful',
			labelRu: 'С сохранением состояния',
			labelEn: 'Stateful',
		},
		{ value: 'stateless', labelRu: 'Без состояния', labelEn: 'Stateless' },
	],
};

function inputSchemaFields(type: CompanionWorkflowNodeTypeV2): SchemaField[] {
	const inlineDefaults: Partial<
		Record<
			CompanionWorkflowNodeTypeV2,
			Record<string, CompanionWorkflowOutputTypeV2>
		>
	> = {
		prompt_gen: { prompt: 'text' },
		logic_filter: { text: 'text', contains: 'string' },
		print_log: { text: 'text' },
		decision: { text: 'text' },
		switch: { text: 'text' },
		for_each: { items: 'json' },
		data_transformer: {
			value: 'json',
			text: 'text',
			input: 'text',
			find: 'string',
			replace: 'string',
			needle: 'string',
			field: 'string',
			start: 'number',
			end: 'number',
		},
	};

	const inline = inlineDefaults[type];
	if (inline) {
		return Object.entries(inline).map(([key, valueType]) =>
			schemaFieldFromInputKey(key, valueType)
		);
	}

	const profile = NODE_INPUT_PROFILE_BY_TYPE[type] ?? 'generic';
	const profileFields = inputFieldsForProfile(profile);
	return Object.entries(profileFields).map(([key, valueType]) =>
		schemaFieldFromInputKey(key, valueType)
	);
}

function typeSpecificConfig(type: CompanionWorkflowNodeTypeV2): SchemaField[] {
	switch (type) {
		case 'prompt_gen':
		case 'image_gen':
		case 'llm_summarizer':
		case 'llm_classifier':
		case 'vision_analyzer':
			return [...LLM_CONFIG_FIELDS];
		case 'delay':
			return [
				{
					key: 'delay_sec',
					section: 'config',
					kind: 'number',
					labelRu: 'Пауза (сек)',
					labelEn: 'Delay (sec)',
					min: 0,
					max: 3600,
					step: 1,
				},
			];
		case 'confirm_gate':
			return [
				{
					key: 'confirm_message_ru',
					section: 'config',
					kind: 'textarea',
					labelRu: 'Сообщение RU',
					labelEn: 'Message RU',
				},
				{
					key: 'confirm_message_en',
					section: 'config',
					kind: 'textarea',
					labelRu: 'Сообщение EN',
					labelEn: 'Message EN',
				},
			];
		case 'decision':
			return [
				{
					key: 'condition_op',
					section: 'config',
					kind: 'select',
					labelRu: 'Оператор',
					labelEn: 'Operator',
					options: [
						{ value: 'eq', labelRu: 'Равно', labelEn: 'eq' },
						{ value: 'ne', labelRu: 'Не равно', labelEn: 'ne' },
						{ value: 'gt', labelRu: 'Больше', labelEn: 'gt' },
						{ value: 'gte', labelRu: 'Больше или равно', labelEn: 'gte' },
						{ value: 'lt', labelRu: 'Меньше', labelEn: 'lt' },
						{ value: 'lte', labelRu: 'Меньше или равно', labelEn: 'lte' },
						{
							value: 'contains',
							labelRu: 'Содержит',
							labelEn: 'contains',
						},
						{
							value: 'length_gt',
							labelRu: 'Длина больше',
							labelEn: 'length_gt',
						},
						{ value: 'truthy', labelRu: 'Истинно', labelEn: 'truthy' },
					],
				},
				{
					key: 'condition_field',
					section: 'config',
					kind: 'text',
					labelRu: 'Поле',
					labelEn: 'Field',
				},
				{
					key: 'condition_value',
					section: 'config',
					kind: 'text',
					labelRu: 'Значение',
					labelEn: 'Value',
				},
				{
					key: 'condition_expression',
					section: 'config',
					kind: 'textarea',
					labelRu: 'Выражение',
					labelEn: 'Expression',
					tooltipRu: 'Булево выражение с {{переменными}}.',
					placeholderSupport: true,
				},
				{
					key: 'condition',
					section: 'config',
					kind: 'text',
					labelRu: 'Метка условия',
					labelEn: 'Condition label',
				},
			];
		case 'switch':
			return [
				{
					key: 'switch_source',
					section: 'config',
					kind: 'text',
					labelRu: 'Поле switch',
					labelEn: 'Switch source field',
				},
				{
					key: 'condition',
					section: 'config',
					kind: 'text',
					labelRu: 'Метка',
					labelEn: 'Label',
				},
			];
		case 'for_each':
			return [
				{
					key: 'items_field',
					section: 'config',
					kind: 'text',
					labelRu: 'Поле items',
					labelEn: 'Items field',
					placeholderSupport: true,
				},
				{
					key: 'max_iterations',
					section: 'config',
					kind: 'number',
					labelRu: 'Макс. итераций',
					labelEn: 'Max iterations',
					min: 1,
					max: 1000,
					step: 1,
				},
			];
		case 'api_call':
			return [
				{
					key: 'tool_name',
					section: 'config',
					kind: 'text',
					labelRu: 'Имя инструмента',
					labelEn: 'Tool name',
					tooltipRu: 'Идентификатор tool_registry.',
				},
			];
		case 'data_transformer':
			return [
				{
					key: 'transform_op',
					section: 'config',
					kind: 'select',
					labelRu: 'Операция',
					labelEn: 'Transform operation',
					tooltipRu: 'Тип преобразования данных.',
					required: true,
					options: TRANSFORM_OP_OPTIONS,
				},
			];
		default:
			return [];
	}
}

const NODE_FIELD_SCHEMAS: Record<CompanionWorkflowNodeTypeV2, SchemaField[]> = {
	prompt_gen: [],
	api_call: [],
	image_gen: [],
	document_import: [],
	pdf_generate: [],
	pdf_parser: [],
	document_extractor: [],
	data_transformer: [],
	telegram_sender: [],
	email_dispatcher: [],
	vision_analyzer: [],
	llm_summarizer: [],
	llm_classifier: [],
	logic_filter: [],
	confirm_gate: [],
	delay: [],
	decision: [],
	switch: [],
	print_log: [],
	for_each: [],
};

for (const type of Object.keys(
	NODE_FIELD_SCHEMAS
) as CompanionWorkflowNodeTypeV2[]) {
	NODE_FIELD_SCHEMAS[type] = [
		...META_FIELDS,
		MODE_FIELD,
		...typeSpecificConfig(type),
		...inputSchemaFields(type),
		...ON_ERROR_FIELDS,
	];
}

export function fieldsForNodeType(
	type: CompanionWorkflowNodeTypeV2
): SchemaField[] {
	return NODE_FIELD_SCHEMAS[type] ?? META_FIELDS;
}

export function fieldsBySection(
	type: CompanionWorkflowNodeTypeV2
): Record<FieldSection, SchemaField[]> {
	const grouped: Record<FieldSection, SchemaField[]> = {
		meta: [],
		mode: [],
		config: [],
		inputs: [],
		on_error: [],
	};
	for (const field of fieldsForNodeType(type)) {
		grouped[field.section].push(field);
	}
	return grouped;
}

export const ALL_NODE_TYPES = Object.keys(
	NODE_FIELD_SCHEMAS
) as CompanionWorkflowNodeTypeV2[];
