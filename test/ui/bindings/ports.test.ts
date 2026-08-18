import { describe, it, expect } from 'vitest';
import { getPorts, setPorts, resetPorts } from '../../../src/ui/bindings/ports';
import { InMemoryStoragePort } from '../../fakes/InMemoryStoragePort';
import { StubDownloadPort } from '../../fakes/StubDownloadPort';
import { SeededRng } from '../../fakes/SeededRng';
import type { FilePickPort } from '../../../src/domain/ports/ports';

describe('ports.ts', () => {
  it('ports.ts: getPorts() returns the four port instances by default (each non-null, referentially stable across calls)', () => {
    const ports = getPorts();
    expect(ports.storage).toBeTruthy();
    expect(ports.download).toBeTruthy();
    expect(ports.filePick).toBeTruthy();
    expect(ports.rng).toBeTruthy();

    const portsAgain = getPorts();
    expect(portsAgain.storage).toBe(ports.storage);
    expect(portsAgain.download).toBe(ports.download);
    expect(portsAgain.filePick).toBe(ports.filePick);
    expect(portsAgain.rng).toBe(ports.rng);
  });

  it('ports.ts: setPorts({ storage: inMemory }) swaps storage; getPorts().storage === inMemory', () => {
    const inMemory = new InMemoryStoragePort();
    try {
      setPorts({ storage: inMemory });
      expect(getPorts().storage).toBe(inMemory);
    } finally {
      resetPorts();
    }
  });

  it('ports.ts: setPorts does not affect other slots (download unchanged)', () => {
    const inMemory = new InMemoryStoragePort();
    const beforeDownload = getPorts().download;
    try {
      setPorts({ storage: inMemory });
      expect(getPorts().download).toBe(beforeDownload);
    } finally {
      resetPorts();
    }
  });

  it('ports.ts: resetPorts() restores defaults for swapped slot (storage === original)', () => {
    const inMemory = new InMemoryStoragePort();
    const originalStorage = getPorts().storage;
    try {
      setPorts({ storage: inMemory });
      resetPorts();
      expect(getPorts().storage).toBe(originalStorage);
    } finally {
      resetPorts();
    }
  });

  it('ports.ts: resetPorts() restores defaults for all swapped slots', () => {
    const original = getPorts();
    const fakeStorage = new InMemoryStoragePort();
    const fakeDownload = new StubDownloadPort();
    const fakeFilePick: FilePickPort = { pickFile: async () => null };
    const fakeRng = new SeededRng(42);

    try {
      setPorts({
        storage: fakeStorage,
        download: fakeDownload,
        filePick: fakeFilePick,
        rng: fakeRng,
      });
      resetPorts();
      expect(getPorts().storage).toBe(original.storage);
      expect(getPorts().download).toBe(original.download);
      expect(getPorts().filePick).toBe(original.filePick);
      expect(getPorts().rng).toBe(original.rng);
    } finally {
      resetPorts();
    }
  });
});
