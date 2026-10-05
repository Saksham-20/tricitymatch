/**
 * A password an admin can read out or paste: no look-alike characters (0/O,
 * 1/l/I), and at least one character of every class the server's password
 * policy asks for. Uses the browser CSPRNG, never Math.random.
 */
const SETS = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%&*?'];

const randomIndex = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
const pick = (chars) => chars[randomIndex(chars.length)];

export default function generatePassword(length = 16) {
  const all = SETS.join('');
  const out = SETS.map(pick);
  while (out.length < length) out.push(pick(all));
  // Fisher–Yates with the same CSPRNG so the guaranteed characters are not always first.
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join('');
}
