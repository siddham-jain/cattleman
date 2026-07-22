import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing } from '../theme';

/** Small status marker: animal type, sync state, confidence. */
export default function Pill({ label, color = colors.textMuted, icon, filled }) {
  return (
    <View style={[
      styles.pill,
      filled ? { backgroundColor: color } : { backgroundColor: `${color}1a` },
    ]}>
      {icon ? (
        <Ionicons name={icon} size={13} color={filled ? colors.primaryText : color} />
      ) : null}
      <Text style={[styles.text, { color: filled ? colors.primaryText : color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.pill, alignSelf: 'flex-start',
  },
  text: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
});
