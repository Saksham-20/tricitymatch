/**
 * Chat socket wire contract.
 *
 * The modernization pass moved every chat broadcast to namespaced event names
 * (`message:new` / `message:edited` / `message:deleted`) and, for one release,
 * emitted the legacy names alongside them so already-installed clients kept
 * working. The legacy relays on the socket handler were no-opped in that same
 * commit, and every current client listens to the namespaced names only.
 *
 * The dual emit is now removed. Nothing pinned the wire contract while it
 * existed, so re-adding a legacy name — or renaming a namespaced one — would
 * have gone unnoticed until chat silently stopped updating in real time. This
 * test is that pin: it asserts on the emit table the controller actually passes
 * to `emitToConversation`, not on behaviour reachable from a unit test.
 */

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, '..', '..', 'controllers', 'chatController.js'),
  'utf8'
);

// Scope to the emitToConversation call bodies before reading tuple names: a
// bare [\'x\', tuple match also catches Sequelize attribute arrays elsewhere in
// the file, and the comments still mention the retired names on purpose.
const emitCalls = source.match(/emitToConversation\([^;]*?\]\s*\)\s*;/gs) || [];
const emittedEvents = emitCalls.flatMap((call) =>
  [...call.matchAll(/\[\s*'([^']+)'\s*,/g)].map((m) => m[1])
);

describe('chat broadcasts', () => {
  it('emits only namespaced event names', () => {
    expect(emittedEvents.length).toBeGreaterThan(0);
    for (const event of emittedEvents) {
      expect(event).toMatch(/^message:(new|edited|deleted|reaction)$/);
    }
  });

  it.each(['message', 'message-edited', 'message-deleted'])(
    'no longer emits the legacy name %s',
    (legacy) => {
      expect(emittedEvents).not.toContain(legacy);
    }
  );

  it('still broadcasts a new, an edited and a deleted event', () => {
    expect(emittedEvents).toEqual(expect.arrayContaining([
      'message:new',
      'message:edited',
      'message:deleted',
    ]));
  });
});

describe('the socket handler still refuses to relay client-sent writes', () => {
  const handler = fs.readFileSync(
    path.join(__dirname, '..', '..', 'socket', 'socketHandler.js'),
    'utf8'
  );

  // SOCK-3: these stay as explicit no-ops. Deleting them would be harmless
  // today (socket.io ignores unhandled events) but removes the marker that
  // says relaying them back out is deliberately not done.
  it.each(['message-edited', 'message-deleted'])('no-ops %s', (event) => {
    expect(handler).toMatch(
      new RegExp(`socket\\.on\\('${event}',\\s*\\(\\)\\s*=>\\s*\\{\\}\\)`)
    );
  });
});
