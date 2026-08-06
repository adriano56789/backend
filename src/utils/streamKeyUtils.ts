export const TRANSCODE_VARIANT_REGEX = /(?:_t\d+|_transcoded)$/;

export function isTranscodeVariant(streamKey?: string | null): boolean {
  if (!streamKey) return false;
  return TRANSCODE_VARIANT_REGEX.test(streamKey);
}

export function normalizeStreamId(streamKey: string): string {
  return streamKey.startsWith('stream_') ? streamKey.replace('stream_', '') : streamKey;
}
