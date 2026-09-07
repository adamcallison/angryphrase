import type { FilePickPort } from '../domain/ports/ports';

// Click-pick path only. Drag-and-drop file reading is handled by the
// FilePicker.svelte component in Task 67; the FilePickPort interface's single
// Promise-returning pickFile() cannot cleanly model event-driven drops.
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
  };
}

export const filePickPort: FilePickPort = createFilePickPort();
