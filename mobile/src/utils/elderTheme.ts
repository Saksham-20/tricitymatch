import { tapTarget } from '@shared/constants/theme';

/** Elder mode's hit-target floor (doctrine §10.6/§10.10). */
export function tapSize(elder: boolean): number {
  return elder ? tapTarget.elder : tapTarget.default;
}
