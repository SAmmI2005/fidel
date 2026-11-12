/**
 * Fidel chart — free abugida practice. One row per consonant family, one
 * column per vowel order, covering the whole script (not just the families
 * the lessons have reached). Tap a letter to see it large and hear it; hide
 * the romanization to test yourself. Nothing here is graded.
 */
import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useProgressStore } from '../state/useProgressStore';
import { chartFor, ORDER_VOWELS, type ChartCell } from '../content/fidelChart';
import { play } from '../audio/AudioService';
import { colors, radii, space, type } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'FidelChart'>;

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];
const GUTTER = space(4);
const GAP = space(1.5);

export function FidelChartScreen({ navigation }: Props) {
  const course = useProgressStore((s) => s.course)!;
  const rows = useMemo(() => chartFor(course), [course]);

  // Explicit cell sizes: flex + aspectRatio inside a ScrollView can make the
  // content height mis-measure, which leaves the grid unable to scroll.
  const { width } = useWindowDimensions();
  const cellW = Math.floor((width - GUTTER * 2 - GAP * 6) / 7);
  const cellSize = { width: cellW, height: Math.round(cellW * 1.15) };

  const [selected, setSelected] = useState<ChartCell | null>(null);
  const [hideRoman, setHideRoman] = useState(false);
  const [audioNote, setAudioNote] = useState<string | null>(null);
  const latestTap = useRef<string | null>(null);

  const onCell = async (cell: ChartCell) => {
    Haptics.selectionAsync();
    setSelected(cell);
    setAudioNote(null);
    latestTap.current = cell.glyph;
    try {
      const res = await play(course, cell.item);
      // ignore results for a letter the user has already tapped away from
      if (latestTap.current === cell.glyph && res.status === 'unavailable') setAudioNote(res.reason);
    } catch {
      if (latestTap.current === cell.glyph) setAudioNote('Audio unavailable.');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Fidel chart</Text>
        <Pressable onPress={() => setHideRoman((h) => !h)} hitSlop={12}>
          <Text style={styles.toggle}>{hideRoman ? 'Show sounds' : 'Hide sounds'}</Text>
        </Pressable>
      </View>

      {/* Selected letter, large */}
      <View style={styles.panel}>
        {selected ? (
          <>
            <Text style={styles.panelGlyph}>{selected.glyph}</Text>
            <Text style={styles.panelRoman}>{selected.roman}</Text>
            <Text style={styles.panelMeta}>
              {rows.find((r) => r.cells.includes(selected))?.base} family · {ORDINALS[selected.order - 1]} order
            </Text>
            {audioNote && <Text style={styles.audioNote}>{audioNote}</Text>}
          </>
        ) : (
          <Text style={styles.panelHint}>
            Tap any letter to hear it.{'\n'}Each row is one consonant with its seven vowel forms.
          </Text>
        )}
      </View>

      {/* Quizzes over the whole chart */}
      <View style={styles.quizRow}>
        <Pressable style={styles.quizButton} onPress={() => navigation.navigate('FidelQuiz', { mode: 'type' })}>
          <Text style={styles.quizTitle}>ሀ → hä</Text>
          <Text style={styles.quizSub}>Type the Latin</Text>
        </Pressable>
        <Pressable style={styles.quizButton} onPress={() => navigation.navigate('FidelQuiz', { mode: 'choose' })}>
          <Text style={styles.quizTitle}>hä → ሀ</Text>
          <Text style={styles.quizSub}>Pick the fidel</Text>
        </Pressable>
      </View>

      {/* Column headers: the vowel of each order */}
      <View style={[styles.row, styles.headerRow]}>
        {ORDER_VOWELS.map((v) => (
          <Text key={v} style={[styles.headerCell, { width: cellW }]}>
            {v}
          </Text>
        ))}
      </View>

      <ScrollView style={styles.gridScroll} contentContainerStyle={styles.grid}>
        {rows.map((row) => (
          <View key={row.base} style={styles.row}>
            {row.cells.map((cell) => {
              const active = selected?.glyph === cell.glyph;
              return (
                <Pressable
                  key={cell.glyph}
                  onPress={() => onCell(cell)}
                  style={({ pressed }) => [
                    styles.cell,
                    cellSize,
                    active && styles.cellActive,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={styles.cellGlyph}>{cell.glyph}</Text>
                  {!hideRoman && <Text style={styles.cellRoman}>{cell.roman}</Text>}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(4),
    minHeight: 44,
  },
  back: { ...type.body, color: colors.boneDim },
  title: { ...type.body, fontWeight: '700' },
  toggle: { ...type.caption, color: colors.rubric, textTransform: 'none' },
  panel: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 168,
    marginHorizontal: space(4),
    marginVertical: space(2),
    padding: space(3),
    borderRadius: radii.card,
    backgroundColor: colors.groundRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: space(1),
  },
  panelGlyph: { fontSize: 72, color: colors.bone },
  panelRoman: { fontSize: 22, fontWeight: '600', color: colors.bone },
  panelMeta: { ...type.caption, textTransform: 'none' },
  panelHint: { ...type.body, color: colors.boneDim, textAlign: 'center' },
  audioNote: { ...type.caption, color: colors.brass, textTransform: 'none', textAlign: 'center' },
  quizRow: { flexDirection: 'row', gap: space(2), paddingHorizontal: GUTTER, marginBottom: space(3) },
  quizButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space(2.5),
    borderRadius: radii.card,
    borderWidth: 1.5,
    borderColor: colors.rubric,
    backgroundColor: colors.groundSunken,
  },
  quizTitle: { fontSize: 18, fontWeight: '700', color: colors.bone },
  quizSub: { ...type.caption, textTransform: 'none' },
  headerRow: { paddingHorizontal: GUTTER, marginBottom: space(1) },
  headerCell: { textAlign: 'center', ...type.caption, textTransform: 'none' },
  gridScroll: { flex: 1 },
  grid: { paddingHorizontal: GUTTER, paddingBottom: space(12), gap: GAP },
  row: { flexDirection: 'row', gap: GAP },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.key,
    backgroundColor: colors.groundSunken,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  cellActive: { borderColor: colors.rubric, backgroundColor: colors.groundRaised },
  cellGlyph: { fontSize: 24, color: colors.bone },
  cellRoman: { fontSize: 10, color: colors.boneDim, marginTop: 1 },
});
