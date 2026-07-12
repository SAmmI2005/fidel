/** Standalone spaced-repetition session over everything due. */
import React, { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { generateReviewExercises, type Exercise } from '../engine/exerciseGenerator';
import { dueItems } from '../srs/scheduler';
import { useProgressStore } from '../state/useProgressStore';
import { ListenSelect } from '../exercises/ListenSelect';
import { ListenWrite } from '../exercises/ListenWrite';
import { MatchPairs } from '../exercises/MatchPairs';
import { TraceGlyph } from '../exercises/TraceGlyph';
import { MultipleChoice } from '../exercises/MultipleChoice';
import { FillBlank } from '../exercises/FillBlank';
import type { Grade } from '../exercises/common';
import { colors, radii, space, type } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Review'>;

export function ReviewScreen({ navigation }: Props) {
  const course = useProgressStore((s) => s.course)!;
  const tier = useProgressStore((s) => s.tier)();
  const srs = useProgressStore((s) => s.byCourse[course].srs);
  const recordAnswer = useProgressStore((s) => s.recordAnswer);

  const exercises = useMemo<Exercise[]>(
    () => generateReviewExercises(course, tier, dueItems(srs)),
    []
  );
  const [index, setIndex] = useState(0);
  const [graded, setGraded] = useState<Grade | null>(null);
  const done = useRef(0);

  if (!exercises.length || index >= exercises.length) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <Text style={type.title}>Review done</Text>
        <Text style={[type.body, { color: colors.boneDim }]}>{done.current} items refreshed</Text>
        <Pressable style={styles.primary} onPress={() => navigation.goBack()}>
          <Text style={styles.primaryText}>Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const exercise = exercises[index];
  const common = {
    courseId: course,
    tier,
    onAnswer: (g: Grade) => {
      if (graded != null) return;
      setGraded(g);
      recordAnswer(exercise.target.id, g);
      done.current += 1;
    },
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={[type.caption, { textAlign: 'center', paddingTop: space(2) }]}>
        review · {index + 1}/{exercises.length}
      </Text>
      <View style={{ flex: 1 }} key={exercise.id}>
        {exercise.type === 'listen_select' && <ListenSelect {...common} exercise={exercise} />}
        {exercise.type === 'listen_write' && <ListenWrite {...common} exercise={exercise} />}
        {exercise.type === 'match_pairs' && <MatchPairs {...common} exercise={exercise} />}
        {exercise.type === 'trace_glyph' && <TraceGlyph {...common} exercise={exercise} />}
        {exercise.type === 'multiple_choice' && <MultipleChoice {...common} exercise={exercise} />}
        {exercise.type === 'fill_blank' && <FillBlank {...common} exercise={exercise} />}
      </View>
      {graded != null && (
        <Pressable
          style={[styles.primary, { margin: space(4) }]}
          onPress={() => {
            setGraded(null);
            setIndex((i) => i + 1);
          }}
        >
          <Text style={styles.primaryText}>Continue</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  center: { justifyContent: 'center', alignItems: 'center', gap: space(4) },
  primary: {
    backgroundColor: colors.rubric,
    borderRadius: radii.card,
    paddingVertical: space(4),
    paddingHorizontal: space(8),
    alignItems: 'center',
  },
  primaryText: { color: colors.bone, fontWeight: '700' },
});
