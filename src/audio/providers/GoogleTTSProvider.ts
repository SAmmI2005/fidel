/**
 * Google Cloud TTS — secondary placeholder provider (am-ET available in
 * limited voices). Same contract as Azure. Like Azure, it has no Tigrinya
 * voice; supports() must stay honest about that.
 */
import * as FileSystem from 'expo-file-system';
import type { TTSProvider } from '../AudioService';

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_TTS_KEY ?? '';
const SUPPORTED = new Set(['am-ET']);

export class GoogleTTSProvider implements TTSProvider {
  readonly name = 'google';

  supports(locale: string | null): boolean {
    return !!GOOGLE_KEY && !!locale && SUPPORTED.has(locale);
  }

  async synthesize(text: string, locale: string, cacheKey: string): Promise<string> {
    const dir = `${FileSystem.cacheDirectory}tts/`;
    const file = `${dir}${this.name}_${cacheKey}.mp3`;
    const cached = await FileSystem.getInfoAsync(file).catch(() => null);
    if (cached?.exists) return file;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});

    const res = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: locale },
          audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9 },
        }),
      }
    );
    if (!res.ok) throw new Error(`Google TTS ${res.status}`);
    const json = await res.json();
    await FileSystem.writeAsStringAsync(file, json.audioContent, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return file;
  }
}
