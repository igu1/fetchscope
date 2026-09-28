import { configureWhyFetch, installWhyFetch } from "./index";

/**
 * Side-effect entry for the simplest possible usage:
 *
 * ```ts
 * import "whycall/dev";
 * ```
 */
configureWhyFetch({ output: "console" });
installWhyFetch();
