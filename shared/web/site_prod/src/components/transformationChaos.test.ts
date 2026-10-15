/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Transformation chaos model to Shadow IT channels + full-layer coverage.
 *
 * Invariants:
 * - Helper rejects fluff; chaosLayerMentionsAllChannels stays true.
 * - Chaos labels stay generic (no real product trademarks).
 *
 * Related:
 * - transformationChaos.ts
 */

import { describe, expect, it } from "vitest";
import {
  CHAOS_BROWSER_TABS,
  CHAOS_CHATS,
  CHAOS_DOCK,
  CHAOS_FILES,
  CHAOS_NOTIFICATIONS,
  CHAOS_PHOTOS,
  DOME_APPS,
  DOME_JOB_VIEWS,
  DOME_META,
  DOME_PILLARS,
  DOME_SESSION_FILES,
  CHAOS_PHOTO_DETAILS,
  chaosLayerMentionsAllChannels,
  isShadowItChaosLabel,
  TRANSFORM_CHAOS_CHANNELS,
} from "./transformationChaos";

describe("transformationChaos", () => {
  it("recognizes Shadow IT channel labels", () => {
    for (const ch of TRANSFORM_CHAOS_CHANNELS) {
      expect(isShadowItChaosLabel(`${ch} · file`)).toBe(true);
    }
  });

  it("rejects unrelated fluff labels", () => {
    expect(isShadowItChaosLabel("Революционный AI")).toBe(false);
    expect(isShadowItChaosLabel("Фото · уведомления")).toBe(false);
  });

  it("avoids real product / company trademarks in chaos labels", () => {
    const blob = JSON.stringify({
      channels: TRANSFORM_CHAOS_CHANNELS,
      tabs: CHAOS_BROWSER_TABS,
      chats: CHAOS_CHATS,
      files: CHAOS_FILES,
      notes: CHAOS_NOTIFICATIONS,
    });
    expect(blob).not.toMatch(
      /Telegram|WhatsApp|ChatGPT|Google Drive|iCloud|Яндекс|Yandex|Dropbox|Slack|Discord/i,
    );
  });

  it("chaos layer model mentions every Shadow IT channel", () => {
    expect(chaosLayerMentionsAllChannels()).toBe(true);
  });

  it("marks corporate bleed in Stage A chaos cards", () => {
    expect(CHAOS_PHOTOS.length).toBeGreaterThanOrEqual(5);
    expect(CHAOS_DOCK.length).toBeGreaterThanOrEqual(4);
    expect(CHAOS_CHATS.every((c) => c.risk.length > 0)).toBe(true);
    expect(CHAOS_FILES.some((f) => f.risk)).toBe(true);
  });

  it("exposes denser EmpiierOS dome chrome without trademarks", () => {
    expect(DOME_META.productLine).toMatch(/EmpiierOS/i);
    expect(DOME_APPS).toHaveLength(4);
    expect(DOME_APPS.every((a) => a.step && a.hint && a.icon)).toBe(true);
    expect(DOME_SESSION_FILES.length).toBeGreaterThanOrEqual(3);
    expect(DOME_PILLARS.every((p) => p.step && p.label)).toBe(true);
    const blob = JSON.stringify({
      meta: DOME_META,
      apps: DOME_APPS,
      files: DOME_SESSION_FILES,
      jobs: DOME_JOB_VIEWS,
      photos: CHAOS_PHOTO_DETAILS,
    });
    expect(blob).not.toMatch(
      /Telegram|WhatsApp|ChatGPT|Google Drive|iCloud|Яндекс/i,
    );
  });

  it("covers imitation job views for every dome app and photo risk detail", () => {
    for (const app of DOME_APPS) {
      const view = DOME_JOB_VIEWS[app.id];
      expect(view.rows.length).toBeGreaterThanOrEqual(2);
      expect(view.eyebrow.toLowerCase()).toMatch(/имитац/);
    }
    for (const photo of CHAOS_PHOTOS) {
      expect(CHAOS_PHOTO_DETAILS[photo.id]?.risk.length).toBeGreaterThan(0);
    }
  });
});
