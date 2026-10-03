/** MATCH-12: the real template escapes names and says "liked each other". */
const { templates } = require('../../utils/email');
describe('matchNotification template', () => {
  it('escapes the other member\'s name and uses the brand footer wording', () => {
    const t = templates ? templates.matchNotification('Aman', '<img src=x onerror=1>') : null;
    expect(t.html).not.toContain('<img src=x');
    expect(t.html).toContain('liked each other');
    expect(t.subject).not.toMatch(/❤/);
  });
});
