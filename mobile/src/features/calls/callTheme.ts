// Agora call UI — dark navy theme per the native handoff (#141a2e → #0a0d18,
// white status text). Existing keys (overlay/surfaceMuted/textMuted/scrim*)
// keep their names so call screens pick up the refreshed values automatically.
export const callColours = {
  // backdrop (flat) + gradient endpoints for the call canvas
  overlay:      '#10152A', // deep navy base
  navyTop:      '#141A2E',
  navyBottom:   '#0A0D18',

  surfaceMuted: '#1E2740', // control buttons / inactive chips
  textMuted:    '#9AA6C0',

  // action buttons
  accept:       '#22C55E', // accept call (green)
  decline:      '#EF4444', // decline / end call (red)

  black:        '#000',
  scrimLight:   'rgba(0,0,0,0.4)',
  scrim:        'rgba(0,0,0,0.5)',
  scrimDark:    'rgba(0,0,0,0.65)',
  scrimDeep:    'rgba(0,0,0,0.7)',
} as const;
