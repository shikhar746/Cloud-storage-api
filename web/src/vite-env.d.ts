/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Google OAuth web client id. The API's base URL is deliberately NOT an
   * environment variable — there is one backend, and it is a constant in
   * services/api.ts.
   */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
