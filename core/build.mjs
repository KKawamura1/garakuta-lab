// Stable loader for deployment metadata.
// Cloudflare Pages runs npm run build, which creates the ignored
// build.generated.mjs sidecar. Local checkouts intentionally use the fallback
// so the source tree remains usable without a generated artifact.
import { CONTENT_CONTRACT_VERSION } from "../ecology/content/index.mjs";

let generated = null;
try {
  generated = await import("./build.generated.mjs");
} catch {
  // The sidecar is absent in a fresh checkout and before the Pages build step.
}

export const BUILD = typeof generated?.BUILD === "string" ? generated.BUILD : "unbuilt";
// The semantic rules/content fingerprint is source-controlled, not deployment metadata.
export const FINGERPRINT = CONTENT_CONTRACT_VERSION;
export default BUILD;
