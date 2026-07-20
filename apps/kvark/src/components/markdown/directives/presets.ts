import { callout } from "./definitions/callout";
import { youtube } from "./definitions/youtube";
import { createRegistry } from "./registry";

/** Full feature set — used in admin editors for news/events. */
export const richRegistry = createRegistry([callout, youtube]);

/** Plain markdown only — useful for short fields or comments. */
export const minimalRegistry = createRegistry([]);

/** Just callouts — example of an in-between scope. */
export const calloutOnlyRegistry = createRegistry([callout]);
