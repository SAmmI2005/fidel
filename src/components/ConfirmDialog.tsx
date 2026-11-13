/**
 * In-app confirmation dialog, styled to match the app (the native Alert uses
 * the system's grey sheet, which clashes with the manuscript theme).
 *
 * Rendered as an overlay inside the screen rather than a <Modal>, so it can't
 * collide with a navigation transition when the user confirms.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, space, type } from '../theme';

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel }: Props) {
  return (
    <View style={styles.overlay}>
      {/* tapping outside the card = keep going */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel={cancelLabel} />
      <View style={styles.card} accessibilityRole="alert">
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <Pressable style={({ pressed }) => [styles.stay, pressed && { opacity: 0.8 }]} onPress={onCancel}>
          <Text style={styles.stayText}>{cancelLabel}</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.leave, pressed && { opacity: 0.6 }]} onPress={onConfirm}>
          <Text style={styles.leaveText}>{confirmLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space(6),
    zIndex: 100,
    elevation: 100,
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.groundRaised,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: space(6),
    gap: space(3),
  },
  title: { ...type.title, fontSize: 20, textAlign: 'center' },
  message: { ...type.body, color: colors.boneDim, textAlign: 'center', marginBottom: space(2) },
  stay: {
    backgroundColor: colors.rubric,
    borderRadius: radii.card,
    paddingVertical: space(3.5),
    alignItems: 'center',
  },
  stayText: { color: colors.bone, fontWeight: '700', fontSize: 16 },
  leave: { paddingVertical: space(3), alignItems: 'center' },
  leaveText: { color: colors.boneDim, fontWeight: '600', fontSize: 16 },
});
