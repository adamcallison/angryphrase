// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDownloadPort } from './downloadPort';

let originalCreateObjectURL: typeof URL.createObjectURL;
let originalRevokeObjectURL: typeof URL.revokeObjectURL;

beforeEach(() => {
  originalCreateObjectURL = URL.createObjectURL;
  originalRevokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn().mockReturnValue('blob:default-url') as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn().mockImplementation(() => {}) as unknown as typeof URL.revokeObjectURL;
});

afterEach(() => {
  vi.restoreAllMocks();
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

describe('downloadPort', () => {
  it('downloadPort: download() calls URL.createObjectURL, creates <a> with download=filename, click+revoke', () => {
    const filename = 'puzzle.json';
    const content = '{"foo":"bar"}';
    const mockUrl = 'blob:mock-url';

    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockUrl);
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
    } as unknown as HTMLAnchorElement;

    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

    const port = createDownloadPort();
    port.download(filename, content);

    expect(createObjectURLSpy).toHaveBeenCalledOnce();
    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(mockAnchor.download).toBe(filename);
    expect(mockAnchor.href).toBe(mockUrl);
    expect(mockAnchor.click).toHaveBeenCalledOnce();
    expect(appendChildSpy).toHaveBeenCalledWith(mockAnchor);
    expect(removeChildSpy).toHaveBeenCalledWith(mockAnchor);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith(mockUrl);
  });

  it('downloadPort: blob created with type application/json', async () => {
    const OriginalBlob = globalThis.Blob;
    const blobSpy = vi.spyOn(globalThis as unknown as { Blob: typeof Blob }, 'Blob').mockImplementation(
      (parts, options) => new OriginalBlob(parts as BlobPart[], options as BlobPropertyBag)
    );
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');

    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
    } as unknown as HTMLAnchorElement;

    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const port = createDownloadPort();
    port.download('file.json', '{"x":1}');

    expect(blobSpy).toHaveBeenCalledOnce();
    const [parts, options] = blobSpy.mock.calls[0]!;
    expect(parts).toEqual(['{"x":1}']);
    expect(options).toEqual({ type: 'application/json' });

    const createdBlob = blobSpy.mock.results[0]?.value as Blob | undefined;
    expect(createdBlob).toBeDefined();
    expect(createdBlob!.type).toBe('application/json');
    expect(await createdBlob!.text()).toBe('{"x":1}');
  });

  it('downloadPort: download() does not throw when URL.createObjectURL is missing (graceful failure)', () => {
    const originalCreateObjectURL = URL.createObjectURL;
    // @ts-expect-error - intentionally deleting for test
    delete URL.createObjectURL;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const port = createDownloadPort();
    expect(() => port.download('file.json', '{}')).not.toThrow();

    warnSpy.mockRestore();
    URL.createObjectURL = originalCreateObjectURL;
  });

  it('downloadPort: download() revokes the object URL after click', () => {
    const mockUrl = 'blob:mock-url';
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockUrl);
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
    } as unknown as HTMLAnchorElement;

    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

    const port = createDownloadPort();
    port.download('file.json', '{}');

    expect(revokeObjectURLSpy).toHaveBeenCalledWith(mockUrl);
    expect(revokeObjectURLSpy.mock.invocationCallOrder[0]).toBeGreaterThan(
      createObjectURLSpy.mock.invocationCallOrder[0]!
    );
    const clickMock = mockAnchor.click as unknown as ReturnType<typeof vi.fn>;
    expect(revokeObjectURLSpy.mock.invocationCallOrder[0]).toBeGreaterThan(
      clickMock.mock.invocationCallOrder[0]!
    );
  });
});
