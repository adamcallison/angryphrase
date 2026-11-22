import type { UrlLoadPort, UrlLoadResult } from '../domain/ports/ports';

// The wait cap for a user-supplied puzzle URL. Large enough for a slow host,
// small enough that a hung connection cannot wedge the import screen forever.
const REQUEST_TIMEOUT_MS = 15000;

function coerceError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

// The Player's puzzle-URL import. Silent adapter: failures travel as data
// (UrlLoadResult), the bindings facade warns. Never-throws — every failure
// path (bad URL, disallowed scheme, network/CORS/timeout rejection, non-2xx)
// resolves { kind: 'failed', error }. The URL is validated absolute http(s)
// here so ftp:/javascript:/relative paths never reach fetch; a CORS-blocked
// host is just another failure — the app cannot and does not bypass it. No
// content-type sniff: hosts serving JSON as text/plain are legitimate, and
// parsePuzzle downstream is the byte gate. The timeout cap exists because a
// fetch cannot be user-cancelled once issued — abort-on-timeout is the only
// bound on the wait. Per-call locals only; the module-level urlLoadPort
// singleton is a benign stateless instance per the port contract.
export function createUrlLoadPort(): UrlLoadPort {
  return {
    async load(url: string): Promise<UrlLoadResult> {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch (err) {
        return { kind: 'failed', error: coerceError(err) };
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { kind: 'failed', error: new Error(`urlLoadPort: unsupported scheme '${parsed.protocol}' (only http/https)`) };
      }

      let response: Response;
      try {
        response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      } catch (err) {
        return { kind: 'failed', error: coerceError(err) };
      }
      if (!response.ok) {
        const status = response.statusText === '' ? `${response.status}` : `${response.status} ${response.statusText}`;
        return { kind: 'failed', error: new Error(`urlLoadPort: HTTP ${status}`) };
      }

      try {
        const text = await response.text();
        return { kind: 'loaded', text };
      } catch (err) {
        return { kind: 'failed', error: coerceError(err) };
      }
    },
  };
}

export const urlLoadPort: UrlLoadPort = createUrlLoadPort();
