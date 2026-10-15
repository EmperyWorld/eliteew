/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Visual metadata for Problem section (leak scenarios + perimeter blind spot).
 *
 * Invariants:
 * - Keys align with problem.scenarios / problem.gaps ids from content.
 * - No fluff marketing words in labels.
 *
 * Related:
 * - ProblemSection.tsx
 * - content/problem.ts
 */

export const PROBLEM_SCENARIO_VISUAL = {
  messenger: {
    eyebrow: "Сценарий мессенджера",
    leakFrom: "Корп. файл",
    leakVia: "Личные мессенджеры",
    leakTo: "Личное облако чата",
    signal: "ИТ не видит канал",
    badge: "Shadow chat",
  },
  cloud: {
    eyebrow: "Сценарий облака",
    leakFrom: "Рабочий документ",
    leakVia: "Личные облака",
    leakTo: "Личный аккаунт",
    signal: "Контроль доступа потерян",
    badge: "Personal cloud",
  },
  copypaste: {
    eyebrow: "Сценарий копипаста",
    leakFrom: "CRM / код / стратегия",
    leakVia: "AI-чат / заметки",
    leakTo: "Внешний сервис",
    signal: "Текст ушёл без агента",
    badge: "AI · paste",
  },
} as const;

export const PROBLEM_GAP_VISUAL = {
  vpn: {
    verdict: "Закрывает дверь",
    blindSpot: "Не видит окна: личный мессенджер внутри «доверенного» канала",
    tone: "door" as const,
  },
  dlp: {
    verdict: "Ставит агент на endpoint",
    blindSpot: "Ломается на BYOD: личное устройство ≠ корпоративный контроль",
    tone: "agent" as const,
  },
} as const;

export type ProblemScenarioId = keyof typeof PROBLEM_SCENARIO_VISUAL;
export type ProblemGapId = keyof typeof PROBLEM_GAP_VISUAL;

export function hasVisualForScenario(id: string): id is ProblemScenarioId {
  return id in PROBLEM_SCENARIO_VISUAL;
}

export function hasVisualForGap(id: string): id is ProblemGapId {
  return id in PROBLEM_GAP_VISUAL;
}

/** Door-vs-windows perimeter diagram (Visualizing the Leak). */
export const PROBLEM_PERIMETER_META = {
  eyebrow: "Visualizing the Leak",
  contrastHint: "дверь закрыта · окна открыты",
  caption: "Закрываете дверь — пока окна открыты настежь",
  door: {
    label: "Дверь · периметр",
    title: "VPN / Firewall",
    body: "Канал («труба») защищён. Легитимный личный мессенджер проходит как доверенный трафик — содержимое внутри не видно.",
    status: "Дверь закрыта · ИТ спокоен",
  },
  windows: {
    label: "Окна · Shadow IT",
    title: "Мессенджеры · облака · AI",
    body: "Данные уходят через личные аккаунты на устройстве сотрудника. Классический периметр эти окна не закрывает.",
    status: "Окна открыты · утечка идёт",
    channels: [
      { label: "Мессенджер", hint: "файл.pdf" },
      { label: "Drive", hint: "CRM.xlsx" },
      { label: "AI-чат", hint: "фрагмент" },
    ],
  },
} as const;
