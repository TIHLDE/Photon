# es-toolkit in Photon

es-toolkit is available in every package via the root catalog (`"es-toolkit": "catalog:"`).
Import from `"es-toolkit"` — not `es-toolkit/compat` (Lodash compatibility layer, only for
Lodash-style semantics we don't want) and not `es-toolkit/fp`.

This file lists the methods that pay off most in this codebase, with the hand-rolled
patterns they replace. Oxlint enforces the mechanical ones — see
`scripts/oxlint-plugins/es-toolkit.mjs`.

## Arrays

### `uniq`, `uniqBy`, `union`, `difference`, `intersection`

Deduplication without the spread-a-Set dance.

```ts
// Before
const ids = [...new Set(userIds)];
// After
import { uniq } from "es-toolkit";
const ids = uniq(userIds);

// Before: dedupe by a key
return [...new Set([...(a ?? []), ...(b ?? [])])];
// After
import { union } from "es-toolkit";
return union(a ?? [], b ?? []);

// Dedupe objects by a property (keeps the first occurrence)
const uniqueErrors = uniqBy(errors, (error) => error?.message);
```

### `groupBy`, `keyBy`, `countBy`

The three reduce-into-a-Map loops that show up in every list endpoint.

```ts
// Group rows by a key
const byUser = groupBy(rows, (row) => row.userId); // Record<string, Row[]>

// Index rows by a key (last wins)
const bySlug = keyBy(groups, (group) => group.slug);

// Count occurrences
const counts = countBy(submissions, (s) => s.studyProgram); // Record<string, number>
```

Note: these return plain objects, so `null` keys become `"null"`. If you need a
`Map` with `null` keys, keep the Map loop.

### `sumBy`, `maxBy`, `minBy`, `meanBy`

Aggregates without a reduce boilerplate.

```ts
// Before
const total = rows.reduce((sum, row) => sum + row.count, 0);
// After
import { sumBy } from "es-toolkit";
const total = sumBy(rows, (row) => row.count);

// Before
const next = issues.reduce((max, i) => Math.max(max, i.edition), 0) + 1;
// After (maxBy returns the element, not the value)
import { maxBy } from "es-toolkit";
const next = (maxBy(issues, (i) => i.edition)?.edition ?? 0) + 1;
```

### `sortBy`, `orderBy`

Stable sorts without comparator boilerplate. `sortBy` takes key functions
(ascending), `orderBy` adds per-key direction.

```ts
// Before
[...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
// After
import { orderBy } from "es-toolkit";
orderBy(rows, [(row) => row.createdAt], ["desc"]);
```

Keep native `.sort` with `localeCompare("nb")` for user-facing Norwegian
ordering — comparators are clearer than a key function there.

### `chunk`, `partition`, `compact`, `flatten`, `take`

```ts
chunk(ids, 100); // [[...100], [...rest]] — for batched inserts/queries
partition(users, (u) => u.isActive); // [[active], [inactive]] — one pass, not two filters
compact([1, null, 2, undefined]); // [1, 2] — drops null/undefined/false/""/0
flatten([[1], [2, 3]]); // [1, 2, 3]
take(rows, 10); // first 10 without mutating
```

### `sample`, `shuffle`

```ts
sample(participants); // one random participant
shuffle(teams); // new shuffled array
```

## Objects

```ts
import {
    pick,
    omit,
    mapValues,
    mapKeys,
    clone,
    cloneDeep,
    invert,
} from "es-toolkit";

pick(user, ["id", "name", "email"]); // whitelist for public payloads
omit(user, ["passwordHash"]); // strip before returning
mapValues(byId, (group) => group.memberCount);
clone(shallow); // shallow copy
cloneDeep(state); // deep copy
invert(mapping); // { a: "x" } -> { x: "a" }
```

## Strings

```ts
import {
    capitalize,
    camelCase,
    kebabCase,
    snakeCase,
    truncate,
    escapeRegExp,
} from "es-toolkit";

capitalize("sunday swim"); // "Sunday swim"
camelCase("event_id"); // "eventId"
kebabCase("Søndagsplask"); // "sondagsplask" — not Norwegian-correct, see packages/core/src/slug.ts
truncate(longText, { length: 70 }); // "…"-aware truncation
escapeRegExp(userInput); // before new RegExp(userInput)
```

## Functions

```ts
import { debounce, throttle, memoize, once, retry } from "es-toolkit";

const search = debounce(fetchResults, 300); // trailing debounce, cancel() included
const reportScroll = throttle(onScroll, 100);
const getConfig = memoize(loadConfig); // cache by first argument
```

The React hooks `useDebouncedValue` / `useDebounced` (kvark) stay as they are —
they debounce a _value across renders_, which is a different problem than
debouncing a _callback_.

## Math

```ts
import { clamp, inRange, range, random, round, sum, mean } from "es-toolkit";

clamp(value, 0, 100); // replaces Math.min(100, Math.max(0, value))
inRange(page, 1, totalPages + 1);
range(5); // [0, 1, 2, 3, 4]
sum([1, 2, 3]); // 6 — for already-projected numbers
round(1.234, 2); // 1.23
```

## Predicates

```ts
import { isEqual, isEmpty, isNil, isNotNil } from "es-toolkit";

isEqual(a, b); // deep equality for plain data
isEmpty(value); // null, {}, [], "" — replaces the `!x || x.length === 0` dance
isNil(value); // null | undefined
```

## Promises

```ts
import {
    delay,
    withTimeout,
    limitAsync,
    retry,
    Semaphore,
    Mutex,
} from "es-toolkit";

await delay(1000); // replaces new Promise((r) => setTimeout(r, 1000))
await withTimeout(fetch(url), 5000); // throws TimeoutError
await limitAsync(urls, 5, fetchOne); // concurrency-limited map
await retry(() => callVipps(), { retries: 3, delay: 500 }); // exponential backoff
```

## Enforced by oxlint

`scripts/oxlint-plugins/es-toolkit.mjs` flags the mechanical ones:

| Rule              | Flags                                           | Use instead                 |
| ----------------- | ----------------------------------------------- | --------------------------- |
| `prefer-uniq`     | `[...new Set(x)]`, `Array.from(new Set(x))`     | `uniq` / `uniqBy` / `union` |
| `prefer-sum-by`   | `.reduce((acc, x) => acc + x.prop, 0)`          | `sumBy`                     |
| `prefer-max-by`   | `.reduce((max, x) => Math.max(max, x.prop), 0)` | `maxBy`                     |
| `prefer-count-by` | `counts.set(k, (counts.get(k) ?? 0) + 1)`       | `countBy`                   |

Everything else in this file is a judgment call — reach for it when it reads
better, not by default.
