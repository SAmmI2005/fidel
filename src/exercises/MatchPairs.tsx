/** Tier-2 family drill: match fidel glyphs to their transliterations. */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MatchPairsExercise } from '../engine/exerciseGenerator';
import { colors, radii, space, type } from '../theme';
import type { ExerciseProps } from './common';

export function MatchPairs({ exercise, onAnswer }: ExerciseProps<MatchPairsExercise>) {
  const glyphs = exercise.pairs;
  const romans = useMemo(() => [...exercise.pairs].sort(() => Math.random() - 0.5), [exercise.id]);

  const [selGlyph, setSelGlyph] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [misses, setMisses] = useState(0);
  const [done, setDone] = useState(false);

  const tryMatch = (romanId: string) => {
    if (!selGlyph || done) return;
    if (romanId === selGlyph) {
      const next = new Set(matched).add(romanId);
      setMatched(next);
      setSelGlyph(null);
      if (next.size === glyphs.length) {
        setDone(true);
        onAnswer(misses === 0 ? 2 : misses <= 2 ? 1 : 0);
      }
    } else {
      setMisses((m) => m + 1);
      setSelGlyph(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={type.caption}>Match the pairs</Text>
      <View style={styles.cols}>
        <View style={styles.col}>
          {glyphs.map((g) => (
            <Pressable
              key={g.id}
              disabled={matched.has(g.id)}
              style={[styles.card, selGlyph === g.id && styles.sel, matched.has(g.id) && styles.done]}
              onPress={() => setSelGlyph(g.id)}
            >
              <Text style={styles.glyph}>{g.glyph}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.col}>
          {romans.map((g) => (
            <Pressable
              key={g.id}
              disabled={matched.has(g.id)}
              style={[styles.card, matched.has(g.id) && styles.done]}
              onPress={() => tryMatch(g.id)}
            >
              <Text style={styles.roman}>{g.transliteration}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {misses > 0 && !done && <Text style={styles.miss}>misses: {misses}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', gap: space(4), paddingTop: space(4) },
  cols: { flexDirection: 'row', gap: space(6) },
  col: { gap: space(2) },
  card: {
    backgroundColor: colors.groundRaised,
    borderRadius: radii.card,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    width: 120,
    paddingVertical: space(3),
    alignItems: 'center',
  },
  sel: { borderColor: colors.rubric },
  done: { opacity: 0.35, borderColor: colors.leaf },
  glyph: { fontSize: 34, color: colors.bone },
  roman: { fontSize: 20, fontWeight: '600', color: colors.bone },
  miss: { ...type.caption, color: colors.error },
});
