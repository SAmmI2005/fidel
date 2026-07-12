/** A word with one glyph missing — pick the missing glyph. */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FillBlankExercise } from '../engine/exerciseGenerator';
import { AudioButton } from '../components/AudioButton';
import { colors, radii, space, type } from '../theme';
import type { ExerciseProps } from './common';

export function FillBlank({ exercise, courseId, onAnswer }: ExerciseProps<FillBlankExercise>) {
  const [picked, setPicked] = useState<string | null>(null);
  const done = picked != null;
  const missing = exercise.target.glyph[exercise.blankIndex];

  return (
    <View style={styles.wrap}>
      <Text style={type.caption}>Complete the word</Text>
      {exercise.target.english_gloss && <Text style={type.body}>“{exercise.target.english_gloss}”</Text>}
      <View style={styles.word}>
        {exercise.shownGlyphs.map((g, i) => (
          <View key={i} style={[styles.slot, g == null && styles.blank]}>
            <Text style={type.fidelLarge}>{g ? g.glyph : done ? missing : ' '}</Text>
          </View>
        ))}
      </View>
      <AudioButton courseId={courseId} item={exercise.target} size="small" />
      <View style={styles.grid}>
        {exercise.choices.map((c) => {
          const isRight = c.glyph === missing;
          const state = !done ? 'idle' : isRight ? 'right' : c.id === picked ? 'wrong' : 'dim';
          return (
            <Pressable
              key={c.id}
              disabled={done}
              style={[styles.key, state === 'right' && styles.right, state === 'wrong' && styles.wrong, state === 'dim' && { opacity: 0.4 }]}
              onPress={() => {
                setPicked(c.id);
                onAnswer(isRight ? 2 : 0);
              }}
            >
              <Text style={styles.keyGlyph}>{c.glyph}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space(4), flex: 1, paddingTop: space(4) },
  word: { flexDirection: 'row', gap: space(1.5) },
  slot: { paddingHorizontal: space(1) },
  blank: { borderBottomWidth: 3, borderBottomColor: colors.rubric, minWidth: 48, alignItems: 'center' },
  grid: { flexDirection: 'row', gap: space(3), flexWrap: 'wrap', justifyContent: 'center' },
  key: {
    backgroundColor: colors.groundRaised,
    borderRadius: radii.card,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyGlyph: { fontSize: 34, color: colors.bone },
  right: { borderColor: colors.leaf },
  wrong: { borderColor: colors.error },
});
