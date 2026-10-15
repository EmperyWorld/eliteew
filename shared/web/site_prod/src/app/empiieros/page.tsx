/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EmpiierOS landing route. Safe Workspace home stays at `/`.
 */

import type { Metadata } from "next";
import { EmpiierosFrame } from "@/components/EmpiierosFrame";
import {
  empiierosFacts,
  empiierosHome,
  empiierosMeta,
  empiierosPaths,
} from "@/content/empiieros";

export const metadata: Metadata = {
  title: empiierosMeta.homeTitle,
  description: empiierosMeta.homeDescription,
};

export default function EmpiierosHomePage() {
  return (
    <EmpiierosFrame>
      <p className="text-xs uppercase tracking-[0.14em] text-(--color-accent)">
        {empiierosHome.kicker}
      </p>
      <h1 className="mt-2 text-4xl font-medium">{empiierosHome.title}</h1>
      <p className="mt-4 text-lg text-white/70">{empiierosHome.lead}</p>
      <p className="mt-4 text-sm">
        <a className="text-(--color-accent)" href={empiierosPaths.description}>
          Описание
        </a>
        {" · "}
        <a className="text-(--color-accent)" href={empiierosPaths.price}>
          Цена по запросу
        </a>
        {" · "}
        <a className="text-(--color-accent)" href={empiierosPaths.docs}>
          Документы
        </a>
      </p>
      <h2 className="mt-10 text-2xl font-medium">Для кого</h2>
      <p className="mt-3 text-white/80">{empiierosHome.forWhom}</p>
      <h2 className="mt-10 text-2xl font-medium">Состав</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-white/80">
        {empiierosHome.includes.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h2 className="mt-10 text-2xl font-medium">Чем не является</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-white/80">
        {empiierosHome.excludes.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h2 className="mt-10 text-2xl font-medium">Состояние</h2>
      <p className="mt-3 text-white/80">
        Коммерческих продаж не было. Лабораторный архив {empiierosFacts.imageDate} имеет
        хеш {empiierosFacts.imageSha256}. {empiierosFacts.readiness}.
      </p>
    </EmpiierosFrame>
  );
}
