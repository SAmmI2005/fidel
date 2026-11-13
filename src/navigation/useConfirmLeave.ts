/**
 * Ask "are you sure?" before leaving a screen mid-session. Catches every way
 * out — the ✕ button, Android's back button, any goBack() — via the
 * navigator's beforeRemove event, so screens can simply call goBack().
 *
 * Returns the dialog element; the screen renders it as the LAST child of its
 * root view so it overlays everything.
 *
 * Note: native-stack can't intercept the iOS swipe-back gesture, so screens
 * using this keep `gestureEnabled: false` and offer an on-screen ✕ instead.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { ConfirmDialog } from '../components/ConfirmDialog';

type LeaveAction = Parameters<NavigationProp<ParamListBase>['dispatch']>[0];

export function useConfirmLeave(
  navigation: NavigationProp<ParamListBase>,
  /** Only ask while this is true (e.g. mid-lesson, not on the results screen). */
  active: boolean,
  copy: { title: string; message: string }
): React.ReactElement | null {
  const [pending, setPending] = useState<{ action: LeaveAction } | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  // set once the user confirms, so re-dispatching the action isn't caught again
  const confirmed = useRef(false);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (!activeRef.current || confirmed.current) return;
        e.preventDefault();
        Keyboard.dismiss();
        setPending({ action: e.data.action });
      }),
    [navigation]
  );

  if (!pending) return null;
  return React.createElement(ConfirmDialog, {
    title: copy.title,
    message: copy.message,
    confirmLabel: 'Leave',
    cancelLabel: 'Keep going',
    onCancel: () => setPending(null),
    onConfirm: () => {
      confirmed.current = true;
      setPending(null);
      navigation.dispatch(pending.action);
    },
  });
}
