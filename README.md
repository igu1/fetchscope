# whycall

**Find out why your frontend is making that request.**

> One small problem. One obvious API. Very little setup. Immediate value.

Your app makes more requests than it should. DevTools shows *that* requests
happened — not *why*. `whycall` instruments `fetch` in development mode and
answers the application-level questions: who called it, how long it took,
which calls are duplicates, which responses are huge.

## Install

```bash
npm i whycall
```

## Usage

```ts
import "whycall/dev"; // tree-shaken out of production builds
```

That's it — regular app code keeps working:

```ts
fetch("/api/products"); // → logs where + timing
```

```text
🌐 GET /api/products
   ProductList.tsx:42:31 — 182ms
```

Duplicate detected (same method + URL inside the window):

```text
⚠ duplicate request — GET /api/products
2 times within 52ms
sources: ProductList.tsx:42:31, Sidebar.tsx:18:5
```

Slow request:

```text
🐌 slow request — GET /api/dashboard took 842ms
```

Big payload (via `content-length`):

```text
⚠ big payload — GET /api/products: 700.45 KB
```

## Configure

```ts
import { configureWhyFetch } from "whycall";

configureWhyFetch({
  slowRequestMs: 500,
  largePayloadKb: 500,
  duplicateWindow: 100, // 0 to disable dup warnings
  ignore: ["/analytics"],
});
```

### Opt-in wrapper

```ts
import { whyFetch } from "whycall";

const res = await whyFetch("/api/products");
```

### Uninstall

```ts
import { uninstallWhyFetch } from "whycall";
uninstallWhyFetch(); // restores the original fetch
```

### Stats

```ts
import { statsFor } from "whycall";

statsFor("/api/products"); // { count, avgMs }
```

## Notes

- dev-only instrumentation — keep the `import` out of production builds
- zero dependencies; works in Node 18+ and any `fetch`-supporting browser
- ESM + CJS + `.d.ts`

## License

MIT
