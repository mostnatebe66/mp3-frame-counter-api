import { Buffer } from "node:buffer";
import { countMp3Frames, FrameCounterError } from "../src/frame-counter.service";

const MP3_HEADER_SIZE = 4;

const createValidHeader = () => Buffer.from([0xff, 0xfb, 0x90, 0x00]);

const getExpectedFrameSize = () => {
  const bitrateKbps = 128;
  const sampleRateHz = 44100;
  return Math.floor((144000 * bitrateKbps) / sampleRateHz);
};

describe("FrameCounterError", () => {
  it("behaves like a normal Error but with a custom name", () => {
    const err = new FrameCounterError("boom");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("FrameCounterError");
    expect(err.message).toBe("boom");
  });
});

describe("countMp3Frames", () => {
  it("throws if the buffer is too small to contain any MP3 data", () => {
    const tiny = Buffer.from([0x00, 0x01, 0x02]);
    expect(() => countMp3Frames(tiny)).toThrow("File too small to be a valid MP3.");
  });

  it("throws when it can't find any MPEG1 Layer III frames", () => {
    const nonsense = Buffer.from([0x10, 0x20, 0x30, 0x40, 0x50]);
    expect(() => countMp3Frames(nonsense)).toThrow(
      "No MPEG Version 1 Layer III frames found in file."
    );
  });

  it("counts a single straightforward frame", () => {
    const header = createValidHeader();
    const frameSize = getExpectedFrameSize();

    const buffer = Buffer.alloc(frameSize);
    header.copy(buffer, 0);

    expect(countMp3Frames(buffer)).toBe(1);
  });

  it("skips junk before the first valid frame", () => {
    const header = createValidHeader();
    const frameSize = getExpectedFrameSize();

    const junk = Buffer.from([0, 1, 2, 3, 4]);
    const payload = Buffer.alloc(frameSize - MP3_HEADER_SIZE);
    const trailingNoise = Buffer.from([0xaa, 0xbb, 0xcc]);

    const buffer = Buffer.concat([junk, header, payload, trailingNoise]);

    expect(countMp3Frames(buffer)).toBe(1);
  });

  it("skips over an ID3v2 tag if it's present", () => {
    const header = createValidHeader();
    const frameSize = getExpectedFrameSize();
    const payload = Buffer.alloc(frameSize - MP3_HEADER_SIZE);

    const id3 = Buffer.alloc(10, 0);
    id3[0] = 0x49; // I
    id3[1] = 0x44; // D
    id3[2] = 0x33; // 3
    id3[9] = 0x04;

    const id3Body = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
    const buffer = Buffer.concat([id3, id3Body, header, payload]);

    expect(countMp3Frames(buffer)).toBe(1);
  });

  it("subtracts the frame when it detects a VBR header (Xing)", () => {
    const header = createValidHeader();
    const frameSize = getExpectedFrameSize();
    const buffer = Buffer.alloc(frameSize);

    header.copy(buffer);
    Buffer.from("Xing").copy(buffer, MP3_HEADER_SIZE);

    expect(countMp3Frames(buffer)).toBe(0);
  });

  it("doesn't subtract anything if the frame isn't a VBR header", () => {
    const header = createValidHeader();
    const frameSize = getExpectedFrameSize();
    const buffer = Buffer.alloc(frameSize);

    header.copy(buffer);
    Buffer.from("NOPE").copy(buffer, MP3_HEADER_SIZE);

    expect(countMp3Frames(buffer)).toBe(1);
  });
});
