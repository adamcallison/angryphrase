export class FakeClock {
  private current: number;

  constructor(start: number = 0) {
    this.current = start;
  }

  now(): number {
    return this.current;
  }

  advance(by: number): void {
    this.current += by;
  }

  setTo(value: number): void {
    this.current = value;
  }
}
