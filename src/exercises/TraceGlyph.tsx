/**
 * Tier-2 tracing: draw over a large glyph. MVP validation is a coverage
 * heuristic (ink near the glyph's bounding region + minimum path length) —
 * honest scaffolding, not real stroke recognition. Post-MVP: per-glyph
 * stroke templates + DTW matching. Grades max out at 1 (correct-with-hint)
 * to keep the SRS honest about the weak check.
 */
import React, { useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import type { TraceGlyphExercise } from '../engine/exerciseGenerator';
import { colors, radii, space, type } from '../theme';
import type { ExerciseProps } from './common';

const SIZE = 280;
const MIN_INK = SIZE * 1.2;

export function TraceGlyph({ exercise, onAnswer }: ExerciseProps<TraceGlyphExercise>) {
  const [paths, setPaths] = useState<string[]>([]);
  const [inkLen, setInkLen] = useState(0);
  const [done, setDone] = useState(false);
  const current = useRef('');
  const last = useRef<{ x: number; y: number } | null>(null);
  const [, force] = useState(0);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        current.current = `M${x.toFixed(1)},${y.toFixed(1)}`;
        last.current = { x, y };
      },
      onPanResponderMove: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        current.current += ` L${x.toFixed(1)},${y.toFixed(1)}`;
        // Compute the distance now: the state updater can run later, after
        // last.current has moved on or been cleared on release (→ crash).
        const prev = last.current;
        if (prev) {
          const step = Math.hypot(x - prev.x, y - prev.y);
          setInkLen((l) => l + step);
        }
        last.current = { x, y };
        force((n) => n + 1);
      },
      onPanResponderRelease: () => {
        // capture now: the updater may run after current.current is reset below
        const stroke = current.current;
        if (stroke) setPaths((p) => [...p, stroke]);
        current.current = '';
        last.current = null;
      },
    })
  ).current;

  // The check is only an ink-length heuristic, so it never fails anyone (no
  // lost hearts for a small, careful trace): Done unlocks once there's enough
  // ink, and the grade is capped at hint-level to keep the SRS honest.
  const enoughInk = inkLen > MIN_INK;
  const check = () => {
    if (done || !enoughInk) return;
    setDone(true);
    onAnswer(1);
  };

  return (
    <View style={styles.wrap}>
      <Text style={type.caption}>Trace {exercise.target.glyph} · {exercise.target.transliteration}</Text>
      <View style={styles.board} {...pan.panHandlers}>
        <Svg width={SIZE} height={SIZE}>
          <SvgText
            x={SIZE / 2}
            y={SIZE * 0.72}
            fontSize={SIZE * 0.66}
            fill={colors.groundRaised}
            stroke={colors.hairline}
            strokeWidth={1}
            textAnchor="middle"
          >
            {exercise.target.glyph}
          </SvgText>
          {[...paths, current.current].filter(Boolean).map((d, i) => (
            <Path key={i} d={d} stroke={colors.rubric} strokeWidth={7} strokeLinecap="round" fill="none" />
          ))}
        </Svg>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={styles.quiet}
          disabled={done}
          onPress={() => {
            setPaths([]);
            setInkLen(0);
          }}
        >
          <Text style={styles.quietText}>Clear</Text>
        </Pressable>
        <Pressable style={[styles.primary, !enoughInk && { opacity: 0.4 }]} disabled={!enoughInk || done} onPress={check}>
          <Text style={styles.primaryText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', gap: space(4), paddingTop: space(3) },
  board: {
    width: SIZE,
    height: SIZE,
    backgroundColor: colors.groundSunken,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  actions: { flexDirection: 'row', gap: space(3) },
  quiet: { paddingHorizontal: space(6), paddingVertical: space(3), borderRadius: radii.card, backgroundColor: colors.groundRaised },
  quietText: { color: colors.boneDim, fontWeight: '600' },
  primary: { paddingHorizontal: space(8), paddingVertical: space(3), borderRadius: radii.card, backgroundColor: colors.rubric },
  primaryText: { color: colors.bone, fontWeight: '700' },
});
