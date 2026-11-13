import * as ImageManipulator from "expo-image-manipulator";
import type { CameraView } from "expo-camera";

/** Takes a photo and returns a small JPEG data URI for the server (960 px wide by default). */
export async function capture(camera: CameraView | null, opts: { width?: number; quality?: number } = {}): Promise<string | null> {
  if (!camera) return null;
  const photo = await camera.takePictureAsync({ quality: opts.quality ?? 0.9, shutterSound: false });
  if (!photo?.uri) return null;
  const ctx = ImageManipulator.ImageManipulator.manipulate(photo.uri);
  ctx.resize({ width: opts.width ?? 960, height: null });
  const rendered = await ctx.renderAsync();
  const out = await rendered.saveAsync({ base64: true, compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
  return out.base64 ? `data:image/jpeg;base64,${out.base64}` : null;
}
