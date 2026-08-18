import type { DownloadPort } from '../../src/domain/ports/ports';

export class StubDownloadPort implements DownloadPort {
  public downloads: { filename: string; content: string }[] = [];

  download(filename: string, content: string): void {
    this.downloads.push({ filename, content });
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
  }
}
