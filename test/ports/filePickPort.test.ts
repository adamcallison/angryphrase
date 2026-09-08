// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFilePickPort } from '../../src/ports/filePickPort';

function createFakeInput(): HTMLInputElement {
  const realInput = document.createElement('input');
  vi.spyOn(realInput, 'addEventListener').mockImplementation(vi.fn());
  vi.spyOn(realInput, 'click').mockImplementation(vi.fn());
  return realInput;
}

function getListener(
  fakeInput: HTMLInputElement,
  eventName: string,
): (() => void) | undefined {
  const mock = fakeInput.addEventListener as unknown as ReturnType<typeof vi.fn>;
  const call = mock.mock.calls.find((c: unknown[]) => c[0] === eventName);
  return call?.[1] as (() => void) | undefined;
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
  it('pickFile() resolves { kind: "picked", text } when a file is selected', async () => {
    const fakeInput = createFakeInput();
    vi.spyOn(document, 'createElement').mockReturnValue(fakeInput);

    const port = createFilePickPort();
    const promise = port.pickFile();

    const onChange = getListener(fakeInput, 'change')!;
    const file = new File(['file content'], 'puzzle.json', { type: 'application/json' });
    Object.defineProperty(fakeInput, 'files', { value: [file], writable: true });
    await onChange();

    const result = await promise;
    expect(result).toEqual({ kind: 'picked', text: 'file content' });
  });

  it('pickFile() resolves { kind: "cancelled" } when change fires with no file', async () => {
    const fakeInput = createFakeInput();
    vi.spyOn(document, 'createElement').mockReturnValue(fakeInput);

    const port = createFilePickPort();
    const promise = port.pickFile();

    const onChange = getListener(fakeInput, 'change')!;
    Object.defineProperty(fakeInput, 'files', { value: null, writable: true });
    await onChange();

    const result = await promise;
    expect(result).toEqual({ kind: 'cancelled' });
  });

  it('pickFile() resolves { kind: "failed", error } when file.text() rejects', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fakeInput = createFakeInput();
    vi.spyOn(document, 'createElement').mockReturnValue(fakeInput);

    const port = createFilePickPort();
    const promise = port.pickFile();

    const onChange = getListener(fakeInput, 'change')!;
    const badFile = {
      text: () => Promise.reject(new Error('read error')),
    } as unknown as File;
    Object.defineProperty(fakeInput, 'files', { value: [badFile], writable: true });
    await onChange();

    const result = await promise;
    expect(result).toEqual({ kind: 'failed', error: new Error('read error') });
    expect(warnSpy).toHaveBeenCalledTimes(0);
    warnSpy.mockRestore();
  });

  it('pickFile() resolves { kind: "failed", error } when document.createElement throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockImplementation(() => {
      throw new Error('DOM not ready');
    });

    const port = createFilePickPort();
    const result = await port.pickFile();

    expect(result).toEqual({ kind: 'failed', error: new Error('DOM not ready') });
    expect(warnSpy).toHaveBeenCalledTimes(0);
    warnSpy.mockRestore();
  });

  it('pickFile() resolves { kind: "failed", error } when setup throws (appendChild throws) and attempts removal', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fakeInput = createFakeInput();
    vi.spyOn(document, 'createElement').mockReturnValue(fakeInput);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {
      throw new Error('append failed');
    });

    const port = createFilePickPort();
    const result = await port.pickFile();

    expect(result).toEqual({ kind: 'failed', error: new Error('append failed') });
    expect(warnSpy).toHaveBeenCalledTimes(0);
    warnSpy.mockRestore();
  });

  it('pickFile() resolves { kind: "failed", error } when input.click() throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fakeInput = createFakeInput();
    const clickSpy = vi.spyOn(fakeInput, 'click').mockImplementation(() => {
      throw new Error('click failed');
    });
    vi.spyOn(document, 'createElement').mockReturnValue(fakeInput);

    const port = createFilePickPort();
    const result = await port.pickFile();

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ kind: 'failed', error: new Error('click failed') });
    expect(warnSpy).toHaveBeenCalledTimes(0);
    warnSpy.mockRestore();
  });

  it('pickFile() settle guard ignores a second change after settlement', async () => {
    const fakeInput = createFakeInput();
    vi.spyOn(document, 'createElement').mockReturnValue(fakeInput);

    const port = createFilePickPort();
    const promise = port.pickFile();

    const onChange = getListener(fakeInput, 'change')!;
    const firstFile = new File(['first'], 'first.json', { type: 'application/json' });
    Object.defineProperty(fakeInput, 'files', { value: [firstFile], writable: true });
    await onChange();

    const secondFile = new File(['second'], 'second.json', { type: 'application/json' });
    Object.defineProperty(fakeInput, 'files', { value: [secondFile], writable: true });
    await onChange();

    const result = await promise;
    expect(result).toEqual({ kind: 'picked', text: 'first' });
  });

  it('pickFile() removes the input element from document.body after settlement', async () => {
    const realInput = document.createElement('input');
    const addEventListenerSpy = vi.spyOn(realInput, 'addEventListener');
    const clickSpy = vi.spyOn(realInput, 'click').mockImplementation(() => {
      const onChange = addEventListenerSpy.mock.calls.find(
        (c) => c[0] === 'change',
      )![1] as () => void;
      void onChange();
    });

    vi.spyOn(document, 'createElement').mockReturnValue(realInput);

    const port = createFilePickPort();
    const promise = port.pickFile();

    await clickSpy;
    await promise;

    expect(document.body.contains(realInput)).toBe(false);
  });

  it('pickFile() adds both change and cancel listeners', async () => {
    const fakeInput = createFakeInput();
    vi.spyOn(document, 'createElement').mockReturnValue(fakeInput);

    createFilePickPort().pickFile();

    const mock = fakeInput.addEventListener as unknown as ReturnType<typeof vi.fn>;
    const events = mock.mock.calls.map((c: unknown[]) => c[0]);
    expect(events).toEqual(['change', 'cancel']);
  });

  it('pickFile() resolves { kind: "cancelled" } when cancel event fires and removes input from body', async () => {
    const fakeInput = createFakeInput();
    vi.spyOn(document, 'createElement').mockReturnValue(fakeInput);

    const port = createFilePickPort();
    const promise = port.pickFile();

    const onCancel = getListener(fakeInput, 'cancel')!;
    onCancel();

    const result = await promise;
    expect(result).toEqual({ kind: 'cancelled' });
    expect(document.body.contains(fakeInput)).toBe(false);
  });

  it('pickFile() double-fire change(no file) then cancel settles once as cancelled', async () => {
    const fakeInput = createFakeInput();
    vi.spyOn(document, 'createElement').mockReturnValue(fakeInput);

    const port = createFilePickPort();
    const promise = port.pickFile();

    const onChange = getListener(fakeInput, 'change')!;
    const onCancel = getListener(fakeInput, 'cancel')!;
    Object.defineProperty(fakeInput, 'files', { value: null, writable: true });
    await onChange();
    onCancel();

    const result = await promise;
    expect(result).toEqual({ kind: 'cancelled' });
    expect(document.body.contains(fakeInput)).toBe(false);
  });

  it('readDroppedFile() resolves with { kind: "read", text } when file.text() succeeds', async () => {
    const port = createFilePickPort();
    const file = new File(['dropped content'], 'puzzle.json', { type: 'application/json' });

    const result = await port.readDroppedFile(file);

    expect(result).toEqual({ kind: 'read', text: 'dropped content' });
  });

  it('readDroppedFile() resolves with { kind: "failed", error } and does not warn when file.text() rejects with an Error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const port = createFilePickPort();
    const badFile = {
      text: () => Promise.reject(new Error('read error')),
    } as unknown as File;

    const result = await port.readDroppedFile(badFile);

    expect(result).toEqual({ kind: 'failed', error: new Error('read error') });
    expect(warnSpy).toHaveBeenCalledTimes(0);
    warnSpy.mockRestore();
  });

  it('readDroppedFile() resolves with { kind: "failed", error } and does not warn when file.text() rejects with a non-Error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const port = createFilePickPort();
    const badFile = {
      text: () => Promise.reject('boom'),
    } as unknown as File;

    const result = await port.readDroppedFile(badFile);

    expect(result).toEqual({ kind: 'failed', error: expect.any(Error) });
    if (result.kind !== 'failed') throw new Error('unreachable');
    expect(result.error.message).toContain('boom');
    expect(warnSpy).toHaveBeenCalledTimes(0);
    warnSpy.mockRestore();
  });
});
