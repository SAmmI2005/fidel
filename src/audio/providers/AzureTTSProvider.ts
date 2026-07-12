/**
 * Azure Cognitive Services TTS. Placeholder audio source for Amharic
 * (voices: am-ET-MekdesNeural, am-ET-AmehaNeural). No Tigrinya voice exists —
 * supports() correctly returns false for it, which is load-bearing: it makes
 * the Tigrinya audio gap visible in the UI instead of papering over it.
 *
 * Configure via app config / env; never commit keys.
 */
import * as FileSystem from 'expo-file-system';
import type { TTSProvider } from '../AudioService';

const AZURE_KEY = process.env.EXPO_PUBLIC_AZURE_TTS_KEY ?? '';
const AZURE_REGION = process.env.EXPO_PUBLIC_AZURE_TTS_REGION ?? 'eastus';

const VOICES: Record<string, string> = {
  'am-ET': 'am-ET-MekdesNeural',
  // 'ti-ET': intentionally absent — no Azure Tigrinya voice. Do not add a
  // wrong-language voice here as a "fallback"; it teaches bad pronunciation.
};

export class AzureTTSProvider implements TTSProvider {
  readonly name = 'azure';

  supports(locale: string | null): boolean {
    return !!AZURE_KEY && !!locale && locale in VOICES;
  }

  async synthesize(text: string, locale: string, cacheKey: string): Promise<string> {
    const dir = `${FileSystem.cacheDirectory}tts/`;
    const file = `${dir}${this.name}_${cacheKey}.mp3`;
    const cached = await FileSystem.getInfoAsync(file).catch(() => null);
    if (cached?.exists) return file;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});

    const ssml =
      `<speak version='1.0' xml:lang='${locale}'>` +
      `<voice name='${VOICES[locale]}'><prosody rate='-10%'>${escapeXml(text)}</prosody></voice></speak>`;

    const res = await fetch(
      `https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_KEY,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        },
        body: ssml,
      }
    );
    if (!res.ok) throw new Error(`Azure TTS ${res.status}`);
    const buf = await res.arrayBuffer();
    await FileSystem.writeAsStringAsync(file, arrayBufferToBase64(buf), {
      encoding: FileSystem.EncodingType.Base64,
    });
    return file;
  }
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  // global btoa exists in RN's Hermes runtime
  return globalThis.btoa(binary);
}
