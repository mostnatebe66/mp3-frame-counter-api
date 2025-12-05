export class FrameCounterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FrameCounterError';
  }
}

const ID3_HEADER_SIZE = 10;
const MP3_HEADER_SIZE = 4;

const BITRATE_INDEX_TO_KBPS = [
  null,
  32,
  40,
  48,
  56,
  64,
  80,
  96,
  112,
  128,
  160,
  192,
  224,
  256,
  320,
  null,
] as const;

type BitrateKbps = (typeof BITRATE_INDEX_TO_KBPS)[number];

const SAMPLE_RATE_INDEX_TO_HZ = [44100, 48000, 32000, null] as const;

type SampleRateHz = (typeof SAMPLE_RATE_INDEX_TO_HZ)[number];

const VBR_SIGNATURES = [Buffer.from('Xing'), Buffer.from('Info')] as const;

const parseSynchsafeInteger = (b0: number, b1: number, b2: number, b3: number): number => {
  return (b0 << 21) | (b1 << 14) | (b2 << 7) | b3;
};

const getAudioStartOffset = (buffer: Buffer): number => {
  if (buffer.length < ID3_HEADER_SIZE) {
    return 0;
  }

  const hasId3Signature =
    buffer[0] === 0x49 && // 'I'
    buffer[1] === 0x44 && // 'D'
    buffer[2] === 0x33; // '3'

  if (!hasId3Signature) {
    return 0;
  }
  const size = parseSynchsafeInteger(buffer[6], buffer[7], buffer[8], buffer[9]);

  return ID3_HEADER_SIZE + size;
};

type NonNullBitrateKbps = Exclude<BitrateKbps, null>;
type NonNullSampleRateHz = Exclude<SampleRateHz, null>;

type Mpeg1Layer3Header = {
  bitrateKbps: NonNullBitrateKbps;
  sampleRateHz: NonNullSampleRateHz;
  padding: number;
};

const parseMpeg1Layer3Header = (buffer: Buffer, offset: number): Mpeg1Layer3Header | null => {
  if (offset + MP3_HEADER_SIZE > buffer.length) return null;

  const b0 = buffer[offset];
  const b1 = buffer[offset + 1];
  const b2 = buffer[offset + 2];

  if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) return null;

  const versionBits = (b1 & 0x18) >> 3;
  if (versionBits !== 0b11) return null;

  const layerBits = (b1 & 0x06) >> 1;
  if (layerBits !== 0b01) return null;

  const bitrateIndex = (b2 & 0xf0) >> 4;
  const sampleRateIndex = (b2 & 0x0c) >> 2;
  const padding = (b2 & 0x02) >> 1;

  const bitrateKbps = BITRATE_INDEX_TO_KBPS[bitrateIndex];
  const sampleRateHz = SAMPLE_RATE_INDEX_TO_HZ[sampleRateIndex];

  if (bitrateKbps == null || sampleRateHz == null) return null;

  return { bitrateKbps, sampleRateHz, padding };
};

const getFrameSizeFromHeader = (header: Mpeg1Layer3Header): number => {
  const frameSize =
    Math.floor((144000 * header.bitrateKbps) / header.sampleRateHz) + header.padding;

  if (frameSize <= 0) {
    throw new FrameCounterError('Computed non-positive frame size.');
  }

  return frameSize;
};

//Output of scanFrames
type FrameScanResult = Readonly<{
  frameCount: number;
  firstFrameOffset: number | null;
  firstFrameSize: number | null;
}>;

const scanFrames = (buffer: Buffer, startOffset: number): FrameScanResult => {
  let offset = startOffset;
  let frameCount = 0;
  let firstFrameOffset: number | null = null;
  let firstFrameSize: number | null = null;

  while (offset + MP3_HEADER_SIZE <= buffer.length) {
    const header = parseMpeg1Layer3Header(buffer, offset);

    if (!header) {
      if (firstFrameOffset !== null) break;
      offset += 1;
      continue;
    }

    const frameSize = getFrameSizeFromHeader(header);

    if (firstFrameOffset === null) {
      firstFrameOffset = offset;
      firstFrameSize = frameSize;
    }

    frameCount += 1;
    offset += frameSize;
  }

  return { frameCount, firstFrameOffset, firstFrameSize };
};

const hasVbrHeader = (buffer: Buffer, offset: number, size: number): boolean => {
  const end = Math.min(buffer.length, offset + size);
  const firstFrame = buffer.subarray(offset, end);

  return VBR_SIGNATURES.some((sig) => firstFrame.includes(sig));
};

const applyVbrAdjustment = (buffer: Buffer, result: FrameScanResult): number => {
  const { frameCount, firstFrameOffset, firstFrameSize } = result;

  if (frameCount <= 0 || firstFrameOffset === null || firstFrameSize === null) {
    return frameCount;
  }

  if (!hasVbrHeader(buffer, firstFrameOffset, firstFrameSize)) {
    return frameCount;
  }

  // Remove VBR header frame from count to match MediaInfo result
  return frameCount - 1;
};

export const countMp3Frames = (buffer: Buffer): number => {
  if (buffer.length < MP3_HEADER_SIZE) {
    throw new FrameCounterError('File too small to be a valid MP3.');
  }

  const startOffset = getAudioStartOffset(buffer);
  const scanResult = scanFrames(buffer, startOffset);

  if (scanResult.firstFrameOffset === null) {
    throw new FrameCounterError('No MPEG Version 1 Layer III frames found in file.');
  }

  return applyVbrAdjustment(buffer, scanResult);
};
