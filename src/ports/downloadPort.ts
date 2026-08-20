import type { DownloadPort } from '../domain/ports/ports.ts';

export function createDownloadPort(): DownloadPort {
  return {
    download(filename: string, content: string): Error | null {
      try {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return null;
      } catch (err) {
        return err instanceof Error ? err : new Error(String(err));
      }
    },
  };
}

export const downloadPort: DownloadPort = createDownloadPort();
