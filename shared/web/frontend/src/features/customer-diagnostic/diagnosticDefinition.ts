import extractedQuestions from './extractedQuestions.json';
import type {
	DiagnosticModuleId,
	EmotionWheelEntry,
	JourneyStage,
} from './diagnosticTypes';

export const DIAGNOSTIC_CONTENT_VERSION = 1 as const;

export const DIAGNOSTIC_MODULE_ORDER: DiagnosticModuleId[] = [
	'archetype',
	'values',
	'business',
	'service',
	'emotions',
];

export const MODULE_LABELS: Record<DiagnosticModuleId, string> = {
	archetype: 'Архетип бренда',
	values: 'ДНК ценностей',
	business: 'Экспресс-бизнес',
	service: 'Диагностика сервиса',
	emotions: 'Карта эмоций',
};

export const MODULE_DESCRIPTIONS: Record<DiagnosticModuleId, string> = {
	archetype:
		'Определение доминирующего архетипа бренда по методологии архетипов.',
	values: 'Профиль ценностей по мотивационной карте (Шварц-подобная модель).',
	business: 'Пять областей: стратегия, операции, клиент, ценности, финансы.',
	service: 'SERVQUAL: ожидания и восприятие, усилия клиента.',
	emotions: 'Эмоции и влияние по выбранным этапам customer journey.',
};

/** Как в celzrel `moduleDef.icon` (emoji, без CDN). */
export const MODULE_ICONS: Record<DiagnosticModuleId, string> = {
	archetype: '🎭',
	values: '💎',
	business: '📈',
	service: '🎯',
	emotions: '❤️',
};

/** Маппинг вопросов к архетипам — как в `ArchetypeModule` celzrel. */
export const ARCHETYPE_QUESTION_MAPPING: Record<string, number[]> = {
	innocent: [1, 5, 9, 13, 17, 21],
	explorer: [2, 6, 10, 14, 18, 22],
	sage: [3, 7, 11, 15, 19, 23],
	hero: [4, 8, 12, 16, 20, 24],
	outlaw: [1, 6, 11, 16, 21, 22],
	magician: [2, 7, 12, 17, 22, 23],
	regular: [3, 8, 13, 18, 23, 24],
	lover: [4, 9, 14, 19, 24, 1],
	jester: [5, 10, 15, 20, 1, 2],
	caregiver: [6, 11, 16, 21, 2, 3],
	creator: [7, 12, 17, 22, 3, 4],
	ruler: [8, 13, 18, 23, 4, 5],
};

export const ARCHETYPE_CATALOG: Record<
	string,
	{ name: string; description: string; color: string }
> = {
	innocent: {
		name: 'Невинный',
		description: 'Стремится к простоте, честности и искренности',
		color: '#87CEEB',
	},
	explorer: {
		name: 'Искатель',
		description: 'Ценит свободу, открытия и новые впечатления',
		color: '#228B22',
	},
	sage: {
		name: 'Мудрец',
		description: 'Стремится к знанию, истине и пониманию',
		color: '#4169E1',
	},
	hero: {
		name: 'Герой',
		description: 'Стремится к достижениям и преодолению вызовов',
		color: '#FF4500',
	},
	outlaw: {
		name: 'Бунтарь',
		description: 'Нарушает правила и изменяет мир',
		color: '#8B0000',
	},
	magician: {
		name: 'Маг',
		description: 'Делает мечты реальностью через инновации',
		color: '#9932CC',
	},
	regular: {
		name: 'Обычный парень',
		description: 'Ценит принадлежность и простые удовольствия',
		color: '#DAA520',
	},
	lover: {
		name: 'Любовник',
		description: 'Стремится к близости, страсти и любви',
		color: '#DC143C',
	},
	jester: {
		name: 'Шут',
		description: 'Приносит радость и веселье в мир',
		color: '#FFD700',
	},
	caregiver: {
		name: 'Заботливый',
		description: 'Помогает и защищает других',
		color: '#98FB98',
	},
	creator: {
		name: 'Творец',
		description: 'Создает нечто ценное и долговечное',
		color: '#FF69B4',
	},
	ruler: {
		name: 'Правитель',
		description: 'Стремится к контролю и лидерству',
		color: '#800080',
	},
};

export const BUSINESS_AREAS: Record<
	string,
	{ name: string; description: string; icon: string; color: string }
> = {
	strategy: {
		name: 'Стратегия и ценностное предложение',
		description:
			'Ясность миссии, видения и уникального ценностного предложения',
		icon: '\u{1F3AF}',
		color: '#FF6B35',
	},
	operations: {
		name: 'Операционная эффективность',
		description: 'Эффективность бизнес-процессов и операционной деятельности',
		icon: '\u{2699}\u{FE0F}',
		color: '#26A69A',
	},
	customer: {
		name: 'Клиентский опыт и лояльность',
		description: 'Качество взаимодействия с клиентами и их удовлетворенность',
		icon: '\u{1F465}',
		color: '#7E57C2',
	},
	values: {
		name: 'Ценностная система управления',
		description: 'Корпоративная культура и ценности в управлении',
		icon: '\u{1F48E}',
		color: '#FF8C00',
	},
	finance: {
		name: 'Финансовое здоровье',
		description: 'Финансовая устойчивость и эффективность',
		icon: '\u{1F4B0}',
		color: '#66BB6A',
	},
};

export const INDUSTRY_BENCHMARKS: Record<string, Record<string, number>> = {
	retail: {
		strategy: 75,
		operations: 70,
		customer: 80,
		values: 65,
		finance: 70,
	},
	it: {
		strategy: 85,
		operations: 80,
		customer: 75,
		values: 75,
		finance: 75,
	},
	manufacturing: {
		strategy: 70,
		operations: 85,
		customer: 65,
		values: 70,
		finance: 80,
	},
	finance: {
		strategy: 80,
		operations: 75,
		customer: 85,
		values: 85,
		finance: 90,
	},
	healthcare: {
		strategy: 75,
		operations: 80,
		customer: 90,
		values: 85,
		finance: 75,
	},
	consulting: {
		strategy: 90,
		operations: 70,
		customer: 85,
		values: 80,
		finance: 70,
	},
	default: {
		strategy: 75,
		operations: 75,
		customer: 75,
		values: 75,
		finance: 75,
	},
};

export const SERVQUAL_DIMENSIONS: Record<
	string,
	{ name: string; description: string; color: string; icon: string }
> = {
	tangibles: {
		name: 'Материальность',
		description: 'Внешний вид оборудования, персонала, материалов',
		color: '#FF6B35',
		icon: '\u{1F3E2}',
	},
	reliability: {
		name: 'Надежность',
		description: 'Способность выполнять обещанное точно и надежно',
		color: '#26A69A',
		icon: '\u{1F3AF}',
	},
	responsiveness: {
		name: 'Отзывчивость',
		description: 'Готовность помочь клиентам и предоставить быстрый сервис',
		color: '#7E57C2',
		icon: '\u{26A1}',
	},
	assurance: {
		name: 'Уверенность',
		description: 'Знания, вежливость и способность внушать доверие',
		color: '#42A5F5',
		icon: '\u{1F6E1}\u{FE0F}',
	},
	empathy: {
		name: 'Эмпатия',
		description: 'Индивидуальное внимание и забота о клиентах',
		color: '#EC407A',
		icon: '\u{1F49A}',
	},
	effort: {
		name: 'Усилия клиента',
		description: 'Насколько легко клиентам взаимодействовать с вами',
		color: '#FFA726',
		icon: '\u{1F4AA}',
	},
};

export const EMOTIONS_WHEEL: Record<string, EmotionWheelEntry> = {
	joy: {
		name: 'Радость',
		color: '#FFD700',
		valence: 1,
		description: 'Положительные эмоции удовлетворения и счастья',
	},
	trust: {
		name: 'Доверие',
		color: '#32CD32',
		valence: 1,
		description: 'Чувство безопасности и уверенности',
	},
	fear: {
		name: 'Страх',
		color: '#8B0000',
		valence: -1,
		description: 'Беспокойство и тревога',
	},
	surprise: {
		name: 'Удивление',
		color: '#FF69B4',
		valence: 0,
		description: 'Неожиданность и новизна',
	},
	sadness: {
		name: 'Печаль',
		color: '#4169E1',
		valence: -1,
		description: 'Разочарование и грусть',
	},
	disgust: {
		name: 'Отвращение',
		color: '#9932CC',
		valence: -1,
		description: 'Неприятие и отторжение',
	},
	anger: {
		name: 'Гнев',
		color: '#FF4500',
		valence: -1,
		description: 'Раздражение и злость',
	},
	anticipation: {
		name: 'Ожидание',
		color: '#FF8C00',
		valence: 0,
		description: 'Предвкушение и интерес',
	},
};

export const EMOTIONS_JOURNEY_STAGES: JourneyStage[] = [
	{
		id: 'awareness',
		name: 'Осведомленность',
		description: 'Клиент узнает о проблеме и ищет решения',
		icon: '\u{1F4A1}',
	},
	{
		id: 'consideration',
		name: 'Рассмотрение',
		description: 'Клиент изучает варианты и сравнивает предложения',
		icon: '\u{1F50D}',
	},
	{
		id: 'decision',
		name: 'Принятие решения',
		description: 'Клиент выбирает поставщика и принимает решение о покупке',
		icon: '\u{2705}',
	},
	{
		id: 'purchase',
		name: 'Покупка',
		description: 'Процесс оформления и оплаты заказа',
		icon: '\u{1F4B3}',
	},
	{
		id: 'onboarding',
		name: 'Внедрение',
		description: 'Первое знакомство с продуктом/услугой',
		icon: '\u{1F680}',
	},
	{
		id: 'usage',
		name: 'Использование',
		description: 'Регулярное взаимодействие с продуктом/услугой',
		icon: '\u{2699}\u{FE0F}',
	},
	{
		id: 'support',
		name: 'Поддержка',
		description: 'Обращения в службу поддержки и решение проблем',
		icon: '\u{1F198}',
	},
	{
		id: 'renewal',
		name: 'Продление',
		description: 'Решение о продлении или повторной покупке',
		icon: '\u{1F504}',
	},
	{
		id: 'advocacy',
		name: 'Адвокатство',
		description: 'Рекомендации другим и лояльность',
		icon: '\u{1F4E2}',
	},
];

type Extracted = typeof extractedQuestions;

export const QUESTIONS = {
	archetype: extractedQuestions.archetype as Extracted['archetype'],
	values: extractedQuestions.values as Extracted['values'],
	business: extractedQuestions.business as Extracted['business'],
	service: extractedQuestions.service as Extracted['service'],
};

export function getIndustryBenchmark(
	industry: string | undefined,
	area: string
): number {
	const key = industry && INDUSTRY_BENCHMARKS[industry] ? industry : 'default';
	const table = INDUSTRY_BENCHMARKS[key] ?? INDUSTRY_BENCHMARKS.default;
	return table[area] ?? INDUSTRY_BENCHMARKS.default[area] ?? 75;
}
