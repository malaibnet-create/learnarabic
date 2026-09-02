export function stableShuffle<T>(values: readonly T[], seedText: string): T[] {
  let seed = [...seedText].reduce(
    (total, character) => (total * 31 + character.charCodeAt(0)) >>> 0,
    2166136261,
  );
  const result = [...values];

  for (let index = result.length - 1; index > 0; index -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const swapIndex = seed % (index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}
