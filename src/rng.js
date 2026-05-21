// djb2 hash: arbitrary string → non-zero 32-bit seed
function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++)
    h = (Math.imul(h, 33) ^ str.charCodeAt(i)) >>> 0;
  return h || 1;
}

// mulberry32 seeded PRNG — returns a () => [0, 1) function
export function makeRng(seedStr) {
  let s = hashString(seedStr);
  return function() {
    s = (s + 0x6D2B79F5) >>> 0;
    let z = Math.imul(s ^ (s >>> 15), 1 | s);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}
