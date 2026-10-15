/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EmpiierOS supply readiness quiz (qualitative, not legal audit).
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md §CTA ladder
 */

export type QuizOption = {
  id: string;
  label: string;
  score: number;
};

export type QuizQuestion = {
  id: string;
  shortLabel: string;
  prompt: string;
  options: readonly QuizOption[];
};

export const quiz = {
  id: "quiz",
  eyebrow: "Лёгкий вход · готовность",
  flowHint: "5 вопросов · профиль на экране",
  title: "Экспресс-проверка готовности к поставке",
  description:
    "Пять коротких вопросов про x86_64, диск и ожидания реестра. Результат — профиль запроса. Это не юридический аудит и не заявка в реестр.",
  chips: [
    "5 вопросов",
    "Профиль на экране",
    "Не юридический аудит",
    "Без прайса на сайте",
  ],
  questions: [
    {
      id: "messengers",
      shortLabel: "Архитектура",
      prompt: "Нужна ли именно операционная система на диске x86_64, а не облачная вкладка?",
      options: [
        { id: "often", label: "Да, локальный диск", score: 0 },
        { id: "sometimes", label: "Смешанный сценарий", score: 2 },
        { id: "rare", label: "Достаточно облака", score: 3 },
      ],
    },
    {
      id: "byod",
      shortLabel: "UEFI",
      prompt: "Есть ли целевые компьютеры с UEFI и внутренним диском под установку?",
      options: [
        { id: "yes", label: "Да, парк готов", score: 0 },
        { id: "partial", label: "Частично", score: 2 },
        { id: "no", label: "Пока нет", score: 3 },
      ],
    },
    {
      id: "dlp",
      shortLabel: "Реестр",
      prompt: "Нужен ли уже сейчас номер записи в реестре российского ПО?",
      options: [
        { id: "no", label: "Понимаем, что записи нет", score: 0 },
        { id: "partial", label: "Нужен в перспективе", score: 2 },
        { id: "yes", label: "Нужен немедленно", score: 3 },
      ],
    },
    {
      id: "size",
      shortLabel: "Цена",
      prompt: "Готовы ли запросить порядок цены без опубликованной суммы на сайте?",
      options: [
        { id: "mid", label: "Да", score: 0 },
        { id: "large", label: "Нужен прайс-лист с цифрой", score: 3 },
        { id: "small", label: "Пока изучаем", score: 1 },
      ],
    },
    {
      id: "pilot",
      shortLabel: "Приёмка",
      prompt: "Принимаете ли статус NOT_READY: приёмка на произвольном ПК не закрыта?",
      options: [
        { id: "ready", label: "Да, запросим поставку осознанно", score: 0 },
        { id: "explore", label: "Нужны материалы", score: 1 },
        { id: "blocked", label: "Нужна гарантия на любом железе", score: 3 },
      ],
    },
  ] as const satisfies readonly QuizQuestion[],
} as const;

export type RiskProfileId = "low" | "medium" | "high";

export const riskProfiles: Record<
  RiskProfileId,
  { title: string; summary: string; maxScoreInclusive: number }
> = {
  low: {
    title: "Профиль совпадает с фактами",
    summary:
      "Локальный x86_64, понимание отсутствия реестра и цены по запросу. Имеет смысл отправить комбинированный запрос на описание и порядок поставки.",
    maxScoreInclusive: 4,
  },
  medium: {
    title: "Средний разрыв ожиданий",
    summary:
      "Есть вопросы по железу, реестру или прайсу. Начните с /empiieros/description и страницы цены — без суммы на сайте.",
    maxScoreInclusive: 9,
  },
  high: {
    title: "Высокий разрыв · нужны материалы",
    summary:
      "Ожидания реестра, фиксированной цены или приёмки на любом ПК расходятся с опубликованными фактами. Запросите материалы до закупки.",
    maxScoreInclusive: 99,
  },
};
