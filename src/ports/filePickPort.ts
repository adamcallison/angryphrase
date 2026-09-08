import type { FilePickPort } from '../domain/ports/ports';

// Click-pick path only. Drag-and-drop EVENTS cannot drive a Promise API, so the
// component extracts the File from the DragEvent and passes it to ondropfile;
// the port performs the read. Pick path unchanged.
export function createFilePickPort(): FilePickPort {
  return {
    pickFile(): Promise<string | null> {
      return new Promise((resolve) => {
        let input: HTMLInputElement;
        try {
          input = document.createElement('input');
        } catch (err) {
          console.warn('filePickPort: createElement failed:', err);
          resolve(null);
          return;
        }

        try {
          input.type = 'file';
          input.accept = 'application/json,.json';
          input.style.display = 'none';
          document.body.appendChild(input);
        } catch (err) {
          console.warn('filePickPort: setup failed:', err);
          resolve(null);
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

        const settle = (value: string | null): void => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(value);
        };

        const onChange = async () => {
          if (settled) return;
          const file = input.files && input.files[0];
          if (!file) {
            settle(null);
            return;
          }

          try {
            const text = await file.text();
            settle(text);
          } catch (err) {
            console.warn('filePickPort: failed to read file text:', err);
            settle(null);
          }
        };

        input.addEventListener('change', onChange, { once: true });

        try {
          input.click();
        } catch (err) {
          console.warn('filePickPort: click failed:', err);
          settle(null);
        }
      });
    },
    readDroppedFile(file: File): Promise<string | null> {
      return file.text().catch((err) => {
        console.warn('filePickPort: failed to read dropped file text:', err);
        return null;
      });
    },
  };
}

export const filePickPort: FilePickPort = createFilePickPort();
