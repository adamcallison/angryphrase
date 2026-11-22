// Node environment: fetch/URL/AbortSignal are Node globals — no jsdom needed.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUrlLoadPort } from '../../src/ports/urlLoadPort';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(impl: Parameters<typeof vi.fn>[0]): ReturnType<typeof vi.fn> {
  const fetchSpy = vi.fn(impl);
  vi.stubGlobal('fetch', fetchSpy);
  return fetchSpy;
}

function okResponse(body: string): Response {
  return new Response(body, { status: 200 });
}

describe('urlLoadPort', () => {
  it('urlLoadPort: rejects a URL that is not absolute (new URL throws) as failed, without calling fetch', async () => {
    const fetchSpy = stubFetch(async () => okResponse('{}'));

    const result = await createUrlLoadPort().load('example.com/puzzle.json');

    expect(result).toEqual({ kind: 'failed', error: expect.any(Error) });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('urlLoadPort: rejects a non-http(s) scheme (e.g. ftp://) as failed, without calling fetch', async () => {
    const fetchSpy = stubFetch(async () => okResponse('{}'));

    const result = await createUrlLoadPort().load('ftp://example.com/puzzle.json');

    expect(result).toEqual({ kind: 'failed', error: expect.any(Error) });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('urlLoadPort: returns loaded with the body text on a 2xx response', async () => {
    stubFetch(async () => okResponse('{"puzzle":true}'));

    const result = await createUrlLoadPort().load('https://example.com/puzzle.json');

    expect(result).toEqual({ kind: 'loaded', text: '{"puzzle":true}' });
  });

  it('urlLoadPort: returns failed carrying the status on a non-2xx response', async () => {
    stubFetch(async () => new Response('nope', { status: 404, statusText: 'Not Found' }));

    const result = await createUrlLoadPort().load('https://example.com/puzzle.json');

    expect(result.kind).toBe('failed');
    if (result.kind === 'failed') {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toContain('404');
    }
  });

  it('urlLoadPort: returns failed when fetch rejects (network/CORS error), coercing non-Error rejections to Error', async () => {
    stubFetch(async () => {
      throw new Error('network down');
    });
    const errorResult = await createUrlLoadPort().load('https://example.com/puzzle.json');
    expect(errorResult.kind).toBe('failed');
    if (errorResult.kind === 'failed') {
      expect(errorResult.error).toBeInstanceOf(Error);
      expect(errorResult.error.message).toContain('network down');
    }

    stubFetch(async () => {
      throw 'cors blocked';
    });
    const coercedResult = await createUrlLoadPort().load('https://example.com/puzzle.json');
    expect(coercedResult.kind).toBe('failed');
    if (coercedResult.kind === 'failed') {
      expect(coercedResult.error).toBeInstanceOf(Error);
      expect(coercedResult.error.message).toContain('cors blocked');
    }
  });

  it('urlLoadPort: passes an un-aborted AbortSignal to fetch', async () => {
    const fetchSpy = stubFetch(async () => okResponse('{}'));

    const result = await createUrlLoadPort().load('https://example.com/puzzle.json');

    expect(result.kind).toBe('loaded');
    expect(fetchSpy).toHaveBeenCalledOnce();
    const options = fetchSpy.mock.calls[0]![1] as { signal: AbortSignal };
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.signal.aborted).toBe(false);
    // The 15 s timeout firing itself is host-timer territory and stays
    // untested (same honesty class as jsdom's XHR limits) — no fake-timer
    // hack-around here.
  });
});
