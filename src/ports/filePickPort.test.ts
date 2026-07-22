// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFilePickPort } from './filePickPort';

function createFakeInput(): HTMLInputElement {
  const realInput = document.createElement('input');
  vi.spyOn(realInput, 'addEventListener').mockImplementation(vi.fn());
  vi.spyOn(realInput, 'click').mockImplementation(vi.fn());
  return realInput;
}

let originalCreateElement: typeof document.createElement;

beforeEach(() => {
  originalCreateElement = document.createElement;
});

afterEach(() => {
  vi.restoreAllMocks();
  document.createElement = originalCreateElement;
});

describe('filePickPort', () => {
  it('filePickPort: pickFile() resolves with null when no file is selected (user cancels — input.files is null)', async () => {
    const fakeInput = createFakeInput();
    vi.spyOn(document, 'createElement').mockReturnValue(fakeInput);

    const port = createFilePickPort();
    const promise = port.pickFile();

    const addEventListenerMock = fakeInput.addEventListener as unknown as ReturnType<typeof vi.fn>;
    const onChange = addEventListenerMock.mock.calls[0]![1] as () => void;
    Object.defineProperty(fakeInput, 'files', { value: null, writable: true });
    await onChange();

    const result = await promise;
    expect(result).toBeNull();
  });

  it('filePickPort: pickFile() resolves with the file text when a file is selected', async () => {
    const fakeInput = createFakeInput();
    vi.spyOn(document, 'createElement').mockReturnValue(fakeInput);

    const port = createFilePickPort();
    const promise = port.pickFile();

    const addEventListenerMock = fakeInput.addEventListener as unknown as ReturnType<typeof vi.fn>;
    const onChange = addEventListenerMock.mock.calls[0]![1] as () => void;
    const file = new File(['file content'], 'puzzle.json', { type: 'application/json' });
    Object.defineProperty(fakeInput, 'files', { value: [file], writable: true });
    await onChange();

    const result = await promise;
    expect(result).toBe('file content');
  });

  it('filePickPort: pickFile() resolves with null when file.text() rejects', async () => {
    const fakeInput = createFakeInput();
    vi.spyOn(document, 'createElement').mockReturnValue(fakeInput);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const port = createFilePickPort();
    const promise = port.pickFile();

    const addEventListenerMock = fakeInput.addEventListener as unknown as ReturnType<typeof vi.fn>;
    const onChange = addEventListenerMock.mock.calls[0]![1] as () => void;
    const badFile = {
      text: () => Promise.reject(new Error('read error')),
    } as unknown as File;
    Object.defineProperty(fakeInput, 'files', { value: [badFile], writable: true });
    await onChange();

    const result = await promise;
    expect(result).toBeNull();
    warnSpy.mockRestore();
  });

  it('filePickPort: pickFile() removes the input element from document.body after settlement', async () => {
    const realInput = document.createElement('input');
    const addEventListenerSpy = vi.spyOn(realInput, 'addEventListener');
    const clickSpy = vi.spyOn(realInput, 'click').mockImplementation(() => {
      const onChange = addEventListenerSpy.mock.calls[0]![1] as () => void;
      void onChange();
    });

    vi.spyOn(document, 'createElement').mockReturnValue(realInput);

    const port = createFilePickPort();
    const promise = port.pickFile();

    await clickSpy;
    await promise;

    expect(document.body.contains(realInput)).toBe(false);
  });

  it('filePickPort: pickFile() resolves with null when document.createElement throws (graceful failure)', async () => {
    vi.spyOn(document, 'createElement').mockImplementation(() => {
      throw new Error('DOM not ready');
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const port = createFilePickPort();
    const result = await port.pickFile();

    expect(result).toBeNull();
    warnSpy.mockRestore();
  });
});
