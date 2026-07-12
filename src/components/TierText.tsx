/**
 * TierText — the three-tier reveal system, in one component.
 * Every place an item is displayed uses this, so tier progression changes
 * the whole app's script presentation at once:
 *
 *   tier 1  transliteration-primary: Latin large, fidel smaller alongside
 *   tier 2  dual: fidel large (families being learned), transliteration visible
 *   tier 3  fidel-primary: transliteration hidden behind tap-to-reveal
 *
 * onHintUsed lets exercises downgrade the SRS grade (2 → 1) when the
 * tier-3 hint was needed — hints are free to see, not free to the algorithm.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ContentItem, DifficultyTier } from '../types/content';
import { colors, space, type } from '../theme';

interface Props {
  item: Pick<ContentItem, 'glyph' | 'transliteration'>;
  tier: DifficultyTier;
  /** 'hero' for the exercise prompt, 'chip' for options/inline */
  size?: 'hero' | 'chip';
  onHintUsed?: () => void;
}

export function TierText({ item, tier, size = 'hero', onHintUsed }: Props) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => setRevealed(false), [item.glyph]);

  const hero = size === 'hero';

  if (tier === 1) {
    return (
      <View style={styles.center}>
        <Text style={hero ? type.latinHero : styles.latinChip}>{item.transliteration}</Text>
        <Text style={[hero ? type.fidelBody : styles.fidelChipSmall, { color: colors.boneDim }]}>
          {item.glyph}
        </Text>
      </View>
    );
  }

  if (tier === 2) {
    return (
      <View style={styles.center}>
        <Text style={hero ? type.fidelHero : styles.fidelChip}>{item.glyph}</Text>
        <Text style={hero ? styles.latinSub : styles.latinChipDim}>{item.transliteration}</Text>
      </View>
    );
  }

  // tier 3: fidel-primary, transliteration is a tap-to-reveal hint
  return (
    <Pressable
      style={styles.center}
      onPress={() => {
        if (!revealed) {
          setRevealed(true);
          onHintUsed?.();
        }
      }}
    >
      <Text style={hero ? type.fidelHero : styles.fidelChip}>{item.glyph}</Text>
      {revealed ? (
        <Text style={styles.latinSub}>{item.transliteration}</Text>
      ) : hero ? (
        <Text style={styles.hint}>tap for hint</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: space(1) },
  latinSub: { ...type.body, color: colors.boneDim },
  latinChip: { fontSize: 22, fontWeight: '600', color: colors.bone },
  latinChipDim: { fontSize: 14, color: colors.boneDim },
  fidelChip: { fontSize: 40, color: colors.bone },
  fidelChipSmall: { fontSize: 22 },
  hint: { ...type.caption, color: colors.rubric },
});
