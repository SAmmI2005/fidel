/**
 * Course choice — Amharic and Tigrinya are fully separate courses, chosen
 * here on first launch, and again via "Change" on the skill tree (progress
 * is kept per course). Copy speaks to the
 * actual audience: people who understand the language but can't read it.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useProgressStore } from '../state/useProgressStore';
import { colors, radii, space, type } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export function OnboardingScreen({ navigation }: Props) {
  const chooseCourse = useProgressStore((s) => s.chooseCourse);
  const current = useProgressStore((s) => s.course);
  // Reached from the skill tree ("Change") rather than first launch.
  const canGoBack = navigation.canGoBack();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        {canGoBack && (
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.body}>
      <View style={styles.hero}>
        <Text style={styles.glyphs}>ሀ ለ ሐ</Text>
        <Text style={type.title}>You already speak it.</Text>
        <Text style={styles.sub}>Now learn to read and write it.</Text>
      </View>
      <View style={styles.cards}>
        {(
          [
            { id: 'amharic', name: 'Amharic', native: 'አማርኛ' },
            { id: 'tigrinya', name: 'Tigrinya', native: 'ትግርኛ' },
          ] as const
        ).map((c) => (
          <Pressable
            key={c.id}
            style={({ pressed }) => [
              styles.card,
              current === c.id && styles.cardCurrent,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => {
              chooseCourse(c.id);
              // reset (not replace) so the tree never ends up stacked on an old tree
              navigation.reset({ index: 0, routes: [{ name: 'SkillTree' }] });
            }}
          >
            <Text style={styles.native}>{c.native}</Text>
            <Text style={styles.name}>{current === c.id ? `${c.name} · current` : c.name}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.foot}>
        One course at a time — each is built for its own language. Your progress in each is kept.
      </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  topBar: { minHeight: 44, paddingHorizontal: space(4), justifyContent: 'center' },
  back: { ...type.body, color: colors.boneDim },
  body: { flex: 1, justifyContent: 'center', padding: space(6), gap: space(10) },
  cardCurrent: { borderColor: colors.rubric },
  hero: { alignItems: 'center', gap: space(2) },
  glyphs: { fontSize: 64, color: colors.rubric },
  sub: { ...type.body, color: colors.boneDim },
  cards: { gap: space(3) },
  card: {
    backgroundColor: colors.groundRaised,
    borderRadius: radii.card,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    padding: space(6),
    alignItems: 'center',
    gap: space(1),
  },
  native: { fontSize: 40, color: colors.bone },
  name: { ...type.caption },
  foot: { ...type.caption, textAlign: 'center', textTransform: 'none' },
});
