const fromHex = (s) =>
  Uint8Array.from(
    s
      .trim()
      .split(/\s+/)
      .map((v) => parseInt(v, 16)),
  );
// Real state fixture published in TUSB's MIT-licensed TonexMessagesTest.kt.
export const stateFixture = fromHex(`B9 03 81 06 03 80 A0 02
B9 01 B9 0E 82 4C 42 4C 47 B9 03 00 04 00 88 00 00 80 40 00 01 01 BA 14
B9 03 80 9F 80 FF 00 B9 03 2F 00 80 FF B9 03 00 80 FF 00 B9 03 00 80 FF 00
B9 03 0F 80 FF 2F B9 03 80 FF 00 00 B9 03 00 00 80 FF B9 03 80 BF 80 BF 80 BF
B9 03 80 9F 80 FF 00 B9 03 00 80 FF 80 FF B9 03 11 11 00 B9 03 80 FF 00 00
B9 03 00 11 00 B9 03 0A 00 0A B9 03 00 22 06 B9 03 11 00 00 B9 03 00 00 11
B9 03 0B 0B 0B B9 03 11 22 00 B9 03 00 19 19
BC 06 03 00 0A 00 0B 00 00 00 81 B8 01 01 00 88 F0 6F 26 43`);
