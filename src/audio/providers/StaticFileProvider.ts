/**
 * Resolves real recordings. Two sources, checked in order:
 *  1. Files downloaded into the app's document dir (post-MVP: CDN sync),
 *     at   <documentDirectory>/audio/<audio_path>
 *  2. Bundled assets registered in the manifest below.
 *
 * To swap in a native-speaker recording for any item, drop the file at its
 * ContentItem.audio_path and (if bundling) add one line to BUNDLED.
 */
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

// Bundled recordings. Metro requires static require() calls, so bundled
// audio is registered here. Example (uncomment once files exist):
// const BUNDLED: Record<string, number> = {
//   'ti/w_selam.mp3': require('../../../assets/audio/ti/w_selam.mp3'),
// };
const BUNDLED: Record<string, number> = {};

export class StaticFileProvider {
  async resolve(audioPath: string): Promise<string | null> {
    // 1. downloaded file
    const local = `${FileSystem.documentDirectory}audio/${audioPath}`;
    const info = await FileSystem.getInfoAsync(local).catch(() => null);
    if (info?.exists) return local;

    // 2. bundled asset
    const mod = BUNDLED[audioPath];
    if (mod != null) {
      const asset = Asset.fromModule(mod);
      if (!asset.localUri) await asset.downloadAsync();
      return asset.localUri ?? asset.uri;
    }
    return null;
  }
}
