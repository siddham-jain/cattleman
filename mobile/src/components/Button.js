import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, TOUCH_TARGET, typography } from '../theme';

/**
 * The app's only button.
 *
 * `primary` is the one action a screen wants you to take, `secondary` is the way
 * back or sideways, and `quiet` is for anything that only borrows the row.
 */
export default function Button({
  label, onPress, variant = 'secondary', icon, disabled, busy, style,
}) {
  const tone = variant === 'primary' ? colors.primaryText : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || busy) }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        (disabled || busy) && styles.disabled,
        style,
      ]}
    >
      {busy
        ? <ActivityIndicator color={tone} />
        : (
          <>
            {icon ? <Ionicons name={icon} size={20} color={tone} /> : null}
            <Text style={[styles.label, { color: tone }]}>{label}</Text>
          </>
        )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_TARGET + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  quiet: { backgroundColor: 'transparent', minHeight: TOUCH_TARGET },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
  label: { ...typography.body, fontWeight: '700' },
});
