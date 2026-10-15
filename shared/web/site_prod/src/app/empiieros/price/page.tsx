/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EmpiierOS price page: on request, no amount.
 */

import type { Metadata } from "next";
import { EmpiierosFrame } from "@/components/EmpiierosFrame";
import { empiierosMeta, empiierosOwner, empiierosPrice } from "@/content/empiieros";

export const metadata: Metadata = {
  title: empiierosMeta.priceTitle,
  description: empiierosMeta.priceDescription,
};

export default function EmpiierosPricePage() {
  return (
    <EmpiierosFrame>
      <h1 className="text-4xl font-medium">{empiierosPrice.title}</h1>
      <p className="mt-4 text-lg text-white/80">{empiierosPrice.lead}</p>
      <p className="mt-4 text-white/80">{empiierosPrice.body}</p>
      <p className="mt-4">
        <a className="text-(--color-accent)" href={`mailto:${empiierosOwner.email}`}>
          {empiierosOwner.email}
        </a>
      </p>
      <p className="mt-4 text-white/70">{empiierosPrice.scopeGap}</p>
      <p className="mt-6 text-sm text-white/50">
        {empiierosPrice.offer} {empiierosFactsLine()}
      </p>
    </EmpiierosFrame>
  );
}

function empiierosFactsLine(): string {
  return "В реестре российского ПО записи нет. Лабораторный образ не является объявленной коммерческой поставкой.";
}
