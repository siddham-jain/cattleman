/**
 * Shared visual constants.
 *
 * Sizing leans large: this is used outdoors, one-handed, often in bright sun by
 * people who may be wearing gloves. Minimum touch target is 48dp and body text
 * does not go below 15sp.
 *
 * Type uses the platform's own font. A bundled display face would look sharper
 * in English and render tofu in Hindi and Marathi, which two of the three
 * supported languages are written in.
 */
import { Platform } from 'react-native';

export const colors = {
  background: '#f6f4f0',
  surface: '#ffffff',
  surfaceMuted: '#efeae2',
  border: '#e7e1d8',
  text: '#191614',
  textMuted: '#78706a',
  primary: '#1f6f4a',
  primarySoft: '#e7f1ec',
  primaryText: '#ffffff',
  cattle: '#c07430',
  buffalo: '#4a4340',
  success: '#1f6f4a',
  warning: '#b06a00',
  warningSoft: '#fdf3e2',
  danger: '#b03a2c',
  dangerSoft: '#fbeceb',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 8, md: 14, lg: 20, pill: 999 };

export const typography = {
  display: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  heading: { fontSize: 17, fontWeight: '700', color: colors.text },
  body: { fontSize: 16, color: colors.text, lineHeight: 23 },
  small: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  label: {
    fontSize: 12, fontWeight: '700', color: colors.textMuted,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
};

/** react-native-web translates the iOS shadow props, so it shares them. */
export const shadow = Platform.select({
  android: { elevation: 2 },
  default: {
    shadowColor: '#2a211a',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
});

export const TOUCH_TARGET = 48;

/** Confidence below this is presented as uncertain rather than as an answer. */
export const LOW_CONFIDENCE = 0.55;

export function confidenceColor(confidence) {
  if (confidence >= 0.75) return colors.success;
  if (confidence >= LOW_CONFIDENCE) return colors.warning;
  return colors.danger;
}

export function animalTypeColor(animalType) {
  return animalType === 'buffalo' ? colors.buffalo : colors.cattle;
}
