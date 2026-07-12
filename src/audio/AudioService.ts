/**
 * AudioService — the only thing screens talk to. Resolution order:
 *
 *   1. StaticFileProvider  — real recordings shipped/downloaded at item.audio_path
 *   2. TTS provider        — Azure or Google, synthesized once, cached to disk
 *   3. 'unavailable'       — surfaced to the UI as a "recording needed" state
 *
 * Because everything is keyed by ContentItem.id, swapping placeholder TTS for
 * native-speaker recordings is a pure asset drop: put an mp3 at the item's
 * audio_path and it wins automatically. No code, schema, or content changes.
 *
 * KNOWN GAP (do not "fix" by hardcoding): Tigrinya has no usable cloud TTS
 * voice. The Tigrinya course is marked audio_strategy: "recorded" and its
 * tts_locale is null, so the chain skips TTS and reports 'unavailable' until
 * recordings exist. See README §Audio.
 */
import { Audio } from 'expo-av';
import type { ContentItem, CourseId } from '../types/content';
import { getCourse } from '../content/loader';
import { AzureTTSProvider } from './providers/AzureTTSProvider';
import { GoogleTTSProvider } from './providers/GoogleTTSProvider';
import { StaticFileProvider } from './providers/StaticFileProvider';

export type AudioResolution =
  | { status: 'ok'; uri: string; source: 'recording' | 'tts' }
  | { status: 'unavailable'; reason: string };

export interface TTSProvider {
  readonly name: string;
  supports(locale: string | null): boolean;
  /** Synthesize and return a local file URI (providers handle their own caching). */
  synthesize(text: string, locale: string, cacheKey: string): Promise<string>;
}

// Swap providers here (or wire to remote config). Order matters.
const ttsProviders: TTSProvider[] = [new AzureTTSProvider(), new GoogleTTSProvider()];
const staticFiles = new StaticFileProvider();

let sound: Audio.Sound | null = null;

export async function resolveAudio(courseId: CourseId, item: ContentItem): Promise<AudioResolution> {
  const { content } = getCourse(courseId);

  const recorded = await staticFiles.resolve(item.audio_path);
  if (recorded) return { status: 'ok', uri: recorded, source: 'recording' };

  const locale = content.tts_locale;
  const provider = ttsProviders.find((p) => p.supports(locale));
  if (locale && provider) {
    try {
      const uri = await provider.synthesize(item.glyph, locale, item.id);
      return { status: 'ok', uri, source: 'tts' };
    } catch (e) {
      return { status: 'unavailable', reason: `TTS failed (${provider.name}): ${String(e)}` };
    }
  }
  return {
    status: 'unavailable',
    reason:
      content.audio_strategy === 'recorded'
        ? 'No recording yet — native-speaker audio needed for this course.'
        : 'No TTS provider supports this locale.',
  };
}

export async function play(courseId: CourseId, item: ContentItem): Promise<AudioResolution> {
  const res = await resolveAudio(courseId, item);
  if (res.status !== 'ok') return res;
  try {
    if (sound) {
      await sound.unloadAsync().catch(() => {});
      sound = null;
    }
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const created = await Audio.Sound.createAsync({ uri: res.uri }, { shouldPlay: true });
    sound = created.sound;
  } catch (e) {
    return { status: 'unavailable', reason: `Playback failed: ${String(e)}` };
  }
  return res;
}
