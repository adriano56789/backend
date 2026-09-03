"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSCODE_VARIANT_REGEX = void 0;
exports.isTranscodeVariant = isTranscodeVariant;
exports.normalizeStreamId = normalizeStreamId;
exports.TRANSCODE_VARIANT_REGEX = /(?:_t\d+|_transcoded)$/;
function isTranscodeVariant(streamKey) {
    if (!streamKey)
        return false;
    return exports.TRANSCODE_VARIANT_REGEX.test(streamKey);
}
function normalizeStreamId(streamKey) {
    return streamKey.startsWith('stream_') ? streamKey.replace('stream_', '') : streamKey;
}
