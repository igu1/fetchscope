import { configureWhyFetch, installWhyFetch } from "./index";

/**
 * Side-effect entry for the simplest possible usage:
 *
 * ```ts
 * import "fetchscope/dev";
 * ```
 */
configureWhyFetch({ output: "console" });
installWhyFetch();
