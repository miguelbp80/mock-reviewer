import type { ComponentType } from "react";

/**
 * Every folder in src/mockups/<name>/ with an index.tsx is a mockup.
 * The file exports `meta` and a default component. The mockup is served at
 * /m/<meta.id>; keep a random suffix in the id so links can't be guessed.
 *
 * Mark the blocks reviewers will comment on with data-anchor="<name>" (lowercase,
 * digits and dashes, unique per mockup page). A pin on such a block follows it
 * when the viewport changes; clicks elsewhere are stored by coordinates.
 */
export type MockupMeta = {
  /** URL id: lowercase, digits and dashes, ending in a random suffix. */
  id: string;
  title: string;
};

type MockupModule = { meta: MockupMeta; default: ComponentType };

const modules = import.meta.glob<MockupModule>("./mockups/*/index.tsx", { eager: true });

export const mockups = Object.values(modules).map((m) => ({ ...m.meta, Component: m.default }));

export const findMockup = (id: string) => mockups.find((m) => m.id === id);
