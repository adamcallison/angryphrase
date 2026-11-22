import { describe, it, expect } from 'vitest';
import { deriveToastVM, deriveToastListVM } from '../../../../src/ui/bindings/viewmodels/toastVM';
import type { Toast } from '../../../../src/domain/notifications/Toast';
import type { ToastReason } from '../../../../src/domain/notifications/ToastReason';
import { brand } from '../../../../src/domain/brand';
import { EpochMs } from '../../../../src/domain/time/EpochMs';
import { DurationMs } from '../../../../src/domain/time/DurationMs';

function fixture(kind: Toast['kind'], reason: ToastReason): Toast {
  return {
    id: brand<'ToastId', string>('abc'),
    kind,
    reason,
    createdAt: EpochMs.of(1000),
    ttlMs: DurationMs.DEFAULT,
  };
}

describe('deriveToastVM', () => {
  it('deriveToastVM: projects id, kind, message, ttlMs; drops createdAt', () => {
    const toast: Toast = fixture('info', { code: 'edit-clue-non-head' });
    const vm = deriveToastVM(toast);
    expect(vm.id).toBe(toast.id);
    expect(vm.kind).toBe('info');
    expect(vm.message).toBe('Cannot edit clue of a non-head chain word.');
    expect(vm.ttlMs).toBe(3500);
    expect(vm).not.toHaveProperty('createdAt');
  });

  it('deriveToastVM: preserves branded ToastId (referential equality)', () => {
    const toast: Toast = fixture('warning', { code: 'import-read-failure' });
    const vm = deriveToastVM(toast);
    expect(vm.id).toBe(toast.id);
  });

  it('deriveToastVM: announcement prefixes the kind word for each ToastKind', () => {
    expect(deriveToastVM(fixture('info', { code: 'download-failure' })).announcement).toBe('Info: Download failed. Please try again.');
    expect(deriveToastVM(fixture('success', { code: 'download-failure' })).announcement).toBe('Success: Download failed. Please try again.');
    expect(deriveToastVM(fixture('warning', { code: 'download-failure' })).announcement).toBe('Warning: Download failed. Please try again.');
    expect(deriveToastVM(fixture('error', { code: 'download-failure' })).announcement).toBe('Error: Download failed. Please try again.');
  });
});

describe('deriveToastListVM', () => {
  it('deriveToastListVM: maps over the array in order', () => {
    const a: Toast = fixture('info', { code: 'import-read-failure' });
    const b: Toast = fixture('success', { code: 'import-pick-failure' });
    const c: Toast = fixture('error', { code: 'grid-size-invalid' });
    const vms = deriveToastListVM([a, b, c]);
    expect(vms).toHaveLength(3);
    expect(vms[0]!.message).toBe('Could not read that file. Please try again.');
    expect(vms[1]!.message).toBe('Could not open or read that file. Please try again.');
    expect(vms[2]!.message).toBe('Grid size must be a whole number between 2 and 25.');
    expect(vms[0]!.id).toBe(a.id);
    expect(vms[1]!.kind).toBe('success');
    expect(vms[2]!.kind).toBe('error');
  });

  it('deriveToastListVM: empty input → empty output', () => {
    const vms = deriveToastListVM([]);
    expect(vms).toEqual([]);
  });

  it('deriveToastListVM: announcements derive per toast in order', () => {
    const a: Toast = fixture('info', { code: 'import-read-failure' });
    const b: Toast = fixture('error', { code: 'import-pick-failure' });
    const vms = deriveToastListVM([a, b]);
    expect(vms[0]!.announcement).toBe('Info: Could not read that file. Please try again.');
    expect(vms[1]!.announcement).toBe('Error: Could not open or read that file. Please try again.');
  });
});
