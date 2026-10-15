/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EmpiierOS functional description for the public site.
 */

import type { Metadata } from "next";
import { EmpiierosFrame } from "@/components/EmpiierosFrame";
import {
  empiierosDescription,
  empiierosFacts,
  empiierosMeta,
} from "@/content/empiieros";

export const metadata: Metadata = {
  title: empiierosMeta.descriptionTitle,
  description: empiierosMeta.descriptionDescription,
};

export default function EmpiierosDescriptionPage() {
  return (
    <EmpiierosFrame>
      <h1 className="text-4xl font-medium">{empiierosDescription.title}</h1>
      <p className="mt-4 text-white/80">{empiierosDescription.lead}</p>
      <h2 className="mt-10 text-2xl font-medium">Среда</h2>
      <p className="mt-3 text-white/80">
        Только {empiierosFacts.arch}. Ядро {empiierosFacts.kernel}. Окружение{" "}
        {empiierosFacts.buildroot}. Профиль {empiierosFacts.profile}. Композитор{" "}
        {empiierosFacts.compositor}.
      </p>
      <p className="mt-3 text-sm text-white/55">
        Лабораторный архив {empiierosFacts.imageDate}: {empiierosFacts.imageSha256}.{" "}
        {empiierosFacts.readiness}.
      </p>
      <h2 className="mt-10 text-2xl font-medium">Функции</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-white/80">
        {empiierosDescription.functions.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h2 className="mt-10 text-2xl font-medium">Граница продукта</h2>
      <p className="mt-3 text-white/80">{empiierosDescription.floor}</p>
    </EmpiierosFrame>
  );
}
