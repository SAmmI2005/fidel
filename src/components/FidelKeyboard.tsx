/**
 * FidelKeyboard — custom on-screen Ethiopic input.
 *
 * Interaction model mirrors how the script actually works: pick the
 * consonant family (base row), then pick the vowel order (1–7) from a
 * popover row. This doubles as reinforcement of the family structure —
 * the keyboard *is* a fidel chart.
 *
 * Families the user hasn't formally met yet render locked (dimmed) unless
 * `unlockedFamilies` is omitted, so tier-2 dictation can't be brute-forced
 * with glyphs the learner hasn't been taught.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { CourseId } from '../types/content';
import { getCourse } from '../content/loader';
import { colors, radii, space, type } from '../theme';

interface Props {
  courseId: CourseId;
  onKey: (glyph: string) => void;
  onBackspace: () => void;
  onSubmit: () => void;
  /** family keys available; omit to unlock everything */
  unlockedFamilies?: string[];
  showRomanHints?: boolean;
}

export function FidelKeyboard({
  courseId,
  onKey,
  onBackspace,
  onSubmit,
  unlockedFamilies,
  showRomanHints = true,
}: Props) {
  const { content } = getCourse(courseId);
  const [openFamily, setOpenFamily] = useState<string | null>(null);

  const families = useMemo(() => {
    const unlocked = unlockedFamilies ? new Set(unlockedFamilies) : null;
    return content.families.map((f) => ({ ...f, locked: unlocked ? !unlocked.has(f.key) : false }));
  }, [content.families, unlockedFamilies]);

  const open = families.find((f) => f.key === openFamily && !f.locked) ?? null;

  return (
    <View style={styles.wrap}>
      {/* Order picker: the 7 vowel forms of the selected family */}
      <View style={styles.orderRow}>
        {open ? (
          open.forms.map((glyph, i) => (
            <Pressable
              key={glyph}
              style={({ pressed }) => [styles.orderKey, pressed && styles.pressed]}
              onPress={() => {
                Haptics.selectionAsync();
                onKey(glyph);
                setOpenFamily(null);
              }}
            >
              <Text style={styles.orderGlyph}>{glyph}</Text>
              {showRomanHints && <Text style={styles.roman}>{open.romanized[i]}</Text>}
            </Pressable>
          ))
        ) : (
          <Text style={styles.placeholder}>pick a letter family below</Text>
        )}
      </View>

      {/* Base row: first-order glyph of each family */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.baseRow}>
        {families.map((f) => (
          <Pressable
            key={f.key}
            disabled={f.locked}
            style={({ pressed }) => [
              styles.baseKey,
              f.key === openFamily && styles.baseKeyActive,
              f.locked && styles.locked,
              pressed && styles.pressed,
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setOpenFamily((k) => (k === f.key ? null : f.key));
            }}
          >
            <Text style={[styles.baseGlyph, f.locked && { color: colors.hairline }]}>{f.forms[0]}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable style={[styles.action, styles.actionQuiet]} onPress={onBackspace}>
          <Text style={styles.actionText}>⌫</Text>
        </Pressable>
        <Pressable style={[styles.action, styles.actionPrimary]} onPress={onSubmit}>
          <Text style={[styles.actionText, { color: colors.bone }]}>Check</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space(2), paddingVertical: space(2) },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space(1.5),
    minHeight: 64,
    alignItems: 'center',
  },
  orderKey: {
    backgroundColor: colors.groundRaised,
    borderRadius: radii.key,
    paddingHorizontal: space(2.5),
    paddingVertical: space(1.5),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  orderGlyph: { fontSize: 26, color: colors.bone },
  roman: { fontSize: 10, color: colors.boneDim, marginTop: 2 },
  placeholder: { ...type.caption },
  baseRow: { gap: space(1.5), paddingHorizontal: space(2) },
  baseKey: {
    backgroundColor: colors.groundSunken,
    borderRadius: radii.key,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  baseKeyActive: { borderColor: colors.rubric, backgroundColor: colors.groundRaised },
  baseGlyph: { fontSize: 24, color: colors.bone },
  locked: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
  actions: { flexDirection: 'row', gap: space(2), paddingHorizontal: space(2) },
  action: {
    flex: 1,
    borderRadius: radii.card,
    paddingVertical: space(3),
    alignItems: 'center',
  },
  actionQuiet: { backgroundColor: colors.groundRaised },
  actionPrimary: { backgroundColor: colors.rubric },
  actionText: { fontSize: 17, fontWeight: '700', color: colors.boneDim },
});
