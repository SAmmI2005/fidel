/** Hear audio → write it with the fidel keyboard. The tier-3 endgame skill. */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ListenWriteExercise } from '../engine/exerciseGenerator';
import { AudioButton } from '../components/AudioButton';
import { FidelKeyboard } from '../components/FidelKeyboard';
import { useProgressStore } from '../state/useProgressStore';
import { colors, space, type } from '../theme';
import type { ExerciseProps } from './common';

export function ListenWrite({ exercise, courseId, tier, onAnswer }: ExerciseProps<ListenWriteExercise>) {
  const [typed, setTyped] = useState<string[]>([]);
  const [result, setResult] = useState<null | boolean>(null);
  const answer = exercise.answerGlyphs.map((g) => g.glyph).join('');
  const mastered = useProgressStore((s) =>
    s.course ? Object.keys(s.byCourse[s.course].masteredFamilies) : []
  );

  const check = () => {
    if (result != null) return;
    const ok = typed.join('') === answer;
    setResult(ok);
    onAnswer(ok ? 2 : 0);
  };

  return (
    <View style={styles.wrap}>
      <Text style={type.caption}>Write what you hear</Text>
      <AudioButton courseId={courseId} item={exercise.target} autoPlayKey={exercise.id} />
      <View style={styles.line}>
        <Text style={[type.fidelLarge, result === false && { color: colors.error }, result === true && { color: colors.leaf }]}>
          {typed.length ? typed.join('') : ' '}
        </Text>
      </View>
      {result === false && (
        <Text style={styles.correction}>
          {answer} · {exercise.target.transliteration}
        </Text>
      )}
      <View style={styles.kb}>
        <FidelKeyboard
          courseId={courseId}
          // tier 3 users have earned the whole chart; earlier tiers only what they've met
          unlockedFamilies={tier >= 3 ? undefined : mastered}
          showRomanHints={tier < 3}
          onKey={(g) => result == null && setTyped((t) => [...t, g])}
          onBackspace={() => result == null && setTyped((t) => t.slice(0, -1))}
          onSubmit={check}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', gap: space(3), paddingTop: space(3) },
  line: {
    minHeight: 72,
    minWidth: 200,
    borderBottomWidth: 2,
    borderBottomColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  correction: { ...type.body, color: colors.boneDim },
  kb: { alignSelf: 'stretch', marginTop: 'auto' },
});
