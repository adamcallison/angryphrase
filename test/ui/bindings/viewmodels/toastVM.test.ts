import { describe, it, expect } from 'vitest';
import { deriveToastVM, deriveToastListVM } from '../../../../src/ui/bindings/viewmodels/toastVM';
import type { Toast } from '../../../../src/domain/notifications/Toast';
import { brand } from '../../../../src/domain/brand';
import { EpochMs } from '../../../../src/domain/time/EpochMs';
import { DurationMs } from '../../../../src/domain/time/DurationMs';

function fixture(kind: Toast['kind'], message: string): Toast {
  return {
    id: brand<'ToastId', string>('abc'),
    kind,
    message,
    createdAt: EpochMs.of(1000),
    ttlMs: DurationMs.of(3500),
  };
}

describe('deriveToastVM', () => {
  it('deriveToastVM: projects id, kind, message; drops createdAt and ttlMs', () => {
    const toast: Toast = fixture('info', 'hello world');
    const vm = deriveToastVM(toast);
    expect(vm.id).toBe(toast.id);
    expect(vm.kind).toBe('info');
    expect(vm.message).toBe('hello world');
    expect(vm).not.toHaveProperty('createdAt');
    expect(vm).not.toHaveProperty('ttlMs');
  });

  it('deriveToastVM: preserves branded ToastId (referential equality)', () => {
    const toast: Toast = fixture('warning', 'watch out');
    const vm = deriveToastVM(toast);
    expect(vm.id).toBe(toast.id);
  });
});

describe('deriveToastListVM', () => {
  it('deriveToastListVM: maps over the array in order', () => {
    const a: Toast = fixture('info', 'first');
    const b: Toast = fixture('success', 'second');
    const c: Toast = fixture('error', 'third');
    const vms = deriveToastListVM([a, b, c]);
    expect(vms).toHaveLength(3);
    expect(vms[0]!.message).toBe('first');
    expect(vms[1]!.message).toBe('second');
    expect(vms[2]!.message).toBe('third');
    expect(vms[0]!.id).toBe(a.id);
    expect(vms[1]!.kind).toBe('success');
    expect(vms[2]!.kind).toBe('error');
  });

  it('deriveToastListVM: empty input → empty output', () => {
    const vms = deriveToastListVM([]);
    expect(vms).toEqual([]);
  });
});
