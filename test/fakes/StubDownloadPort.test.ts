import { describe, it, expect } from 'vitest';
import { StubDownloadPort } from './StubDownloadPort';

describe('StubDownloadPort', () => {
  it('records downloads', () => {
    const port = new StubDownloadPort();
    port.download('a.json', '{}');
    port.download('b.json', '{"x":1}');
    expect(port.downloads.length).toBe(2);
    expect(port.getDownloadCount()).toBe(2);
    expect(port.getLastDownload()).toEqual({ filename: 'b.json', content: '{"x":1}' });
  });

  it('reset clears the recorded downloads', () => {
    const port = new StubDownloadPort();
    port.download('a.json', '{}');
    port.reset();
    expect(port.downloads.length).toBe(0);
    expect(port.getDownloadCount()).toBe(0);
    expect(port.getLastDownload()).toBeUndefined();
  });
});
