/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Hero Layering demo: personal BYOD desktop chaos → Safe Workspace glass dome (one click).
 * Stage chrome A/B explains Layering before the interactive device frame.
 *
 * Invariants:
 * - CSS/SVG only (no heavy imagery); reduced-motion short-circuits float/scale loops.
 * - Chaos stays under the dome (blurred) — Layering, not a hard cutaway.
 * - Metaphor demo only — not a live desktop client; Stage A photos + Stage B apps are clickable imitation UI.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md §Visual
 * - transformVisual.ts · transformationChaos.ts
 * - /home/owned/site_doc Layering / One Click Transformation
 */

"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Cloud,
  FileSpreadsheet,
  FileText,
  FolderLock,
  ImageIcon,
  Lock,
  Mail,
  MessageCircle,
  ArrowRight,
  Shield,
  Users,
  Video,
} from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { SessionStatus } from "@/components/SessionStatus";
import {
  CHAOS_BROWSER_TABS,
  CHAOS_CHATS,
  CHAOS_DOCK,
  CHAOS_FILES,
  CHAOS_NOTIFICATIONS,
  CHAOS_PHOTO_DETAILS,
  CHAOS_PHOTOS,
  DOME_APPS,
  DOME_JOB_VIEWS,
  DOME_META,
  DOME_PILLARS,
  DOME_SESSION_FILES,
  type DomeAppId,
} from "@/components/transformationChaos";
import {
  LAYERING_DEVICE,
  LAYERING_STAGE,
  layeringStageActiveId,
} from "@/components/transformVisual";

type TransformationSceneProps = {
  ctaLabel: string;
  caption?: string;
  className?: string;
};

function WallpaperNoise({ patternId }: { patternId: string }) {
  const noiseId = `${patternId}-noise`;
  const wallId = `${patternId}-wall`;
  return (
    <svg
      aria-hidden
      className="absolute inset-0 h-full w-full opacity-[0.35]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id={noiseId} width="48" height="48" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="8" r="1.2" fill="rgba(255,255,255,0.08)" />
          <circle cx="22" cy="18" r="0.9" fill="rgba(255,255,255,0.05)" />
          <circle cx="38" cy="6" r="1.1" fill="rgba(255,255,255,0.07)" />
          <circle cx="14" cy="34" r="1" fill="rgba(255,255,255,0.06)" />
          <circle cx="40" cy="36" r="1.3" fill="rgba(255,255,255,0.05)" />
        </pattern>
        <linearGradient id={wallId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1a2233" />
          <stop offset="45%" stopColor="#121820" />
          <stop offset="100%" stopColor="#0c1018" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${wallId})`} />
      <rect width="100%" height="100%" fill={`url(#${noiseId})`} />
    </svg>
  );
}

function PhotoTile({
  className,
  tint,
  label,
  selected,
  onSelect,
}: {
  className: string;
  tint: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        "overflow-hidden rounded-md border shadow-lg transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)",
        selected
          ? "border-rose-300/50 ring-1 ring-rose-300/40"
          : "border-white/10 hover:border-rose-300/35",
        className,
      ].join(" ")}
      style={{
        background: `linear-gradient(145deg, ${tint}55, ${tint}18 55%, rgba(8,10,14,0.9))`,
      }}
    >
      <div className="flex h-full items-end p-1.5">
        <span className="truncate text-[9px] font-medium text-white/70 sm:text-[10px]">
          {label}
        </span>
      </div>
    </button>
  );
}

function ChaosLayer({
  reduce,
  patternId,
}: {
  reduce: boolean | null;
  patternId: string;
}) {
  const [selectedPhotoId, setSelectedPhotoId] = useState<
    (typeof CHAOS_PHOTOS)[number]["id"] | null
  >(null);
  const photoDetail = selectedPhotoId
    ? CHAOS_PHOTO_DETAILS[selectedPhotoId]
    : null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      <WallpaperNoise patternId={patternId} />

      <div className="absolute inset-0 z-0 opacity-90">
        {CHAOS_PHOTOS.map((photo) => (
          <PhotoTile
            key={photo.id}
            className={photo.className}
            tint={photo.tint}
            label={photo.label}
            selected={selectedPhotoId === photo.id}
            onSelect={() =>
              setSelectedPhotoId((prev) =>
                prev === photo.id ? null : photo.id,
              )
            }
          />
        ))}
      </div>

      {photoDetail ? (
        <div className="absolute inset-x-3 bottom-[28%] z-4 rounded-xl border border-rose-300/30 bg-black/70 px-3 py-2.5 shadow-xl backdrop-blur-md sm:inset-x-6 sm:bottom-[26%]">
          <p className="text-[10px] uppercase tracking-[0.12em] text-rose-100/70">
            Имитация · личный слой · {photoDetail.channel}
          </p>
          <p className="mt-1 text-xs leading-snug text-white/80">
            {photoDetail.risk}
          </p>
          <p className="mt-1 text-[10px] text-white/40">
            Клик по фото — показать/скрыть риск. Это метафора, не live gallery.
          </p>
        </div>
      ) : null}

      {/* Browser chrome */}
      <div className="absolute inset-x-2 top-2 z-1 rounded-lg border border-white/12 bg-[#0e1219]/94 shadow-xl backdrop-blur-sm sm:inset-x-3 sm:top-3">
        <div className="flex items-center gap-1.5 border-b border-white/8 px-2 py-1.5 sm:px-3">
          <span className="h-2 w-2 rounded-full bg-red-400/70" />
          <span className="h-2 w-2 rounded-full bg-amber-400/70" />
          <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
          <div className="ml-2 flex min-w-0 flex-1 gap-1 overflow-hidden">
            {CHAOS_BROWSER_TABS.map((tab) => (
              <div
                key={tab.id}
                className="flex max-w-[28%] shrink items-center gap-1 truncate rounded-md bg-white/6 px-1.5 py-0.5 text-[9px] text-white/55 sm:max-w-none sm:text-[10px]"
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: tab.accent }}
                />
                <span className="truncate">{tab.title}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-2 py-1 sm:px-3">
          <p className="truncate text-[9px] text-white/35 sm:text-[10px]">
            {LAYERING_DEVICE.addressBar}
          </p>
          <span className="hidden shrink-0 rounded border border-rose-300/25 bg-rose-400/10 px-1.5 py-0.5 text-[8px] uppercase tracking-wide text-rose-100/70 sm:inline">
            no perimeter
          </span>
        </div>
      </div>

      {/* Stage A risk strip */}
      <div className="absolute inset-x-2 top-19 z-3 sm:inset-x-3 sm:top-21">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-300/25 bg-rose-400/12 px-2.5 py-1.5 shadow-lg backdrop-blur-md">
          <p className="min-w-0 text-[9px] leading-snug text-rose-50/85 sm:text-[10px]">
            {LAYERING_DEVICE.riskBanner}
          </p>
          <span className="shrink-0 rounded-md border border-rose-300/30 bg-black/35 px-2 py-0.5 text-[8px] uppercase tracking-[0.12em] text-rose-100/80">
            {LAYERING_DEVICE.riskChip}
          </span>
        </div>
      </div>

      {/* Messenger stack */}
      <div className="absolute left-2 top-[34%] z-2 flex w-[46%] max-w-56 flex-col gap-1.5 sm:left-4 sm:top-[36%] sm:w-[42%] sm:max-w-64">
        {CHAOS_CHATS.map((chat, index) => (
          <motion.div
            key={chat.id}
            className="rounded-lg border border-rose-300/20 bg-[#121820]/9 p-2 shadow-lg backdrop-blur-md"
            animate={
              reduce
                ? undefined
                : {
                    y: [0, index % 2 === 0 ? -3 : 3, 0],
                    opacity: [0.85, 1, 0.85],
                  }
            }
            transition={
              reduce
                ? undefined
                : {
                    duration: 3.6 + index * 0.35,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
            }
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-white/80">
                <MessageCircle className="h-3 w-3 text-sky-300/80" aria-hidden />
                {chat.channel}
              </span>
              <span className="rounded border border-rose-300/25 bg-rose-400/10 px-1 py-0.5 text-[8px] text-rose-100/75">
                {chat.risk}
              </span>
            </div>
            <p className="mt-1 text-[10px] leading-snug text-white/55 sm:text-[11px]">
              {chat.preview}
            </p>
            <p className="mt-0.5 text-[9px] text-white/30">{chat.meta}</p>
          </motion.div>
        ))}
      </div>

      {/* Notification toast stack */}
      <div className="absolute right-2 top-[34%] z-2 flex w-[44%] max-w-52 flex-col gap-1.5 sm:right-4 sm:top-[36%] sm:w-[38%]">
        {CHAOS_NOTIFICATIONS.map((n, index) => (
          <motion.div
            key={n.id}
            className={[
              "rounded-lg border bg-black/55 px-2.5 py-1.5 shadow-md backdrop-blur-md",
              n.risk ? "border-rose-300/25" : "border-white/10",
            ].join(" ")}
            initial={false}
            animate={
              reduce
                ? { opacity: 0.9 }
                : { opacity: [0.55, 0.95, 0.55], x: [0, 2, 0] }
            }
            transition={
              reduce
                ? undefined
                : {
                    duration: 4 + index * 0.4,
                    repeat: Infinity,
                    delay: index * 0.25,
                  }
            }
          >
            <div className="flex items-center justify-between gap-1">
              <p className="text-[9px] font-medium text-white/70 sm:text-[10px]">
                {n.app}
              </p>
              {n.risk ? (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-300" />
              ) : null}
            </div>
            <p className="text-[9px] text-white/45 sm:text-[10px]">{n.text}</p>
          </motion.div>
        ))}
      </div>

      {/* Scattered files */}
      <div className="absolute inset-x-2 bottom-[22%] z-2 flex flex-wrap justify-center gap-2 sm:inset-x-4 sm:bottom-[20%]">
        {CHAOS_FILES.map((file, index) => {
          const Icon =
            file.id === "crm"
              ? FileSpreadsheet
              : file.id === "deck"
                ? Cloud
                : file.id === "photo"
                  ? ImageIcon
                  : FileText;
          return (
            <motion.div
              key={file.id}
              className={[
                "flex min-w-[30%] flex-1 items-center gap-2 rounded-lg border bg-[#0f141c]/92 px-2.5 py-2 shadow-lg backdrop-blur-sm sm:min-w-0 sm:flex-none sm:px-3",
                file.risk ? "border-rose-300/25" : "border-white/12",
              ].join(" ")}
              style={{ rotate: index === 0 ? -2 : index === 1 ? 1.5 : -1 }}
              animate={
                reduce
                  ? undefined
                  : { y: [0, index % 2 === 0 ? -4 : 4, 0] }
              }
              transition={
                reduce
                  ? undefined
                  : {
                      duration: 4.2 + index * 0.3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
              }
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-white/45" aria-hidden />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[10px] font-medium text-white/75 sm:text-[11px]">
                    {file.name}
                  </p>
                  {file.risk ? (
                    <span className="shrink-0 rounded border border-rose-300/30 bg-rose-400/10 px-1 text-[7px] uppercase text-rose-100/75">
                      корп
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-[9px] text-white/40">
                  {file.channel} · {file.where}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Personal dock */}
      <div className="absolute inset-x-0 bottom-[11%] z-2 flex justify-center px-3 sm:bottom-[10%]">
        <ul className="flex items-center gap-1.5 rounded-xl border border-white/12 bg-black/50 px-2 py-1.5 backdrop-blur-md sm:gap-2 sm:px-3">
          {CHAOS_DOCK.map((app) => (
            <li
              key={app.id}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/6 text-[8px] text-white/50 sm:h-8 sm:w-8 sm:text-[9px]"
              title={app.label}
            >
              {app.label.slice(0, 1)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function domeAppIcon(icon: (typeof DOME_APPS)[number]["icon"]): ReactNode {
  const cls = "h-3.5 w-3.5";
  switch (icon) {
    case "mail":
      return <Mail className={cls} aria-hidden />;
    case "files":
      return <FolderLock className={cls} aria-hidden />;
    case "crm":
      return <Users className={cls} aria-hidden />;
    case "meet":
      return <Video className={cls} aria-hidden />;
  }
}

function SafeDomeLayer({ reduce }: { reduce: boolean | null }) {
  const [activeAppId, setActiveAppId] = useState<DomeAppId>("mail");
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const activeApp =
    DOME_APPS.find((app) => app.id === activeAppId) ?? DOME_APPS[0];
  const jobView = DOME_JOB_VIEWS[activeAppId];

  function selectApp(id: DomeAppId) {
    setActiveAppId(id);
    if (id !== "files") setActiveFileId(null);
  }

  return (
    <motion.div
      key="dome"
      className="absolute inset-2 z-5 flex flex-col overflow-hidden rounded-xl border border-cyan-300/40 bg-[rgba(8,16,24,0.78)] shadow-[0_0_0_1px_rgba(0,242,255,0.12),0_0_56px_rgba(0,242,255,0.28)] backdrop-blur-xl sm:inset-3"
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.88, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 8 }}
      transition={{ duration: reduce ? 0.2 : 0.55, ease: [0.22, 1, 0.36, 1] }}
      role="region"
      aria-label="Safe Workspace — цифровой купол поверх личного устройства"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-xl"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,242,255,0.22), transparent 55%)",
        }}
      />

      <div className="relative flex items-center justify-between gap-2 border-b border-cyan-300/15 bg-black/20 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-cyan-300/35 bg-cyan-400/10 p-1 shadow-[0_0_18px_rgba(0,242,255,0.15)]">
            <BrandLogo size={24} decorative className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-(--color-accent)">
                {DOME_META.productLine}
              </p>
              <span className="rounded border border-cyan-300/25 bg-cyan-400/10 px-1.5 py-0.5 text-[9px] text-(--color-accent)/85">
                этап B · купол
              </span>
              <span className="rounded border border-white/12 bg-black/30 px-1.5 py-0.5 text-[9px] text-white/45">
                {activeApp.step} · {activeApp.label}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs font-medium text-white sm:text-sm">
              {DOME_META.title}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
          <span className="hidden rounded-md border border-white/12 bg-black/30 px-2 py-0.5 text-[9px] text-white/40 sm:inline">
            {DOME_META.sessionEyebrow}
          </span>
          <SessionStatus label={DOME_META.sessionLabel} className="shrink-0" />
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        <aside
          className="hidden w-16 flex-col items-center gap-2 border-r border-white/8 bg-black/30 py-3 sm:flex"
          aria-label={DOME_META.appsEyebrow}
        >
          {DOME_APPS.map((app) => {
            const selected = activeAppId === app.id;
            return (
              <button
                key={app.id}
                type="button"
                onClick={() => selectApp(app.id)}
                aria-pressed={selected}
                className={[
                  "flex h-9 w-9 flex-col items-center justify-center rounded-lg border transition",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)",
                  selected
                    ? "border-cyan-300/40 bg-cyan-400/15 text-(--color-accent)"
                    : "border-white/10 bg-white/5 text-white/55 hover:border-white/25",
                ].join(" ")}
                title={`${app.step} · ${app.label}`}
              >
                {domeAppIcon(app.icon)}
              </button>
            );
          })}
          <div className="mt-auto flex h-8 w-8 items-center justify-center rounded-lg border border-teal-300/25 bg-teal-400/10 text-teal-100/80">
            <Shield className="h-3.5 w-3.5" aria-hidden />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-4">
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-white/40">
              {DOME_META.appsEyebrow} · клик для имитации
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DOME_APPS.map((app) => {
                const selected = activeAppId === app.id;
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => selectApp(app.id)}
                    aria-pressed={selected}
                    className={[
                      "rounded-xl border px-2.5 py-2.5 text-left transition",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)",
                      selected
                        ? "border-cyan-300/40 bg-cyan-400/12"
                        : "border-cyan-300/15 bg-black/35 hover:border-cyan-300/30",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span
                        className={[
                          "flex h-7 w-7 items-center justify-center rounded-md border",
                          selected
                            ? "border-cyan-300/40 bg-cyan-400/15 text-(--color-accent)"
                            : "border-cyan-300/25 bg-cyan-400/10 text-(--color-accent)",
                        ].join(" ")}
                      >
                        {domeAppIcon(app.icon)}
                      </span>
                      <span className="rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[9px] tabular-nums text-white/40">
                        {app.step}
                      </span>
                    </div>
                    <p className="mt-2 text-[10px] font-medium text-white/85 sm:text-[11px]">
                      {app.label}
                    </p>
                    <p className="mt-0.5 text-[9px] text-(--color-accent)/75">
                      {app.status}
                    </p>
                    <p className="mt-1 text-[9px] leading-snug text-white/40">
                      {app.hint}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-cyan-300/25 bg-cyan-400/8 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-(--color-accent)/80">
                  {jobView.eyebrow}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-white sm:text-sm">
                  {jobView.headline}
                </p>
              </div>
              <span className="rounded-md border border-cyan-300/25 bg-black/30 px-2 py-0.5 text-[9px] text-white/50">
                имитация UI · не live
              </span>
            </div>
            <ul className="mt-3 space-y-2">
              {jobView.rows.map((row) => (
                <li
                  key={row.title}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/35 px-2.5 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium text-white/85">
                      {row.title}
                    </p>
                    <p className="mt-0.5 text-[9px] text-white/45">{row.meta}</p>
                  </div>
                  <span className="shrink-0 rounded border border-teal-300/20 bg-teal-400/10 px-1.5 py-0.5 text-[9px] text-teal-100/80">
                    {row.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">
                  {DOME_META.filesEyebrow}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-white/80">
                  Клик по файлу → открыть «Файлы сессии»
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-md border border-teal-300/25 bg-teal-400/10 px-2 py-0.5 text-[9px] text-teal-100/85">
                <Lock className="h-3 w-3" aria-hidden />
                {DOME_META.filesLock}
              </span>
            </div>
            <ul className="mt-3 space-y-2">
              {DOME_SESSION_FILES.map((file) => {
                const selected = activeFileId === file.id;
                return (
                  <li key={file.id}>
                    <button
                      type="button"
                      onClick={() => {
                        selectApp("files");
                        setActiveFileId(file.id);
                      }}
                      aria-pressed={selected}
                      className={[
                        "flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)",
                        selected
                          ? "border-cyan-300/35 bg-cyan-400/10"
                          : "border-white/8 bg-black/25 hover:border-white/20",
                      ].join(" ")}
                    >
                      <span className="flex min-w-0 items-center gap-2 text-[10px] text-white/70 sm:text-[11px]">
                        <FileText
                          className="h-3.5 w-3.5 shrink-0 text-(--color-accent)/70"
                          aria-hidden
                        />
                        <span className="truncate font-medium">{file.name}</span>
                      </span>
                      <span className="shrink-0 rounded border border-white/10 bg-white/4 px-1.5 py-0.5 text-[9px] text-white/40">
                        {file.kind}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-auto">
            <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-white/40">
              {DOME_META.pillarsEyebrow}
            </p>
            <div className="grid gap-1.5 sm:grid-cols-3">
              {DOME_PILLARS.map((pillar) => (
                <div
                  key={pillar.step}
                  className="rounded-lg border border-cyan-300/20 bg-cyan-400/8 px-2.5 py-2 text-center"
                >
                  <p className="text-[9px] tabular-nums text-(--color-accent)/80">
                    {pillar.step}
                  </p>
                  <p className="mt-0.5 text-[9px] font-medium text-white/75 sm:text-[10px]">
                    {pillar.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="relative border-t border-white/8 bg-black/20 px-3 py-2 text-[9px] text-white/35 sm:px-4 sm:text-[10px]">
        {LAYERING_STAGE.disclaimer}
      </p>
    </motion.div>
  );
}

export function TransformationScene({
  ctaLabel,
  caption,
  className = "",
}: TransformationSceneProps) {
  const [active, setActive] = useState(false);
  const reduce = useReducedMotion();
  const titleId = useId();
  const patternId = useId().replace(/:/g, "");
  const activeStageId = layeringStageActiveId(active);

  return (
    <div
      className={["relative mx-auto w-full max-w-4xl", className].join(" ")}
      aria-labelledby={titleId}
    >
      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-(--color-accent)">
            {LAYERING_STAGE.eyebrow}
          </p>
          <span className="rounded-md border border-white/12 bg-black/30 px-2 py-0.5 text-[10px] text-white/45">
            {LAYERING_STAGE.flowHint}
          </span>
        </div>
        <h2
          id={titleId}
          className="mt-3 max-w-3xl text-xl font-semibold tracking-tight sm:text-2xl"
        >
          {LAYERING_STAGE.title}
        </h2>
        {caption ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
            {caption}
          </p>
        ) : null}

        <ol
          className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch"
          aria-label="Этапы Layering"
        >
          {LAYERING_STAGE.stages.map((stage, index) => {
            const isCurrent = stage.id === activeStageId;
            const isRisk = stage.tone === "risk";
            return (
              <li key={stage.id} className="contents">
                <button
                  type="button"
                  onClick={() => setActive(stage.id === "dome")}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-pressed={isCurrent}
                  className={[
                    "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)",
                    isCurrent
                      ? isRisk
                        ? "border-rose-300/35 bg-rose-400/10"
                        : "border-cyan-300/35 bg-cyan-400/10"
                      : "border-white/10 bg-black/20 opacity-70 hover:opacity-90",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold",
                      isCurrent
                        ? isRisk
                          ? "border-rose-300/40 bg-rose-400/15 text-rose-100"
                          : "border-cyan-300/40 bg-cyan-400/15 text-(--color-accent)"
                        : "border-white/12 bg-white/5 text-white/45",
                    ].join(" ")}
                  >
                    {stage.letter}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-white/90">
                        {stage.label}
                      </p>
                      <span
                        className={[
                          "text-[10px]",
                          isCurrent
                            ? isRisk
                              ? "text-rose-100/70"
                              : "text-(--color-accent)/80"
                            : "text-white/35",
                        ].join(" ")}
                      >
                        {stage.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-white/45">
                      {stage.hint}
                    </p>
                  </div>
                </button>
                {index < LAYERING_STAGE.stages.length - 1 ? (
                  <div
                    className="hidden items-center justify-center sm:flex"
                    aria-hidden
                  >
                    <ArrowRight
                      className={[
                        "h-4 w-4 transition-colors",
                        active
                          ? "text-(--color-accent)/70"
                          : "text-rose-200/45",
                      ].join(" ")}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Device bezel */}
      <div
        className={[
          "rounded-[1.35rem] border bg-linear-to-b from-[#1a1f2a] to-[#0a0d12] p-1.5 transition-[box-shadow,border-color] duration-500 sm:p-2",
          active
            ? "border-cyan-300/30 shadow-[0_24px_80px_rgba(0,0,0,0.55),0_0_48px_rgba(0,242,255,0.14)]"
            : "border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.55),0_0_40px_rgba(251,113,133,0.1)]",
        ].join(" ")}
      >
        <div className="mb-1.5 flex items-center justify-between gap-2 px-2 sm:mb-2 sm:px-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-1.5 w-7 shrink-0 rounded-full bg-white/20 sm:w-9"
              aria-hidden
            />
            <span className="truncate text-[10px] tracking-wide text-white/45 sm:text-[11px]">
              {LAYERING_DEVICE.bezelLabel}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-[9px] tabular-nums text-white/35 sm:inline">
              {LAYERING_DEVICE.clock}
            </span>
            <span
              className={[
                "rounded-md border px-2 py-0.5 text-[9px] font-medium sm:text-[10px]",
                active
                  ? "border-cyan-300/35 bg-cyan-400/10 text-(--color-accent)"
                  : "border-rose-300/30 bg-rose-400/10 text-rose-100/80",
              ].join(" ")}
            >
              {active
                ? LAYERING_DEVICE.stageBBadge
                : LAYERING_DEVICE.stageABadge}
            </span>
          </div>
        </div>

        <div className="relative aspect-16/10 min-h-72 overflow-hidden rounded-2xl border border-white/10 bg-[#070a10] sm:min-h-90">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-25 rounded-2xl ring-1 ring-inset ring-white/10"
          />
          <motion.div
            className={[
              "absolute inset-0",
              active ? "pointer-events-none" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            animate={{
              filter: active ? "blur(5px)" : "blur(0px)",
              opacity: active ? 0.45 : 1,
              scale: active ? 1.03 : 1,
            }}
            transition={{ duration: reduce ? 0.2 : 0.5 }}
            aria-hidden={active}
          >
            <ChaosLayer reduce={reduce} patternId={patternId} />
          </motion.div>

          <AnimatePresence>{active ? <SafeDomeLayer reduce={reduce} /> : null}</AnimatePresence>

          {/* CTA dock */}
          <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center bg-linear-to-t from-[#070a10] via-[#070a10]/92 to-transparent px-4 pb-3 pt-12 sm:pb-4">
            <div
              className={[
                "flex w-full max-w-md flex-col items-center gap-1.5 sm:max-w-lg",
                active ? "rounded-2xl border border-white/12 bg-black/45 p-2.5 backdrop-blur-md sm:flex-row sm:justify-between sm:gap-3 sm:p-3" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {active ? (
                <p className="px-1 text-center text-[10px] text-white/45 sm:text-left sm:text-[11px]">
                  {DOME_META.resetHint}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => setActive((v) => !v)}
                className={[
                  "rounded-lg px-5 py-2.5 text-sm font-medium transition",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)",
                  active
                    ? "w-full border border-white/20 bg-black/50 text-white/85 hover:border-(--color-accent)/50 hover:text-(--color-accent) sm:w-auto"
                    : "bg-(--color-cta) text-(--color-bg) shadow-[0_0_28px_rgba(45,212,191,0.4)] hover:brightness-110",
                ].join(" ")}
                aria-pressed={active}
              >
                {active ? "Показать хаос снова" : ctaLabel}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Laptop base hint */}
      <div
        aria-hidden
        className="mx-auto mt-0 h-2 w-[72%] rounded-b-xl bg-linear-to-b from-[#1a1f2a] to-[#0a0d12] opacity-80"
      />
      <div
        aria-hidden
        className="mx-auto h-1 w-[42%] rounded-b-md bg-[#151922]"
      />
    </div>
  );
}
