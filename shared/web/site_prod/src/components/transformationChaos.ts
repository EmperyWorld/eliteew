/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Scene model for TransformationScene — Shadow IT chaos + Safe Workspace dome copy.
 *
 * Invariants:
 * - Chaos labels are generic channel types (no real product / company trademarks).
 * - Dome copy uses separation language, not surveillance.
 *
 * Related:
 * - TransformationScene.tsx
 * - documentation/product/SITE-PROD-LANDING.md §Visual
 */

export const TRANSFORM_CHAOS_CHANNELS = [
  "Мессенджер A",
  "Мессенджер B",
  "Облако A",
  "Облако B",
  "AI-чат",
] as const;

export type ChaosChannel = (typeof TRANSFORM_CHAOS_CHANNELS)[number];

export function isShadowItChaosLabel(label: string): boolean {
  return TRANSFORM_CHAOS_CHANNELS.some((ch) => label.includes(ch));
}

export const CHAOS_BROWSER_TABS = [
  { id: "msg-a", title: "Мессенджер · Web", accent: "#67E8F9" },
  { id: "photos", title: "Фото · личное", accent: "#A78BFA" },
  { id: "cloud-a", title: "Облако A", accent: "#FBBF24" },
  { id: "ai", title: "AI-чат", accent: "#5EEAD4" },
  { id: "msg-b", title: "Мессенджер B", accent: "#FDA4AF" },
] as const;

export const CHAOS_PHOTOS = [
  {
    id: "vacation",
    label: "Отпуск · 2025",
    tint: "#5b6b8c",
    className: "absolute left-[4%] top-[8%] h-[28%] w-[22%]",
  },
  {
    id: "family",
    label: "Семья",
    tint: "#3d5a4a",
    className: "absolute left-[28%] top-[6%] h-[22%] w-[18%]",
  },
  {
    id: "screenshot",
    label: "Скрин · чат",
    tint: "#6b4f3a",
    className: "absolute right-[6%] top-[10%] h-[26%] w-[24%]",
  },
  {
    id: "docs",
    label: "Документы",
    tint: "#3a4560",
    className: "absolute bottom-[22%] left-[8%] h-[24%] w-[20%]",
  },
  {
    id: "gallery",
    label: "Галерея",
    tint: "#4a3d5c",
    className: "absolute bottom-[18%] right-[10%] h-[30%] w-[26%]",
  },
] as const;

export const CHAOS_CHATS = [
  {
    id: "msg-a-file",
    channel: "Мессенджер A" as const,
    preview: "файл.pdf · база клиентов",
    meta: "сейчас",
    risk: "корп. файл",
  },
  {
    id: "msg-b-doc",
    channel: "Мессенджер B" as const,
    preview: "договор.docx · «скинь на почту»",
    meta: "2 мин",
    risk: "договор",
  },
  {
    id: "ai-leak",
    channel: "AI-чат" as const,
    preview: "вставка: фрагмент стратегии",
    meta: "сегодня",
    risk: "IP · наружу",
  },
] as const;

export const CHAOS_FILES = [
  {
    id: "crm",
    channel: "Облако A" as const,
    name: "CRM.xlsx",
    where: "Личное облако",
    risk: true,
  },
  {
    id: "deck",
    channel: "Облако B" as const,
    name: "стратегия.pptx",
    where: "Облако · личное",
    risk: true,
  },
  {
    id: "photo",
    channel: "Photos" as const,
    name: "IMG_2841.jpg",
    where: "Камера",
    risk: false,
  },
] as const;

export const CHAOS_NOTIFICATIONS = [
  { id: "n1", app: "Мессенджер A", text: "Новый файл в «Работа»", risk: true },
  { id: "n2", app: "Photos", text: "Резервная копия · 240 фото", risk: false },
  { id: "n3", app: "Мессенджер B", text: "Документ от коллеги", risk: true },
] as const;

export const CHAOS_DOCK = [
  { id: "photos", label: "Фото" },
  { id: "chats", label: "Чаты" },
  { id: "files", label: "Файлы" },
  { id: "browser", label: "Браузер" },
] as const;

export const DOME_META = {
  productLine: "EmpiierOS · local seat",
  title: "Локальное кресло поверх облачной путаницы",
  sessionEyebrow: "Сеанс",
  sessionLabel: "Wayland · Active",
  filesEyebrow: "Файлы на диске",
  filesLock: "в разделе состояния LUKS",
  appsEyebrow: "Приложения кресла",
  pillarsEyebrow: "Инварианты ОС",
  resetHint: "Снять слой · снова увидеть облако",
} as const;

export const DOME_APPS = [
  {
    id: "mail",
    step: "01",
    label: "Корп. почта",
    status: "в сессии",
    hint: "без локального кэша на ОС",
    icon: "mail" as const,
  },
  {
    id: "files",
    step: "02",
    label: "Файлы сессии",
    status: "в сессии",
    hint: "только внутри купола",
    icon: "files" as const,
  },
  {
    id: "crm",
    step: "03",
    label: "CRM",
    status: "в сессии",
    hint: "без выгрузки наружу",
    icon: "crm" as const,
  },
  {
    id: "meet",
    step: "04",
    label: "Встречи",
    status: "в сессии",
    hint: "изолированный канал",
    icon: "meet" as const,
  },
] as const;

export const DOME_SESSION_FILES = [
  { id: "f1", name: "Договор_Q3.pdf", kind: "Документ", tone: "doc" as const },
  { id: "f2", name: "Клиенты_CRM.xlsx", kind: "Таблица", tone: "sheet" as const },
  { id: "f3", name: "Политика_ИБ.md", kind: "Политика", tone: "policy" as const },
] as const;

export const DOME_PILLARS = [
  { step: "01", label: "Пол Buildroot" },
  { step: "02", label: "Диск · LUKS" },
  { step: "03", label: "Русское кресло" },
] as const;

export type DomeAppId = (typeof DOME_APPS)[number]["id"];

/** Imitation in-session job UI rows (metaphor demo — not a live client). */
export const DOME_JOB_VIEWS: Record<
  DomeAppId,
  {
    eyebrow: string;
    headline: string;
    rows: readonly { title: string; meta: string; status: string }[];
  }
> = {
  mail: {
    eyebrow: "Имитация · почта",
    headline: "Входящие рабочей сессии",
    rows: [
      {
        title: "Re: Договор Q3",
        meta: "юрист · 09:12",
        status: "в куполе",
      },
      {
        title: "Запрос поставки EmpiierOS",
        meta: "CISO · 08:40",
        status: "в куполе",
      },
      {
        title: "Чеклист ИБ",
        meta: "compliance · вчера",
        status: "в куполе",
      },
    ],
  },
  files: {
    eyebrow: "Имитация · файлы",
    headline: "Каталог сессии (рабочий контур)",
    rows: [
      {
        title: "Договор_Q3.pdf",
        meta: "PDF · 1.2 МБ",
        status: "locked",
      },
      {
        title: "Клиенты_CRM.xlsx",
        meta: "Таблица · 840 КБ",
        status: "locked",
      },
      {
        title: "Политика_ИБ.md",
        meta: "Markdown · 18 КБ",
        status: "locked",
      },
    ],
  },
  crm: {
    eyebrow: "Имитация · CRM",
    headline: "Карточки только в сессии",
    rows: [
      {
        title: "Сделка · пилот",
        meta: "этап Discovery",
        status: "session",
      },
      {
        title: "Контакт · ЛПР",
        meta: "CISO / ИБ",
        status: "session",
      },
      {
        title: "Заметка · риски BYOD",
        meta: "внутренняя",
        status: "session",
      },
    ],
  },
  meet: {
    eyebrow: "Имитация · встречи",
    headline: "Календарь изолированного канала",
    rows: [
      {
        title: "Описание для реестра",
        meta: "сегодня · 11:00",
        status: "scheduled",
      },
      {
        title: "Разбор PoC",
        meta: "чт · 15:30",
        status: "scheduled",
      },
      {
        title: "Q&A для ИБ",
        meta: "пт · 10:00",
        status: "scheduled",
      },
    ],
  },
};

export const CHAOS_PHOTO_DETAILS: Record<
  (typeof CHAOS_PHOTOS)[number]["id"],
  { risk: string; channel: string }
> = {
  vacation: {
    risk: "Личная галерея рядом с рабочими скринами",
    channel: "Фото · личное",
  },
  family: {
    risk: "Семейный альбом смешивается с корп. контекстом",
    channel: "Фото · личное",
  },
  screenshot: {
    risk: "Скрин чата может унести корп. фрагмент",
    channel: "Скрин · чат",
  },
  docs: {
    risk: "Документы на личном столе вне периметра",
    channel: "Файлы · личные",
  },
  gallery: {
    risk: "Галерея — слепая зона для классического DLP",
    channel: "Галерея",
  },
};

/** Every Shadow IT channel must appear somewhere in the chaos layer. */
export function chaosLayerMentionsAllChannels(): boolean {
  const blob = [
    ...CHAOS_BROWSER_TABS.map((t) => t.title),
    ...CHAOS_CHATS.map((c) => `${c.channel} ${c.preview}`),
    ...CHAOS_FILES.map((f) => `${f.channel} ${f.name} ${f.where}`),
    ...CHAOS_NOTIFICATIONS.map((n) => `${n.app} ${n.text}`),
  ].join(" ");
  return TRANSFORM_CHAOS_CHANNELS.every((ch) => blob.includes(ch));
}
