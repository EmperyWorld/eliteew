/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Combined contact pack for EmpiierOS supply / materials request.
 *
 * Related:
 * - CombinedLeadSection.tsx
 */

export const contactPack = {
  id: "contact",
  eyebrow: "Contact · один пакет",
  flowHint: "описание · poc · цена",
  title: "Запросите описание, порядок цены или материалы одним контактом",
  intro:
    "Отметьте нужное — отправим комбинированный запрос на lady_boss@eliteew.ru. Сумма и номер реестра на сайте не публикуются.",
  interestsLegend: "Что включить в пакет",
  fieldsLegend: "Как с вами связаться",
  submitLabel: "Отправить комбинированный запрос",
  submitLoading: "Отправка…",
  successTitle: "Пакет принят",
  successHint:
    "Свяжемся по контакту по порядку поставки. Часы поддержки на сайте не опубликованы — ответим в рабочем порядке.",
  trustNotes: [
    "Один POST · intent=bundle",
    "Не оферта",
    "Privacy рядом с формой",
    "Без прайса на странице",
  ],
  emptyInterestsError: "Выберите хотя бы один материал или формат запроса.",
} as const;
