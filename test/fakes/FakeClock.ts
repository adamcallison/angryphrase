import { EpochMs } from '../../src/domain/time/EpochMs';

export class FakeClock {
  private current: number;

  constructor(start: number = 0) {
    this.current = start;
  }

  now(): EpochMs {
    return EpochMs.of(this.current);
  }

  advance(by: number): void {
    this.current += by;
  }

  setTo(value: number): void {
    this.current = value;
  }
}
