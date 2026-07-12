/** Fidel → meaning. Rendered per the user's tier (fidel-primary at tier 3). */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MultipleChoiceExercise } from '../engine/exerciseGenerator';
import { AudioButton } from '../components/AudioButton';
import { TierText } from '../components/TierText';
import { colors, radii, space, type } from '../theme';
import type { ExerciseProps } from './common';

export function MultipleChoice({ exercise, courseId, tier, onAnswer }: ExerciseProps<MultipleChoiceExercise>) {
  const [picked, setPicked] = useState<number | null>(null);
  const [hint, setHint] = useState(false);
  const done = picked != null;

  return (
    <View style={styles.wrap}>
      <Text style={type.caption}>What does this mean?</Text>
      <TierText item={exercise.target} tier={tier} onHintUsed={() => setHint(true)} />
      <AudioButton courseId={courseId} item={exercise.target} size="small" />
      <View style={styles.list}>
        {exercise.choices.map((c, i) => {
          const state = !done ? 'idle' : c.correct ? 'right' : i === picked ? 'wrong' : 'dim';
          return (
            <Pressable
              key={i}
              disabled={done}
              style={[styles.row, state === 'right' && styles.right, state === 'wrong' && styles.wrong, state === 'dim' && { opacity: 0.4 }]}
              onPress={() => {
                setPicked(i);
                onAnswer(c.correct ? (hint ? 1 : 2) : 0);
              }}
            >
              <Text style={type.body}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space(4), flex: 1, paddingTop: space(4) },
  list: { alignSelf: 'stretch', gap: space(2), paddingHorizontal: space(4) },
  row: {
    backgroundColor: colors.groundRaised,
    borderRadius: radii.card,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    paddingVertical: space(4),
    alignItems: 'center',
  },
  right: { borderColor: colors.leaf },
  wrong: { borderColor: colors.error },
});
