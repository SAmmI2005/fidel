/**
 * The single MVP branch: 20 lessons, sequential unlock, grouped by tier.
 * A review node appears whenever the SRS queue has due items.
 */
import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { getCourse } from '../content/loader';
import { dueItems } from '../srs/scheduler';
import { useProgressStore } from '../state/useProgressStore';
import { StatsHeader } from '../components/StatsHeader';
import { colors, radii, space, type } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SkillTree'>;

const TIER_LABELS: Record<number, string> = {
  1: 'Tier 1 · Sound first — Latin large, fidel alongside',
  2: 'Tier 2 · Letter families — the 7 orders',
  3: 'Tier 3 · Fidel first — hints on tap only',
};

export function SkillTreeScreen({ navigation }: Props) {
  const course = useProgressStore((s) => s.course);
  const isUnlocked = useProgressStore((s) => s.isLessonUnlocked);
  const completed = useProgressStore((s) => (s.course ? s.byCourse[s.course].completedLessons : {}));
  const srs = useProgressStore((s) => (s.course ? s.byCourse[s.course].srs : {}));
  const touchDay = useProgressStore((s) => s.touchDay);
  const resetHearts = useProgressStore((s) => s.resetHeartsIfNewDay);

  useEffect(() => {
    touchDay();
    resetHearts();
  }, []);

  if (!course) return null;
  const { content } = getCourse(course);
  const due = dueItems(srs);

  let lastTier = 0;
  return (
    <SafeAreaView style={styles.screen}>
      <StatsHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.courseName}>{content.display_name}</Text>

        {due.length > 0 && (
          <Pressable style={styles.review} onPress={() => navigation.navigate('Review')}>
            <Text style={styles.reviewGlyph}>↻</Text>
            <View>
              <Text style={type.body}>Review</Text>
              <Text style={type.caption}>{due.length} item{due.length === 1 ? '' : 's'} due</Text>
            </View>
          </Pressable>
        )}

        {content.lessons.map((lesson) => {
          const header = lesson.tier !== lastTier ? TIER_LABELS[lesson.tier] : null;
          lastTier = lesson.tier;
          const unlocked = isUnlocked(lesson.id);
          const done = completed[lesson.id] != null;
          return (
            <View key={lesson.id}>
              {header && <Text style={styles.tierHeader}>{header}</Text>}
              <Pressable
                disabled={!unlocked}
                style={[styles.node, done && styles.nodeDone, !unlocked && styles.nodeLocked]}
                onPress={() => navigation.navigate('Lesson', { lessonId: lesson.id })}
              >
                <View style={styles.nodeBadge}>
                  <Text style={styles.nodeBadgeText}>{done ? '✓' : unlocked ? '▶' : '🔒'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={type.body}>{lesson.title}</Text>
                  <Text style={type.caption}>{lesson.subtitle}</Text>
                </View>
                {done && <Text style={styles.acc}>{Math.round((completed[lesson.id] ?? 0) * 100)}%</Text>}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  scroll: { padding: space(4), gap: space(3), paddingBottom: space(12) },
  courseName: { ...type.title, textAlign: 'center', marginBottom: space(2) },
  tierHeader: { ...type.caption, color: colors.brass, marginTop: space(4), marginBottom: space(2) },
  node: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: colors.groundRaised,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: space(4),
    marginBottom: space(2.5),
  },
  nodeDone: { borderColor: colors.leaf },
  nodeLocked: { opacity: 0.45 },
  nodeBadge: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.groundSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeBadgeText: { color: colors.bone, fontSize: 16 },
  acc: { ...type.caption, color: colors.leaf },
  review: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: colors.groundSunken,
    borderRadius: radii.card,
    borderWidth: 1.5,
    borderColor: colors.brass,
    padding: space(4),
  },
  reviewGlyph: { fontSize: 24, color: colors.brass },
});
