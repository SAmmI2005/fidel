# Fidel — learn to read the script you already speak

A Duolingo-style MVP for heritage speakers of **Amharic** and **Tigrinya** who understand the spoken language but can't read or write Ge'ez script (fidel). One skill-tree branch, 20 lessons per course, built to validate the core loop with real users.

React Native + Expo (SDK 54), TypeScript strict, iOS-first via EAS Build.

## Run it

```bash
npm install
cp .env.example .env        # add Azure or Google TTS key for Amharic placeholder audio
npx expo start              # dev client / Expo Go
```

### iOS via EAS

```bash
npm i -g eas-cli
eas login
eas build:configure                    # links the project (sets projectId in app.json)
eas build --platform ios --profile preview   # internal-distribution .ipa
```

Set `EXPO_PUBLIC_AZURE_TTS_KEY` (and region) as EAS secrets for builds: `eas secret:create`. Android is the same command with `--platform android`; nothing in the code is iOS-only.

## Architecture (mirrors the build order)

```
content/schema.json            JSON Schema for course files
content/<course>/course.json   generated content (items, families, lessons)
tools/generate-content.js      content pipeline — edit compact defs, re-run

src/types/content.ts           the schema as TS types
src/content/loader.ts          indexing + word→glyph decomposition
src/engine/exerciseGenerator.ts ALL exercises generated here, from schema
src/srs/scheduler.ts           SM-2-lite spaced repetition
src/state/useProgressStore.ts  tier tracking, unlocks, XP/streak/hearts (persisted)
src/audio/                     AudioService + swappable providers
src/components/TierText.tsx    the three-tier reveal system
src/components/FidelKeyboard.tsx custom Ethiopic keyboard
src/exercises/                 5 exercise renderers + tracing
src/screens/                   Onboarding · SkillTree · Lesson · Review
```

### One schema, every exercise

`ContentItem` (`glyph`, `transliteration`, `audio_path`, `english_gloss`, `grammar_tag`, `difficulty_tier`, `family_group`, `order`) is the only content primitive. Lessons are lists of item ids plus optional exercise-weight overrides. The engine decides which exercise types fit an item at the user's tier, picks by weight (**audio types weighted highest by default** — the audience's gap is sound→script, not vocabulary), builds distractors preferring same-family glyphs (the genuinely confusable ones), and weaves in ~20% SRS-due review items. No screen hardcodes content.

To add content: edit the compact definitions in `tools/generate-content.js`, run `node tools/generate-content.js`. The script validates that every seed word decomposes into seeded family glyphs.

### The three-tier reveal system

Tier is **earned state**, computed in `useProgressStore.tier()`:

| Tier | Unlock condition | Presentation (via `TierText`) |
|---|---|---|
| 1 | — | Latin large, fidel smaller alongside, audio-first |
| 2 | all tier-1 lessons done | fidel large, transliteration visible; family intro splashes, matching/tracing |
| 3 | tier 2 done **and** every family mastered | fidel-primary; transliteration is tap-to-reveal |

Every item render in the app goes through `TierText`, so the presentation shifts globally as the user progresses. Tier-3 hints aren't free: `onHintUsed` downgrades the SRS grade from 2 to 1, so hinted items resurface sooner.

### Fidel keyboard

Two-stage input matching the script's structure: tap a consonant family on the base row, then pick one of its 7 vowel orders. Families the learner hasn't been taught render locked in tiers 1–2 (dictation can't be brute-forced); tier 3 unlocks the full chart and drops the romanization hints. The keyboard doubles as a live fidel chart — using it is itself study.

### Gamification

Streak (calendar-day based), XP (10/answer, 5 hinted, 20/lesson), 5 hearts with daily refill (MVP economy — swap for timed regen later), SM-2-lite SRS over every seen item id feeding both a standalone Review node and in-lesson review injection, and strict sequential lesson unlocking.

## Audio — read this before launch

Everything resolves through `AudioService` keyed by **item id**, in this order:

1. **Real recordings** — a file at the item's `audio_path` (in the app's documents dir, or bundled via `StaticFileProvider.BUNDLED`) always wins. Swapping placeholder TTS for native-speaker audio is a pure asset drop; zero code changes.
2. **TTS placeholder** — Azure (`am-ET-MekdesNeural`) primary, Google `am-ET` secondary. Synthesized once, cached to disk.
3. **`unavailable`** — surfaced in the UI as a small amber note under the audio button.

### ⚠️ Known gap: Tigrinya TTS

Neither Azure nor Google ships a Tigrinya voice, and the providers here deliberately refuse to fake it (no "closest voice" fallback — wrong-language TTS teaches wrong pronunciation, which is fatal for an app whose whole premise is sound→script mapping). The Tigrinya course is marked `audio_strategy: "recorded"` with `tts_locale: null`, so the chain skips TTS and shows *"No recording yet — native-speaker audio needed for this course."*

**Before a real Tigrinya launch:** record a native speaker for all ~110 items (≈14 families × 7 orders + seed words), name files per each item's `audio_path` (e.g. `ti/g_h3.mp3`, `ti/w_selam.mp3`), and either bundle them (one line each in `StaticFileProvider`) or serve them for download. The same path upgrades Amharic from TTS to human audio whenever you're ready.

## Content caveats

Seed vocabulary and transliterations were chosen to exercise the seeded families and **need native-speaker review** before launch — particularly Tigrinya word choices and the romanization conventions (currently: ä u i a e ə o for orders 1–7). Tigrinya-specific families beyond ዐ (ቐ, ኸ, ጐ series) aren't seeded yet; add them in `generate-content.js`.

## Post-MVP roadmap (deliberate cuts)

- Real stroke recognition for tracing (current: ink-coverage heuristic, capped at hint-grade so the SRS stays honest)
- Bundle Noto Serif Ethiopic (iOS renders Ethiopic natively; Android font coverage varies by OEM)
- Timed heart regen + streak freezes; remote content delivery instead of bundled JSON
- Labialized/Tigrinya-specific families; sentence-level content (schema already supports phrases)
- Accounts/sync (all state is currently local AsyncStorage)
