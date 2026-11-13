/**
 * Lesson orchestrator. Holds zero exercise-specific logic: it asks the
 * engine for a session, dispatches on exercise.type, and routes every
 * grade into SRS + XP + hearts. Family-introduction lessons open with a
 * splash of the family's 7 orders before drilling starts.
 */
import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useConfirmLeave } from '../navigation/useConfirmLeave';
import { getCourse } from '../content/loader';
import { generateLessonExercises, type Exercise } from '../engine/exerciseGenerator';
import { dueItems } from '../srs/scheduler';
import { HEARTS_ENABLED, LESSON_BONUS_XP, useProgressStore } from '../state/useProgressStore';
import { AudioButton } from '../components/AudioButton';
import { ListenSelect } from '../exercises/ListenSelect';
import { ListenWrite } from '../exercises/ListenWrite';
import { MatchPairs } from '../exercises/MatchPairs';
import { TraceGlyph } from '../exercises/TraceGlyph';
import { MultipleChoice } from '../exercises/MultipleChoice';
import { FillBlank } from '../exercises/FillBlank';
import type { ExerciseProps, Grade } from '../exercises/common';
import { colors, radii, space, type } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Lesson'>;

export function LessonScreen({ route, navigation }: Props) {
  const { lessonId } = route.params;
  const course = useProgressStore((s) => s.course)!;
  const tier = useProgressStore((s) => s.tier)();
  const srs = useProgressStore((s) => s.byCourse[course].srs);
  const recordAnswer = useProgressStore((s) => s.recordAnswer);
  const completeLesson = useProgressStore((s) => s.completeLesson);
  const loseHeart = useProgressStore((s) => s.loseHeart);
  const hearts = useProgressStore((s) => s.hearts);

  const { lessonById, familyByKey, itemById } = getCourse(course);
  const lesson = lessonById.get(lessonId)!;

  const exercises = useMemo<Exercise[]>(
    () =>
      generateLessonExercises({
        courseId: course,
        lesson,
        tier,
        reviewItemIds: dueItems(srs, Date.now(), 5),
      }),
    [lessonId]
  );

  const [phase, setPhase] = useState<'intro' | 'drill' | 'done' | 'failed'>(() =>
    // no hearts left → don't let the lesson start
    HEARTS_ENABLED && hearts === 0 ? 'failed' : lesson.introduces_families?.length ? 'intro' : 'drill'
  );
  const [index, setIndex] = useState(0);
  const [lastGrade, setLastGrade] = useState<Grade | null>(null);
  const [xpEarned, setXpEarned] = useState(0);
  const results = useRef<Grade[]>([]);

  const exercise = exercises[index];

  // Ask before abandoning a lesson in progress (✕, Android back, etc.).
  const leaveDialog = useConfirmLeave(navigation, phase === 'drill', {
    title: 'Leave this lesson?',
    message: "Answers so far are saved, but the lesson won't count as finished.",
  });

  const onAnswer = (grade: Grade) => {
    if (lastGrade != null) return;
    results.current.push(grade);
    setLastGrade(grade);
    recordAnswer(exercise.target.id, grade);
    if (grade === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (HEARTS_ENABLED && loseHeart() === 0) setPhase('failed');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const next = () => {
    setLastGrade(null);
    if (index + 1 >= exercises.length) {
      const correct = results.current.filter((g) => g > 0).length;
      const firstCompletion =
        useProgressStore.getState().byCourse[course].completedLessons[lessonId] == null;
      // mirrors recordAnswer/completeLesson: 10 per answer, 5 if hinted, bonus on first completion
      setXpEarned(
        results.current.reduce<number>((sum, g) => sum + (g === 2 ? 10 : g === 1 ? 5 : 0), 0) +
          (firstCompletion ? LESSON_BONUS_XP : 0)
      );
      completeLesson(lessonId, correct / Math.max(1, results.current.length));
      setPhase('done');
    } else {
      setIndex((i) => i + 1);
    }
  };

  // ---------- family introduction splash ----------
  if (phase === 'intro') {
    return (
      <SafeAreaView style={styles.screen}>
        {/* nothing answered yet, so leaving here needs no confirmation */}
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.introScroll}>
          <Text style={type.caption}>New letter families</Text>
          {lesson.introduces_families!.map((key) => {
            const fam = familyByKey.get(key)!;
            return (
              <View key={key} style={styles.famCard}>
                <Text style={styles.famTitle}>
                  {fam.forms[0]} — the “{fam.label}” family
                </Text>
                <View style={styles.famRow}>
                  {fam.forms.map((glyph, i) => {
                    const item = itemById.get(
                      // glyph items share the family's order index
                      [...itemById.values()].find(
                        (it) => it.family_group === key && it.order === i + 1
                      )?.id ?? ''
                    );
                    return (
                      <View key={glyph} style={styles.famCell}>
                        <Text style={styles.famGlyph}>{glyph}</Text>
                        <Text style={styles.famRoman}>{fam.romanized[i]}</Text>
                        {item && <AudioButton courseId={course} item={item} size="small" />}
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.famNote}>
                  Same consonant, seven vowel shapes. Notice what changes and what stays.
                </Text>
              </View>
            );
          })}
          <Pressable style={styles.primary} onPress={() => setPhase('drill')}>
            <Text style={styles.primaryText}>Start practicing</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---------- terminal states ----------
  if (phase === 'failed') {
    return (
      <Terminal
        title="Out of hearts"
        body="Hearts refill tomorrow. Your progress on answered items was saved."
        cta="Back to tree"
        onPress={() => navigation.goBack()}
      />
    );
  }
  if (phase === 'done') {
    const correct = results.current.filter((g) => g > 0).length;
    return (
      <Terminal
        title="Lesson complete"
        body={`${correct}/${results.current.length} correct · +${xpEarned} XP`}
        cta="Continue"
        onPress={() => navigation.goBack()}
      />
    );
  }

  // ---------- drill ----------
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(index / exercises.length) * 100}%` }]} />
        </View>
        {HEARTS_ENABLED && <Text style={styles.hearts}>♥ {hearts}</Text>}
      </View>

      <View style={{ flex: 1 }}>
        <ExerciseSwitch
          key={exercise.id}
          exercise={exercise}
          courseId={course}
          tier={tier}
          onAnswer={onAnswer}
          introducedFamilies={lesson.introduces_families}
        />
      </View>

      {lastGrade != null && (
        <View style={[styles.banner, lastGrade === 0 ? styles.bannerWrong : styles.bannerRight]}>
          <Text style={styles.bannerText}>
            {lastGrade === 0
              ? `${exercise.target.glyph} · ${exercise.target.transliteration}${exercise.target.english_gloss ? ' · ' + exercise.target.english_gloss : ''}`
              : lastGrade === 1
                ? 'Correct (with a hint)'
                : 'Correct'}
          </Text>
          <Pressable style={styles.primarySmall} onPress={next}>
            <Text style={styles.primaryText}>{index + 1 >= exercises.length ? 'Finish' : 'Continue'}</Text>
          </Pressable>
        </View>
      )}
      {leaveDialog}
    </SafeAreaView>
  );
}

function ExerciseSwitch(props: ExerciseProps<Exercise>) {
  const { exercise } = props;
  switch (exercise.type) {
    case 'listen_select':
      return <ListenSelect {...props} exercise={exercise} />;
    case 'listen_write':
      return <ListenWrite {...props} exercise={exercise} />;
    case 'match_pairs':
      return <MatchPairs {...props} exercise={exercise} />;
    case 'trace_glyph':
      return <TraceGlyph {...props} exercise={exercise} />;
    case 'multiple_choice':
      return <MultipleChoice {...props} exercise={exercise} />;
    case 'fill_blank':
      return <FillBlank {...props} exercise={exercise} />;
  }
}

function Terminal({ title, body, cta, onPress }: { title: string; body: string; cta: string; onPress: () => void }) {
  return (
    <SafeAreaView style={[styles.screen, styles.terminal]}>
      <Text style={type.title}>{title}</Text>
      <Text style={[type.body, { color: colors.boneDim, textAlign: 'center' }]}>{body}</Text>
      <Pressable style={styles.primary} onPress={onPress}>
        <Text style={styles.primaryText}>{cta}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4) },
  close: { color: colors.boneDim, fontSize: 20 },
  progressTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.groundSunken },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.rubric },
  hearts: { color: colors.rubric, fontWeight: '700' },
  banner: {
    padding: space(4),
    gap: space(3),
    borderTopWidth: 2,
  },
  bannerRight: { backgroundColor: colors.groundRaised, borderTopColor: colors.leaf },
  bannerWrong: { backgroundColor: colors.groundRaised, borderTopColor: colors.error },
  bannerText: { ...type.body, textAlign: 'center' },
  primary: {
    backgroundColor: colors.rubric,
    borderRadius: radii.card,
    paddingVertical: space(4),
    paddingHorizontal: space(8),
    alignItems: 'center',
  },
  primarySmall: {
    backgroundColor: colors.rubric,
    borderRadius: radii.card,
    paddingVertical: space(3),
    alignItems: 'center',
  },
  primaryText: { color: colors.bone, fontWeight: '700', fontSize: 16 },
  terminal: { justifyContent: 'center', alignItems: 'center', gap: space(5), padding: space(8) },
  introScroll: { padding: space(5), gap: space(4) },
  famCard: {
    backgroundColor: colors.groundRaised,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: space(4),
    gap: space(3),
  },
  famTitle: { ...type.body, fontWeight: '700' },
  famRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), justifyContent: 'center' },
  famCell: { alignItems: 'center', gap: space(1), width: 64 },
  famGlyph: { fontSize: 34, color: colors.bone },
  famRoman: { fontSize: 12, color: colors.boneDim },
  famNote: { ...type.caption, textTransform: 'none', textAlign: 'center' },
});
