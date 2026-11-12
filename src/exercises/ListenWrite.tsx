/** Hear audio → write it with the fidel keyboard. The tier-3 endgame skill. */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ListenWriteExercise } from '../engine/exerciseGenerator';
import { AudioButton } from '../components/AudioButton';
import { FidelKeyboard } from '../components/FidelKeyboard';
import { useProgressStore } from '../state/useProgressStore';
import { colors, space, type } from '../theme';
import type { ExerciseProps } from './common';

export function ListenWrite({
  exercise,
  courseId,
  tier,
  onAnswer,
  introducedFamilies,
}: ExerciseProps<ListenWriteExercise>) {
  const [typed, setTyped] = useState<string[]>([]);
  const [result, setResult] = useState<null | boolean>(null);
  const answer = exercise.answerGlyphs.map((g) => g.glyph).join('');
  const masteredFamilies = useProgressStore((s) => (s.course ? s.byCourse[s.course].masteredFamilies : null));

  // Mastery is only granted when a lesson finishes, so the families this
  // lesson introduces (and the answer's own families, for review items) must
  // be unlocked too — otherwise the exercise is impossible.
  const unlocked = useMemo(() => {
    const keys = new Set(Object.keys(masteredFamilies ?? {}).filter((k) => masteredFamilies?.[k]));
    for (const f of introducedFamilies ?? []) keys.add(f);
    for (const g of exercise.answerGlyphs) if (g.family_group) keys.add(g.family_group);
    return [...keys];
  }, [masteredFamilies, introducedFamilies, exercise.answerGlyphs]);

  const check = () => {
    if (result != null || typed.length === 0) return; // an empty submit shouldn't cost a heart
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
          unlockedFamilies={tier >= 3 ? undefined : unlocked}
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
