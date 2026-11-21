export type SaveBannerVM = {
  message: string;
};

// Slice-keyed copy: state stores booleans only; every user-visible word
// lives here (§8/§9). Exhaustive Record: a third slice fails to compile
// instead of silently rendering undefined.
const MESSAGE: Record<'builder' | 'player', string> = {
  builder: 'Saving failed — your Builder changes are not being kept. Download an export to keep a copy.',
  player: 'Saving failed — your solving progress is not being kept.',
};

export function deriveSaveBannerVM(failed: boolean, slice: 'builder' | 'player'): SaveBannerVM | null {
  if (!failed) return null;
  return { message: MESSAGE[slice] };
}
