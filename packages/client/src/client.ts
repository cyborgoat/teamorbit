import createClient, { type Middleware } from 'openapi-fetch';
import { createResources } from './resources.js';
import type { paths } from './schema.js';

export interface TeamOrbitClientOptions {
  /** Base URL of the deployed teamorbit API, e.g. https://orbit.example.com */
  baseUrl: string;
  /**
   * Static JWT, or a function returning one (called on every request).
   * Optional: `orbit.auth.login()` stores the token for you.
   */
  token?: string | (() => string | undefined | Promise<string | undefined>);
  /** Custom fetch implementation (defaults to global fetch). */
  fetch?: typeof fetch;
}

export function createTeamOrbitClient(options: TeamOrbitClientOptions) {
  const raw = createClient<paths>({ baseUrl: options.baseUrl, fetch: options.fetch });

  // A token set via login()/setToken() wins over the `token` option.
  let current: string | undefined;
  const auth: Middleware = {
    async onRequest({ request }) {
      const { token } = options;
      const value = current ?? (typeof token === 'function' ? await token() : token);
      if (value) request.headers.set('Authorization', `Bearer ${value}`);
      return request;
    },
  };
  raw.use(auth);

  const setToken = (token: string | undefined) => {
    current = token;
  };

  // Spread would copy the methods unbound; keep the raw client's own methods.
  return Object.assign(raw, createResources(raw, { setToken }), { setToken });
}

export type TeamOrbitClient = ReturnType<typeof createTeamOrbitClient>;
