/**
 * Plays an item's audio via AudioService and surfaces the 'unavailable'
 * state honestly — this is where the Tigrinya recording gap becomes
 * visible to testers instead of silently failing.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ContentItem, CourseId } from '../types/content';
import { play } from '../audio/AudioService';
import { colors, radii, space, type } from '../theme';

interface Props {
  courseId: CourseId;
  item: ContentItem;
  autoPlayKey?: string; // change to trigger autoplay
  size?: 'large' | 'small';
}

export function AudioButton({ courseId, item, autoPlayKey, size = 'large' }: Props) {
  const [busy, setBusy] = useState(false);
  const [gap, setGap] = useState<string | null>(null);

  const trigger = React.useCallback(async () => {
    setBusy(true);
    const res = await play(courseId, item);
    setBusy(false);
    setGap(res.status === 'unavailable' ? res.reason : null);
  }, [courseId, item.id]);

  React.useEffect(() => {
    if (autoPlayKey) trigger();
  }, [autoPlayKey, trigger]);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={trigger}
        style={({ pressed }) => [styles.btn, size === 'small' && styles.btnSmall, pressed && { opacity: 0.7 }]}
      >
        {busy ? (
          <ActivityIndicator color={colors.bone} />
        ) : (
          <Text style={[styles.icon, size === 'small' && { fontSize: 20 }]}>🔊</Text>
        )}
      </Pressable>
      {gap && <Text style={styles.gap}>{gap}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space(1) },
  btn: {
    backgroundColor: colors.rubric,
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSmall: { width: 44, height: 44 },
  icon: { fontSize: 30 },
  gap: { ...type.caption, color: colors.brass, textAlign: 'center', maxWidth: 260, textTransform: 'none' },
});
