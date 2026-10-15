/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Site-wide brand, ToV locks, and privacy policy copy for eliteew.ru site_prod.
 *
 * Invariants:
 * - Product name is EmpiierOS on public landing; cloud cabinet stays app.eliteew.ru.
 * - No registry number, no price amount, no commercial sales claim.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md
 */

export const brand = {
  productName: "EmpiierOS",
  companyName: "Empery World",
  positioning: "операционная система",
  tagline: "Рабочее место на диске компьютера",
  publicUrl: "https://eliteew.ru",
  appUrl: "https://app.eliteew.ru",
  sourceUrl: "https://github.com/EmperyWorld/eliteew",
} as const;

export const vocabulary = {
  prefer: [
    "операционная система",
    "пол из исходников Linux",
    "графическое рабочее место",
    "установка на диск",
    "русская оболочка",
    "x86_64",
  ],
  forbidden: [
    "уникальный",
    "революционный",
    "лучший",
    "инновационный",
    "100% защиту",
    "гарантируем безопасность",
    "включена в реестр",
    "сертифицированное средство защиты",
  ],
} as const;

export const privacyPanel = {
  title: "Конфиденциальность",
  lead:
    "Публичный сайт собирает только то, что вы сами указываете в форме запроса. Это не телеметрия ОС и не мониторинг браузера.",
  collect: [
    "Контактные данные из формы (имя, email, телефон — по полям формы)",
    "Контекст запроса: intent / интересы (описание, цена, материалы) и ответы квиза готовности, если вы его прошли",
  ],
  never: [
    "Не читаем личный контент браузера и мессенджеров",
    "Не устанавливаем агенты контроля на ваш компьютер с этой страницы",
    "Не продаём заявки третьим лицам",
  ],
  contactHref: "#contact",
  contactLabel: "Вопрос по обработке данных",
} as const;

/** Short notice for lead forms (same policy as privacyPanel). */
export const privacyNotice =
  "Мы собираем только контактные данные, которые вы указываете в форме, чтобы связаться по запросу поставки или материалов. Мы не читаем личный контент вашего браузера и не устанавливаем агенты с этой страницы.";
