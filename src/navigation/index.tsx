import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { SkillTreeScreen } from '../screens/SkillTreeScreen';
import { LessonScreen } from '../screens/LessonScreen';
import { ReviewScreen } from '../screens/ReviewScreen';
import { useProgressStore } from '../state/useProgressStore';
import { colors } from '../theme';

export type RootStackParamList = {
  Onboarding: undefined;
  SkillTree: undefined;
  Lesson: { lessonId: string };
  Review: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.ground, card: colors.ground, text: colors.bone },
};

export function RootNavigator() {
  const course = useProgressStore((s) => s.course);
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName={course ? 'SkillTree' : 'Onboarding'}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="SkillTree" component={SkillTreeScreen} />
        <Stack.Screen name="Lesson" component={LessonScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="Review" component={ReviewScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
