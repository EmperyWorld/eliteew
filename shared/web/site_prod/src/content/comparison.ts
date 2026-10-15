/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Differentiation: cloud cabinet / ready distro vs EmpiierOS on disk.
 *
 * Related:
 * - reestr-mintsifry/11-website/landing-empiieros.md
 */

import type { CtaSpec } from "./types";

export const comparison = {
  id: "comparison",
  eyebrow: "Differentiation · класс продукта",
  title: "Облако, готовый дистрибутив и EmpiierOS",
  intro:
    "Сравнение не про «чей бренд крупнее», а про то, что ставится на диск компьютера и что остаётся отдельным продуктом.",
  audienceChips: [
    "Не Safe Workspace",
    "Не Fedora-киоск",
    "Не мобильный APK",
  ] as const,
  rowsEyebrow: "Дуэль по критериям",
  rowsIntro:
    "Слева — типовая путаница. Справа — EmpiierOS как заявлено в фактах.",
  killerLabel: "Killer argument",
  columns: {
    left: "Облако / готовый дистрибутив",
    right: "EmpiierOS",
  },
  rows: [
    {
      criterion: "Где работает",
      left: "Браузерная вкладка или чужой live-образ",
      right: "Установка на внутренний диск x86_64, локальный графический сеанс",
    },
    {
      criterion: "Основа пола",
      left: "SaaS или готовый Fedora как единственная база",
      right: "Buildroot 2025.02.1, профиль empiieros-shell, ядро 6.12.20",
    },
    {
      criterion: "Реестр и продажи",
      left: "Можно ошибочно ожидать номер и прайс",
      right: "Записи нет; продаж не было; сумма на сайте не публикуется",
    },
    {
      criterion: "Сертификация",
      left: "Можно спутать с СЗИ",
      right: "Сертификата средства защиты информации нет; локальный щит ≠ СЗИ",
    },
  ],
  killerArgument:
    "EmpiierOS — операционная система на диске. EliteEW cloud на app.eliteew.ru, Fedora-киоск и клиент Tauri — другие продукты и в этот образ не входят.",
  tcoNote:
    "Стоимость определяется по запросу после готовности поставки. Состав поставки и срок поддержки не утверждены — без числа на странице.",
  cta: {
    label: "Перейти к порядку цены",
    intent: "tco_table",
    href: "/empiieros/price",
    variant: "secondary",
  } as const satisfies CtaSpec,
} as const;
