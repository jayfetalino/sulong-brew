// Generated on 2026-11-17 from DiFluid's official documents. Do not edit by hand.
//
// Source: https://github.com/DiFluid/difluid-sdk-demo, commit df4e0731dc64 (2024-12-24),
// docs/protocolMicrobalance.md and docs/protocolR2.md. Each frame below is written out in
// those documents. They are used here only as test data.
//
// MIT License
//
// Copyright (c) 2023 Shenzhen Digitizing Fluid Technology Co., Ltd.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

export interface DocumentedFrame {
  /** The frame as written in the document, as spaced hexadecimal bytes. */
  hex: string;
  /** Where it appears (first time). */
  source: string;
}

/** Frames whose layout, data length and check sum all agree with DiFluid's own rules. */
export const DOCUMENTED_VALID_FRAMES: DocumentedFrame[] = [
  { hex: 'DF DF 00 00 00 BE', source: 'protocolMicrobalance.md line 43' },
  { hex: 'DF DF 00 00 06 00 36 38 42 36 42 EC', source: 'protocolMicrobalance.md line 46' },
  { hex: 'DF DF 00 00 06 01 33 32 34 31 37 C6', source: 'protocolMicrobalance.md line 47' },
  { hex: 'DF DF 00 00 06 02 42 30 30 30 30 C8', source: 'protocolMicrobalance.md line 48' },
  { hex: 'DF DF 00 01 00 BF', source: 'protocolMicrobalance.md line 53' },
  { hex: 'DF DF 00 02 00 C0', source: 'protocolMicrobalance.md line 57' },
  { hex: 'DF DF 01 00 00 BF', source: 'protocolMicrobalance.md line 88' },
  { hex: 'DF DF 01 00 01 00 C0', source: 'protocolMicrobalance.md line 89' },
  { hex: 'DF DF 01 00 01 01 C1', source: 'protocolMicrobalance.md line 92' },
  { hex: 'DF DF 01 01 01 00 C1', source: 'protocolMicrobalance.md line 97' },
  { hex: 'DF DF 01 03 00 C2', source: 'protocolMicrobalance.md line 104' },
  { hex: 'DF DF 01 03 01 00 C3', source: 'protocolMicrobalance.md line 105' },
  { hex: 'DF DF 01 04 00 C3', source: 'protocolMicrobalance.md line 112' },
  { hex: 'DF DF 01 04 01 00 C4', source: 'protocolMicrobalance.md line 113' },
  { hex: 'DF DF 01 04 01 01 C5', source: 'protocolMicrobalance.md line 116' },
  { hex: 'DF DF 03 00 00 C1', source: 'protocolMicrobalance.md line 175' },
  {
    hex: 'DF DF 03 00 0D 00 00 02 F8 00 00 00 00 00 0A 27 B0 00 A9',
    source: 'protocolMicrobalance.md line 176',
  },
  { hex: 'DF DF 03 01 01 00 C3', source: 'protocolMicrobalance.md line 184' },
  { hex: 'DF DF 03 02 01 01 C5', source: 'protocolMicrobalance.md line 187' },
  { hex: 'DF DF 03 03 01 00 C5', source: 'protocolMicrobalance.md line 191' },
  { hex: 'DF DF 03 04 01 01 C7', source: 'protocolMicrobalance.md line 194' },
  { hex: 'DF DF 03 05 00 C6', source: 'protocolMicrobalance.md line 197' },
  { hex: 'DF DF 03 05 08 05 64 01 00 00 00 00 00 38', source: 'protocolMicrobalance.md line 198' },
  { hex: 'DF DF 00 01 08 44 46 54 2D 52 31 30 32 B7', source: 'protocolR2.md line 31' },
  { hex: 'DF DF 00 02 04 54 30 30 33 AB', source: 'protocolR2.md line 35' },
  { hex: 'DF DF 01 01 00 C0', source: 'protocolR2.md line 68' },
  { hex: 'DF DF 01 01 01 01 C2', source: 'protocolR2.md line 69' },
  { hex: 'DF DF 01 02 00 C1', source: 'protocolR2.md line 76' },
  { hex: 'DF DF 01 02 01 1E E0', source: 'protocolR2.md line 77' },
  { hex: 'DF DF 01 02 01 64 26', source: 'protocolR2.md line 80' },
  { hex: 'DF DF 01 03 01 03 C6', source: 'protocolR2.md line 85' },
  { hex: 'DF DF 01 03 01 01 C4', source: 'protocolR2.md line 88' },
  { hex: 'DF DF 03 00 03 00 0B 00 CF', source: 'protocolR2.md line 154' },
  { hex: 'DF DF 03 00 03 00 00 00 C4', source: 'protocolR2.md line 158' },
  { hex: 'DF DF 03 00 06 01 03 17 03 14 01 FA', source: 'protocolR2.md line 162' },
  { hex: 'DF DF 03 00 07 02 00 4F 00 02 09 3D 61', source: 'protocolR2.md line 167' },
  { hex: 'DF DF 03 01 01 03 C6', source: 'protocolR2.md line 173' },
  { hex: 'DF DF 03 01 03 00 04 00 C9', source: 'protocolR2.md line 174' },
  { hex: 'DF DF 03 01 03 00 05 00 CA', source: 'protocolR2.md line 180' },
  { hex: 'DF DF 03 01 06 01 03 20 03 1C 01 0C', source: 'protocolR2.md line 181' },
  { hex: 'DF DF 03 01 07 02 FF F9 00 02 08 A6 73', source: 'protocolR2.md line 182' },
  { hex: 'DF DF 03 01 07 03 FF F9 FF FF E4 44 EA', source: 'protocolR2.md line 183' },
  { hex: 'DF DF 03 01 07 04 03 21 03 1B 01 03 13', source: 'protocolR2.md line 184' },
  { hex: 'DF DF 03 01 06 01 03 1F 03 1B 01 0A', source: 'protocolR2.md line 189' },
  { hex: 'DF DF 03 01 07 04 03 1F 03 1B 02 03 12', source: 'protocolR2.md line 192' },
  { hex: 'DF DF 03 01 07 02 FF FA 00 02 08 A9 77', source: 'protocolR2.md line 198' },
  { hex: 'DF DF 03 01 07 04 03 1F 03 1B 03 03 13', source: 'protocolR2.md line 200' },
  { hex: 'DF DF 03 01 03 00 06 00 CB', source: 'protocolR2.md line 202' },
];

/** Frames written in the documents that break DiFluid's own rules (typos in the documents). */
export const DOCUMENTED_INVALID_FRAMES: (DocumentedFrame & { problem: string })[] = [
  {
    hex: 'DF DF 01 08 44 46 54 2D 53 31 30 31 B7',
    source: 'protocolMicrobalance.md line 54',
    problem: 'wrong length',
  },
  {
    hex: 'DF DF 00 02 17 56 30 30 31 BE',
    source: 'protocolMicrobalance.md line 58',
    problem: 'wrong length',
  },
  {
    hex: 'DF DF 01 01 01 C0',
    source: 'protocolMicrobalance.md line 96',
    problem: 'wrong check sum and wrong length',
  },
];
