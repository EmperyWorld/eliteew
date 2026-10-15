/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EmpiierOS docs index. Links only; does not remove Safe Workspace sections.
 */

import type { Metadata } from "next";
import { EmpiierosFrame } from "@/components/EmpiierosFrame";
import {
  empiierosFacts,
  empiierosMeta,
  empiierosOwner,
  empiierosPaths,
} from "@/content/empiieros";

export const metadata: Metadata = {
  title: empiierosMeta.docsTitle,
  description: empiierosMeta.docsDescription,
};

const links = [
  { href: empiierosPaths.description, label: "Описание и функции" },
  { href: empiierosPaths.price, label: "Цена по запросу" },
] as const;

export default function EmpiierosDocsPage() {
  return (
    <EmpiierosFrame>
      <h1 className="text-4xl font-medium">Документы</h1>
      <ul className="mt-6 space-y-2">
        {links.map((item) => (
          <li key={item.href}>
            <a className="text-(--color-accent)" href={item.href}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
      <h2 className="mt-10 text-2xl font-medium">Что уже известно</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-white/80">
        <li>Архитектура {empiierosFacts.arch}, загрузка UEFI.</li>
        <li>Внутренний диск можно стереть при установке. USB-носитель целью не является.</li>
        <li>Сеть не обязательна для локального кресла.</li>
        <li>Язык оболочки по умолчанию — русский.</li>
      </ul>
      <p className="mt-4 text-sm text-white/55">
        Объём памяти, минимальный диск и список проверенных компьютеров не опубликованы.
      </p>
      <h2 className="mt-10 text-2xl font-medium">Поддержка</h2>
      <p className="mt-3 text-white/80">
        {empiierosOwner.status} {empiierosOwner.name}. Письмо {empiierosOwner.email}.
        Телефон {empiierosOwner.phone}. Часы {empiierosOwner.hours}.
      </p>
    </EmpiierosFrame>
  );
}
