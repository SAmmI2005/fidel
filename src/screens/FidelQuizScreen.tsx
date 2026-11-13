/**
 * Fidel chart quiz — 10 random letters from the whole chart.
 *   type:   fidel shown → type the Latin spelling
 *   choose: Latin shown → pick the fidel from 4
 * Free practice: no hearts, no XP, no SRS. Ends with a score and the misses.
 */
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useConfirmLeave } from '../navigation/useConfirmLeave';
import { useProgressStore } from '../state/useProgressStore';
import { chartFor, type ChartCell } from '../content/fidelChart';
import { buildQuiz, isTypedAnswerCorrect, type QuizQuestion } from '../engine/chartQuiz';
import { colors, radii, space, type } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'FidelQuiz'>;

interface Result {
  cell: ChartCell;
  correct: boolean;
  /** what the learner typed or picked */
  given: string;
}

/** Characters most keyboards lack, one tap away. */
const HELPER_KEYS = ['ä', 'ə', "'"];

export function FidelQuizScreen({ route, navigation }: Props) {
  const { mode } = route.params;
  const course = useProgressStore((s) => s.course)!;
  const rows = useMemo(() => chartFor(course), [course]);

  const [round, setRound] = useState(0); // bump to start a fresh quiz
  const questions = useMemo(() => buildQuiz(rows, mode), [rows, mode, round]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [typed, setTyped] = useState('');
  const [picked, setPicked] = useState<string | null>(null);

  const question: QuizQuestion | undefined = questions[index];
  const answered = results.length > index;
  const finished = index >= questions.length;

  // Nothing to lose before the first answer, so only ask once the round has started.
  const leaveDialog = useConfirmLeave(navigation, !finished && results.length > 0, {
    title: 'Leave this quiz?',
    message: 'Your score for this round will be lost.',
  });

  const record = (correct: boolean, given: string) => {
    if (answered || !question) return;
    Haptics.notificationAsync(
      correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
    );
    setResults((r) => [...r, { cell: question.cell, correct, given }]);
  };

  const checkTyped = () => {
    if (!question || !typed.trim()) return;
    record(isTypedAnswerCorrect(question.cell, typed), typed.trim());
  };

  const next = () => {
    setTyped('');
    setPicked(null);
    setIndex((i) => i + 1);
  };

  const restart = () => {
    setRound((r) => r + 1);
    setIndex(0);
    setResults([]);
    setTyped('');
    setPicked(null);
  };

  // ---------- results ----------
  if (finished) {
    const score = results.filter((r) => r.correct).length;
    const misses = results.filter((r) => !r.correct);
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.endScroll}>
          <Text style={type.title}>
            {score}/{results.length} correct
          </Text>
          {misses.length > 0 ? (
            <View style={styles.missList}>
              <Text style={type.caption}>Review these</Text>
              {misses.map((m) => (
                <View key={m.cell.glyph} style={styles.missRow}>
                  <Text style={styles.missGlyph}>{m.cell.glyph}</Text>
                  <Text style={styles.missRoman}>{m.cell.roman}</Text>
                  <Text style={styles.missGiven}>you: {m.given}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[type.body, { color: colors.boneDim }]}>Perfect round.</Text>
          )}
          <Pressable style={styles.primary} onPress={restart}>
            <Text style={styles.primaryText}>Try again</Text>
          </Pressable>
          <Pressable style={styles.quiet} onPress={() => navigation.goBack()}>
            <Text style={styles.quietText}>Back to chart</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const lastResult = answered ? results[index] : null;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(index / questions.length) * 100}%` }]} />
        </View>
        <Text style={styles.count}>
          {index + 1}/{questions.length}
        </Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {mode === 'type' ? (
            <>
              <Text style={type.caption}>Type it in Latin</Text>
              <Text style={styles.heroGlyph}>{question!.cell.glyph}</Text>
              <TextInput
                key={index} // remount per question so autoFocus re-opens the keyboard
                autoFocus
                value={typed}
                onChangeText={(t) => !answered && setTyped(t)}
                onSubmitEditing={answered ? next : checkTyped}
                submitBehavior="submit"
                returnKeyType={answered ? 'next' : 'done'}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                autoComplete="off"
                placeholder="e.g. lä"
                placeholderTextColor={colors.hairline}
                style={[
                  styles.input,
                  lastResult && (lastResult.correct ? styles.inputRight : styles.inputWrong),
                ]}
              />
              {!answered && (
                <View style={styles.helperRow}>
                  {HELPER_KEYS.map((k) => (
                    <Pressable key={k} style={styles.helperKey} onPress={() => setTyped((t) => t + k)}>
                      <Text style={styles.helperText}>{k}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {!answered && (
                <Text style={styles.hint}>1st ä · 2nd u · 3rd i · 4th a · 5th e · 6th ə · 7th o</Text>
              )}
            </>
          ) : (
            <>
              <Text style={type.caption}>Which letter is this?</Text>
              <Text style={styles.heroLatin}>{question!.cell.roman}</Text>
              <View style={styles.choiceGrid}>
                {question!.choices!.map((c) => {
                  const isAnswer = c.glyph === question!.cell.glyph;
                  const state = !answered ? 'idle' : isAnswer ? 'right' : c.glyph === picked ? 'wrong' : 'dim';
                  return (
                    <Pressable
                      key={c.glyph}
                      disabled={answered}
                      onPress={() => {
                        setPicked(c.glyph);
                        record(isAnswer, c.glyph);
                      }}
                      style={[
                        styles.choice,
                        state === 'right' && styles.choiceRight,
                        state === 'wrong' && styles.choiceWrong,
                        state === 'dim' && { opacity: 0.4 },
                      ]}
                    >
                      <Text style={styles.choiceGlyph}>{c.glyph}</Text>
                      {answered && <Text style={styles.choiceRoman}>{c.roman}</Text>}
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {lastResult && (
            <Text style={[styles.feedback, { color: lastResult.correct ? colors.leaf : colors.error }]}>
              {lastResult.correct
                ? `Correct · ${question!.cell.glyph} = ${question!.cell.roman}`
                : `${question!.cell.glyph} = ${question!.cell.roman}`}
            </Text>
          )}

          {mode === 'type' && !answered ? (
            <Pressable
              style={[styles.primary, !typed.trim() && { opacity: 0.4 }]}
              disabled={!typed.trim()}
              onPress={checkTyped}
            >
              <Text style={styles.primaryText}>Check</Text>
            </Pressable>
          ) : answered ? (
            <Pressable style={styles.primary} onPress={next}>
              <Text style={styles.primaryText}>{index + 1 >= questions.length ? 'See results' : 'Next'}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      {leaveDialog}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4) },
  close: { color: colors.boneDim, fontSize: 20 },
  progressTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.groundSunken },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.rubric },
  count: { ...type.caption, textTransform: 'none' },
  body: { alignItems: 'center', gap: space(4), padding: space(5), paddingBottom: space(10) },
  heroGlyph: { fontSize: 96, color: colors.bone },
  heroLatin: { fontSize: 56, fontWeight: '700', color: colors.bone, paddingVertical: space(3) },
  input: {
    alignSelf: 'stretch',
    fontSize: 28,
    textAlign: 'center',
    color: colors.bone,
    backgroundColor: colors.groundSunken,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    borderRadius: radii.card,
    paddingVertical: space(3),
  },
  inputRight: { borderColor: colors.leaf },
  inputWrong: { borderColor: colors.error },
  helperRow: { flexDirection: 'row', gap: space(2) },
  helperKey: {
    minWidth: 48,
    paddingVertical: space(2),
    paddingHorizontal: space(3),
    alignItems: 'center',
    borderRadius: radii.key,
    backgroundColor: colors.groundRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  helperText: { fontSize: 20, color: colors.bone },
  hint: { ...type.caption, textTransform: 'none', textAlign: 'center' },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3), justifyContent: 'center' },
  choice: {
    width: 128,
    paddingVertical: space(5),
    alignItems: 'center',
    borderRadius: radii.card,
    backgroundColor: colors.groundRaised,
    borderWidth: 1.5,
    borderColor: colors.hairline,
  },
  choiceRight: { borderColor: colors.leaf },
  choiceWrong: { borderColor: colors.error },
  choiceGlyph: { fontSize: 44, color: colors.bone },
  choiceRoman: { ...type.caption, textTransform: 'none', marginTop: space(1) },
  feedback: { ...type.body, fontWeight: '600', textAlign: 'center' },
  primary: {
    alignSelf: 'stretch',
    backgroundColor: colors.rubric,
    borderRadius: radii.card,
    paddingVertical: space(4),
    alignItems: 'center',
  },
  primaryText: { color: colors.bone, fontWeight: '700', fontSize: 16 },
  quiet: {
    alignSelf: 'stretch',
    backgroundColor: colors.groundRaised,
    borderRadius: radii.card,
    paddingVertical: space(4),
    alignItems: 'center',
  },
  quietText: { color: colors.boneDim, fontWeight: '600', fontSize: 16 },
  endScroll: { padding: space(5), gap: space(4), alignItems: 'center', paddingTop: space(10) },
  missList: { alignSelf: 'stretch', gap: space(2) },
  missRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: colors.groundRaised,
    borderRadius: radii.key,
    padding: space(3),
  },
  missGlyph: { fontSize: 32, color: colors.bone, width: 48, textAlign: 'center' },
  missRoman: { ...type.body, fontWeight: '700', width: 64 },
  missGiven: { ...type.caption, textTransform: 'none', flex: 1, textAlign: 'right' },
});
