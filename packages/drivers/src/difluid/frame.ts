// DiFluid's message frame, as described in DiFluid's own documents
// (docs/difluid-protocol.md in https://github.com/DiFluid/difluid-sdk-demo, MIT license).
// See docs/protocols/difluid-frame-format.md in this repository for what is documented, what is
// only inferred from DiFluid's examples, and what is not stated.
//
//   byte 0   0xDF         header 1
//   byte 1   0xDF         header 2
//   byte 2   func         function group
//   byte 3   cmd          command within the group
//   byte 4   length       number of data bytes that follow
//   byte 5.. data         0 to 14 bytes
//   last     check sum    sum of every byte before it (only the low byte is kept)
//
// A whole frame is at most 20 bytes.

export const DIFLUID_HEADER = 0xdf;
export const DIFLUID_MAX_FRAME_BYTES = 20;
/** Header x2, func, cmd, length and check sum. */
const OVERHEAD_BYTES = 6;
export const DIFLUID_MAX_DATA_BYTES = DIFLUID_MAX_FRAME_BYTES - OVERHEAD_BYTES;

export interface DifluidFrame {
  func: number;
  cmd: number;
  data: Uint8Array;
}

/**
 * The check sum: the sum of the given bytes, keeping only the low byte.
 * DiFluid's documents do not say what happens above 255. Their examples match the low byte
 * (checked on 2026-11-16 against every frame written in their documents).
 */
export function difluidChecksum(bytes: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) sum += bytes[i] as number;
  return sum & 0xff;
}

function assertByte(value: number, what: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new RangeError(`${what} must be a whole number from 0 to 255, got ${value}`);
  }
}

/** Builds a frame ready to be sent. Throws if a value is not a byte or the data is too long. */
export function encodeDifluidFrame(
  func: number,
  cmd: number,
  data: ArrayLike<number> = [],
): Uint8Array {
  assertByte(func, 'func');
  assertByte(cmd, 'cmd');
  if (data.length > DIFLUID_MAX_DATA_BYTES) {
    throw new RangeError(
      `A DiFluid frame carries at most ${DIFLUID_MAX_DATA_BYTES} data bytes, got ${data.length}`,
    );
  }
  const frame = new Uint8Array(OVERHEAD_BYTES + data.length);
  frame[0] = DIFLUID_HEADER;
  frame[1] = DIFLUID_HEADER;
  frame[2] = func;
  frame[3] = cmd;
  frame[4] = data.length;
  for (let i = 0; i < data.length; i++) {
    const value = data[i] as number;
    assertByte(value, `data byte ${i}`);
    frame[5 + i] = value;
  }
  frame[frame.length - 1] = difluidChecksum(frame.subarray(0, frame.length - 1));
  return frame;
}

export type DifluidDecodeError =
  /** Not enough bytes for a whole frame yet. */
  | 'too-short'
  /** The first two bytes are not 0xDF 0xDF. */
  | 'bad-header'
  /** The data length would make the frame longer than 20 bytes. */
  | 'bad-length'
  /** The check sum does not match. */
  | 'bad-checksum';

export type DifluidDecodeResult =
  | { ok: true; frame: DifluidFrame; /** How many bytes the frame used. */ length: number }
  | { ok: false; error: DifluidDecodeError; message: string };

/** Reads one frame from the start of the bytes. Extra bytes after it are ignored. */
export function decodeDifluidFrame(bytes: ArrayLike<number>): DifluidDecodeResult {
  if (bytes.length < OVERHEAD_BYTES) {
    return { ok: false, error: 'too-short', message: 'Fewer than 6 bytes: not a whole frame yet.' };
  }
  if (bytes[0] !== DIFLUID_HEADER || bytes[1] !== DIFLUID_HEADER) {
    return { ok: false, error: 'bad-header', message: 'The frame does not start with DF DF.' };
  }
  const total = OVERHEAD_BYTES + (bytes[4] as number);
  if (total > DIFLUID_MAX_FRAME_BYTES) {
    return {
      ok: false,
      error: 'bad-length',
      message: `The data length makes the frame ${total} bytes, more than the ${DIFLUID_MAX_FRAME_BYTES} allowed.`,
    };
  }
  if (bytes.length < total) {
    return {
      ok: false,
      error: 'too-short',
      message: `The frame needs ${total} bytes but only ${bytes.length} are here.`,
    };
  }
  const expected = difluidChecksum(Array.prototype.slice.call(bytes, 0, total - 1));
  if (bytes[total - 1] !== expected) {
    return { ok: false, error: 'bad-checksum', message: 'The check sum does not match.' };
  }
  return {
    ok: true,
    length: total,
    frame: {
      func: bytes[2] as number,
      cmd: bytes[3] as number,
      data: Uint8Array.from(Array.prototype.slice.call(bytes, 5, total - 1)),
    },
  };
}

/**
 * Bluetooth delivers bytes in chunks that need not line up with frames: one frame can arrive
 * in two pieces, or two frames can arrive together, or noise can come first. Feed every chunk
 * to push() and it returns each complete, valid frame as soon as it is available.
 * Anything that cannot be part of a valid frame is thrown away byte by byte, and counted.
 */
export class DifluidFrameAssembler {
  private buffer: number[] = [];
  private discarded = 0;

  /** How many bytes have been thrown away because they could not be part of a valid frame. */
  get discardedBytes(): number {
    return this.discarded;
  }

  reset(): void {
    this.buffer = [];
  }

  push(chunk: ArrayLike<number>): DifluidFrame[] {
    for (let i = 0; i < chunk.length; i++) this.buffer.push(chunk[i] as number);
    const frames: DifluidFrame[] = [];

    for (;;) {
      // Drop anything in front of the next possible header.
      let start = -1;
      for (let i = 0; i + 1 < this.buffer.length; i++) {
        if (this.buffer[i] === DIFLUID_HEADER && this.buffer[i + 1] === DIFLUID_HEADER) {
          start = i;
          break;
        }
      }
      if (start === -1) {
        // Keep a lone final 0xDF: it may be the first half of a header.
        const keep = this.buffer[this.buffer.length - 1] === DIFLUID_HEADER ? 1 : 0;
        const drop = this.buffer.length - keep;
        this.discarded += drop;
        this.buffer = this.buffer.slice(drop);
        return frames;
      }
      if (start > 0) {
        this.discarded += start;
        this.buffer = this.buffer.slice(start);
      }

      const result = decodeDifluidFrame(this.buffer);
      if (result.ok) {
        frames.push(result.frame);
        this.buffer = this.buffer.slice(result.length);
      } else if (result.error === 'too-short') {
        return frames; // wait for more bytes
      } else {
        // A false start: skip one byte and look for the next header.
        this.discarded += 1;
        this.buffer = this.buffer.slice(1);
      }
    }
  }
}
