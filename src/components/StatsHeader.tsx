/** Streak flame, XP, hearts — shown on the tree and inside lessons. */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, space } from '../theme';
import { useProgressStore, MAX_HEARTS } from '../state/useProgressStore';

export function StatsHeader() {
  const streak = useProgressStore((s) => s.streak);
  const hearts = useProgressStore((s) => s.hearts);
  const course = useProgressStore((s) => s.course);
  const xp = useProgressStore((s) => (s.course ? s.byCourse[s.course].xp : 0));

  if (!course) return null;
  return (
    <View style={styles.row}>
      <Stat label="streak" value={`🔥 ${streak}`} />
      <Stat label="xp" value={`✦ ${xp}`} color={colors.brass} />
      <Stat label="hearts" value={`♥ ${hearts}/${MAX_HEARTS}`} color={colors.rubric} />
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.value, color ? { color } : null]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: space(2),
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  stat: { alignItems: 'center' },
  value: { fontSize: 17, fontWeight: '700', color: colors.bone },
  label: { fontSize: 11, color: colors.boneDim, letterSpacing: 0.8, textTransform: 'uppercase' },
});
