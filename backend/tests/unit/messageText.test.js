/**
 * Chat text is stored as typed. The old sanitiser escaped it on write and no
 * client ever decoded it, so members saw entities and edits compounded them.
 */
const { cleanMessageText } = require('../../utils/messageText');

describe('cleanMessageText', () => {
  it.each([
    ["It's fine", "It's fine"],
    ['Tom & Jerry', 'Tom & Jerry'],
    ['say "hello"', 'say "hello"'],
    ['I <3 this', 'I <3 this'],
    ['5 > 3 and 2 < 4', '5 > 3 and 2 < 4'],
    ['x <y and z> w', 'x <y and z> w'],
    ['$500 budget', '$500 budget'],
    ['https://a.example/p?x=1&y=2', 'https://a.example/p?x=1&y=2'],
  ])('keeps %j exactly', (input, expected) => {
    expect(cleanMessageText(input)).toBe(expected);
  });

  it('is idempotent, so an edit cannot compound escaping', () => {
    const once = cleanMessageText("Tom & Jerry's \"plan\" <ok>");
    expect(cleanMessageText(once)).toBe(once);
  });

  it('removes control characters but keeps newlines and tabs, and trims', () => {
    expect(cleanMessageText('  a\u0000b\u0007c\nd\te  ')).toBe('abc\nd\te');
  });

  it('returns an empty string for non-strings', () => {
    expect(cleanMessageText(null)).toBe('');
    expect(cleanMessageText({ a: 1 })).toBe('');
    expect(cleanMessageText(42)).toBe('');
  });
});
