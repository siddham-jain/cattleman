/**
 * Shared visual constants.
 *
 * Sizing leans large: this is used outdoors, one-handed, often in bright sun by
 * people who may be wearing gloves. Minimum touch target is 48dp and body text
 * does not go below 15sp.
 */
export const colors = {
  background: '#faf8f5',
  surface: '#ffffff',
  border: '#e3ddd4',
  text: '#1f1b16',
  textMuted: '#6b6259',
  primary: '#8a5a2b',
  primaryText: '#ffffff',
  cattle: '#a86b3c',
  buffalo: '#4a4340',
  success: '#3f7d3f',
  warning: '#b8860b',
  danger: '#a33a2c',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 6, md: 12, lg: 20 };

export const typography = {
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  heading: { fontSize: 18, fontWeight: '600', color: colors.text },
  body: { fontSize: 16, color: colors.text },
  small: { fontSize: 14, color: colors.textMuted },
};

export const TOUCH_TARGET = 48;

/** Confidence below this is presented as uncertain rather than as an answer. */
export const LOW_CONFIDENCE = 0.55;

export function confidenceColor(confidence) {
  if (confidence >= 0.75) return colors.success;
  if (confidence >= LOW_CONFIDENCE) return colors.warning;
  return colors.danger;
}
