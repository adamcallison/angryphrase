import { describe, it, expect } from 'vitest';
import { StubDownloadPort } from './StubDownloadPort';

describe('StubDownloadPort', () => {
  it('records downloads and returns null', () => {
    const port = new StubDownloadPort();
    expect(port.download('a.json', '{}')).toBeNull();
    expect(port.download('b.json', '{"x":1}')).toBeNull();
    expect(port.downloads.length).toBe(2);
    expect(port.getDownloadCount()).toBe(2);
    expect(port.getLastDownload()).toEqual({ filename: 'b.json', content: '{"x":1}' });
  });

  it('reset clears the recorded downloads and nextDownloadError', () => {
    const port = new StubDownloadPort();
    port.nextDownloadError = new Error('boom');
    port.download('a.json', '{}');
    port.reset();
    expect(port.downloads.length).toBe(0);
    expect(port.getDownloadCount()).toBe(0);
    expect(port.getLastDownload()).toBeUndefined();
    expect(port.nextDownloadError).toBeNull();
  });

  it('returns injected Error and records the download, then resets to null on next call', () => {
    const port = new StubDownloadPort();
    port.nextDownloadError = new Error('boom');
    const result = port.download('a.json', '{}');
    expect(result).toBeInstanceOf(Error);
    expect(result?.message).toBe('boom');
    expect(port.getDownloadCount()).toBe(1);
    expect(port.download('b.json', '{}')).toBeNull();
    expect(port.getDownloadCount()).toBe(2);
  });
});
