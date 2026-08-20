import type { DownloadPort } from '../../src/domain/ports/ports';

export class StubDownloadPort implements DownloadPort {
  public downloads: { filename: string; content: string }[] = [];
  public nextDownloadError: Error | null = null;

  download(filename: string, content: string): Error | null {
    if (this.nextDownloadError !== null) {
      const e = this.nextDownloadError;
      this.nextDownloadError = null;
      this.downloads.push({ filename, content });
      return e;
    }
    this.downloads.push({ filename, content });
    return null;
  }

  // Test helpers:
  getDownloadCount(): number {
    return this.downloads.length;
  }

  getLastDownload(): { filename: string; content: string } | undefined {
    return this.downloads[this.downloads.length - 1];
  }

  reset(): void {
    this.downloads = [];
    this.nextDownloadError = null;
  }
}
