import type { DownloadPort } from '../domain/persistence/ports.ts';

export function createDownloadPort(): DownloadPort {
  return {
    download(filename: string, content: string): void {
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
      } catch (err) {
        console.warn('downloadPort.download failed:', err);
      }
    },
  };
}

export const downloadPort: DownloadPort = createDownloadPort();
