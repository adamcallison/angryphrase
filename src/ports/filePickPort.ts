import type { FilePickPort, PickResult } from '../domain/ports/ports';

function coerceError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

// Click-pick path + drag-and-drop reads. Drag-and-drop EVENTS cannot drive a
// Promise API, so the component extracts the File from the DragEvent and passes
// it to ondropfile; the port performs the read. Silent adapter (P4): failures
// travel as data (PickResult / DroppedFileResult); the bindings facades warn.
export function createFilePickPort(): FilePickPort {
  return {
    pickFile(): Promise<PickResult> {
      return new Promise((resolve) => {
        let input: HTMLInputElement;
        try {
          input = document.createElement('input');
        } catch (err) {
          resolve({ kind: 'failed', error: coerceError(err) });
          return;
        }

        let settled = false;
        const cleanup = () => {
          try {
            document.body.removeChild(input);
          } catch {
            // already removed
          }
        };

        const settle = (value: PickResult): void => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(value);
        };

        try {
          input.type = 'file';
          input.accept = 'application/json,.json';
          input.style.display = 'none';
          document.body.appendChild(input);
        } catch (err) {
          cleanup();
          settle({ kind: 'failed', error: coerceError(err) });
          return;
        }

        const onChange = async () => {
          if (settled) return;
          const file = input.files && input.files[0];
          if (!file) {
            settle({ kind: 'cancelled' });
            return;
          }

          try {
            const text = await file.text();
            settle({ kind: 'picked', text });
          } catch (err) {
            settle({ kind: 'failed', error: coerceError(err) });
          }
        };

        const onCancel = () => {
          settle({ kind: 'cancelled' });
        };

        input.addEventListener('change', onChange, { once: true });
        input.addEventListener('cancel', onCancel, { once: true });

        try {
          input.click();
        } catch (err) {
          settle({ kind: 'failed', error: coerceError(err) });
        }
      });
    },
    readDroppedFile(file: File): Promise<{ kind: 'read'; text: string } | { kind: 'failed'; error: Error }> {
      return file.text().then(
        (text) => ({ kind: 'read', text }),
        (err) => ({ kind: 'failed', error: err instanceof Error ? err : new Error(String(err)) }),
      );
    },
  };
}

export const filePickPort: FilePickPort = createFilePickPort();
