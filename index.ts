import * as bitcoin from "bitcoinjs-lib";

export type Rune = number;

export type RuneId = {
  block: number;
  tx: number;
};

export type Edict = {
  id: RuneId;
  amount: number;
  output: number;
};

export type Terms = {
  amount: number | null;
  cap: number | null;
  height: [number | null, number | null];
  offset: [number | null, number | null];
};

export type Etching = {
  divisibility: number | null;
  premine: number | null;
  rune: Rune | null;
  spacers: number | null;
  symbol: string | null;
  terms: Terms | null;
};

export type Runestone = {
  edicts: Edict[];
  etching: Etching | null;
  mint: RuneId | null;
  pointer: number | null;
};

export enum Flag {
  Etching = 0,
  Terms = 1,
  Cenotaph = 127,
}

export enum Tag {
  Body = 0,
  Flags = 2,
  Rune = 4,
  Premine = 6,
  Cap = 8,
  Amount = 10,
  HeightStart = 12,
  HeightEnd = 14,
  OffsetStart = 16,
  OffsetEnd = 18,
  Mint = 20,
  Pointer = 22,
  Cenotaph = 126,
  Divisibility = 1,
  Spacers = 3,
  Symbol = 5,
  Nop = 127,
}

export const MAGIC_NUMBER = bitcoin.opcodes.OP_13;
export const COMMIT_INTERVAL = 6;

const encodeToVec = (n: number, v: number[]): number[] => {
  while (n >> 7 > 0) {
    v.push((n & 0x7f) | 0b1000_0000);
    n >>= 7;
  }
  v.push(Number(n & 0x7f));
  return v;
};

export const encodeTag = (
  tag: Tag,
  values: [number, number],
  payload: number[]
): number[] => {
  for (const value of values) {
    payload = encodeToVec(tag, payload);
    payload = encodeToVec(value, payload);
  }
  return payload;
};

export const encodeOptionTag = (
  tag: Tag,
  value: any | null,
  payload: number[]
): number[] => {
  if (value) {
    payload = encodeToVec(value, payload);
  }
  return payload;
};

export const sortByKey = (arr: any, f: (arg: any) => number) => {
  const nextArr = arr.sort((a: any, b: any) => f(a) < f(b));
  return nextArr;
};

export const encipher = (runestone: Runestone) => {
  let payload: number[] = [];

  if (runestone.etching) {
    let flags = 0;
    flags |= 1 << Flag.Etching;

    if (runestone.etching.terms) {
      flags |= 1 << Flag.Terms;
    }

    payload = encodeTag(Tag.Flags, [flags, 0], payload);
    payload = encodeOptionTag(Tag.Rune, runestone.etching.rune, payload);
    payload = encodeOptionTag(
      Tag.Divisibility,
      runestone.etching.divisibility,
      payload
    );
    payload = encodeOptionTag(Tag.Spacers, runestone.etching.spacers, payload);
    payload = encodeOptionTag(Tag.Symbol, runestone.etching.symbol, payload);
    payload = encodeOptionTag(Tag.Premine, runestone.etching.premine, payload);

    if (runestone.etching.terms) {
      payload = encodeOptionTag(
        Tag.Amount,
        runestone.etching.terms.amount,
        payload
      );
      payload = encodeOptionTag(Tag.Cap, runestone.etching.terms.cap, payload);
      payload = encodeOptionTag(
        Tag.HeightStart,
        runestone.etching.terms.height[0],
        payload
      );
      payload = encodeOptionTag(
        Tag.HeightEnd,
        runestone.etching.terms.height[1],
        payload
      );
      payload = encodeOptionTag(
        Tag.OffsetStart,
        runestone.etching.terms.offset[0],
        payload
      );
      payload = encodeOptionTag(
        Tag.OffsetEnd,
        runestone.etching.terms.offset[1],
        payload
      );
    }
  }

  if (runestone.mint) {
    payload = encodeTag(
      Tag.Mint,
      [runestone.mint.block, runestone.mint.tx],
      payload
    );
  }

  payload = encodeOptionTag(Tag.Pointer, runestone.pointer, payload);

  if (runestone.edicts.length > 0) {
    payload = encodeToVec(Tag.Body, payload);

    const edicts: Edict[] = sortByKey(runestone.edicts, (e) => e.id);
    let previous: RuneId | null = null;

    for (const edict of edicts) {
      previous = edict.id;
      payload = encodeToVec(edict.id.block, payload);
      payload = encodeToVec(edict.id.tx, payload);
      payload = encodeToVec(edict.amount, payload);
      payload = encodeToVec(edict.output, payload);
    }
  }

  const builder = bitcoin.script.compile([
    bitcoin.opcodes.OP_RETURN,
    MAGIC_NUMBER,
    ...payload.map((n) => bitcoin.script.number.encode(n)),
  ]);

  return builder;
};
