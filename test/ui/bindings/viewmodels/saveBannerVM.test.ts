import { describe, it, expect } from 'vitest';
import { deriveSaveBannerVM } from '../../../../src/ui/bindings/viewmodels/saveBannerVM';

describe('saveBannerVM', () => {
  it('deriveSaveBannerVM: returns null when the builder slice is healthy', () => {
    expect(deriveSaveBannerVM(false, 'builder')).toBeNull();
  });

  it('deriveSaveBannerVM: returns null when the player slice is healthy', () => {
    expect(deriveSaveBannerVM(false, 'player')).toBeNull();
  });

  it('deriveSaveBannerVM: returns the exact builder message when the builder slice failed', () => {
    const vm = deriveSaveBannerVM(true, 'builder');

    expect(vm).not.toBeNull();
    expect(vm!.message).toBe(
      'Saving failed — your Builder changes are not being kept. Download an export to keep a copy.',
    );
  });

  it('deriveSaveBannerVM: returns the exact player message when the player slice failed', () => {
    const vm = deriveSaveBannerVM(true, 'player');

    expect(vm).not.toBeNull();
    expect(vm!.message).toBe('Saving failed — your solving progress is not being kept.');
  });
});
