import type { StoragePort } from '../../domain/persistence/ports';
import type { DownloadPort } from '../../domain/persistence/ports';
import type { FilePickPort } from '../../domain/persistence/ports';
import type { Rng } from '../../domain/rng/Rng';
import { localStoragePort as defaultStoragePort } from '../../ports/localStoragePort';
import { downloadPort as defaultDownloadPort } from '../../ports/downloadPort';
import { filePickPort as defaultFilePickPort } from '../../ports/filePickPort';
import { rngPort as defaultRngPort } from '../../ports/rngPort';

export type Ports = {
  storage: StoragePort;
  download: DownloadPort;
  filePick: FilePickPort;
  rng: Rng;
};

// Mutable register so tests can swap individual ports in isolation.
// Default values are the production browser-backed implementations.
const ports: Ports = {
  storage: defaultStoragePort,
  download: defaultDownloadPort,
  filePick: defaultFilePickPort,
  rng: defaultRngPort,
};

export function getPorts(): Ports {
  return ports;
}

export function setPorts(next: Partial<Ports>): void {
  Object.assign(ports, next);
}

export function resetPorts(): void {
  ports.storage = defaultStoragePort;
  ports.download = defaultDownloadPort;
  ports.filePick = defaultFilePickPort;
  ports.rng = defaultRngPort;
}
