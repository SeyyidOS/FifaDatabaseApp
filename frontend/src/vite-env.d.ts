/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "store" for the iPhone app (lib/edition.ts, .env.app) */
  readonly VITE_EDITION?: string;
  /** the API's address; "/api" on the site, in full in the iPhone app */
  readonly VITE_API_URL?: string;
  /** the site's address for shared links, in the iPhone app (lib/links.ts) */
  readonly VITE_SITE_URL?: string;
}
