/** Hear audio → pick the matching fidel. The workhorse audio exercise. */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ListenSelectExercise } from '../engine/exerciseGenerator';
import { AudioButton } from '../components/AudioButton';
import { TierText } from '../components/TierText';
import { colors, radii, space, type } from '../theme';
import type { ExerciseProps } from './common';

export function ListenSelect({ exercise, courseId, tier, onAnswer }: ExerciseProps<ListenSelectExercise>) {
  const [picked, setPicked] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const done = picked != null;

  return (
    <View style={styles.wrap}>
      <Text style={type.caption}>Tap what you hear</Text>
      <AudioButton courseId={courseId} item={exercise.target} autoPlayKey={exercise.id} />
      <View style={styles.grid}>
        {exercise.choices.map((c) => {
          const isTarget = c.id === exercise.target.id;
          const state = !done ? 'idle' : isTarget ? 'right' : c.id === picked ? 'wrong' : 'dim';
          return (
            <Pressable
              key={c.id}
              disabled={done}
              style={[styles.card, state === 'right' && styles.right, state === 'wrong' && styles.wrong, state === 'dim' && { opacity: 0.4 }]}
              onPress={() => {
                setPicked(c.id);
                onAnswer(isTarget ? (hint ? 1 : 2) : 0);
              }}
            >
              <TierText item={c} tier={tier} size="chip" onHintUsed={() => setHint(true)} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space(5), flex: 1, paddingTop: space(4) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3), justifyContent: 'center' },
  card: {
    backgroundColor: colors.groundRaised,
    borderRadius: radii.card,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    width: 140,
    paddingVertical: space(5),
    alignItems: 'center',
  },
  right: { borderColor: colors.leaf },
  wrong: { borderColor: colors.error },
});
