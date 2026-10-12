#!/usr/bin/env node
/* A test account for trying the editor on this computer (never the roster).
   Writes the password to private/dev-user.txt. Uses whatever store the
   server would (DATABASE_URL or ./data). */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { open } = require('../server/store');
const auth = require('../server/auth');
(async () => {
  const store = open(); await store.init();
  const pw = 'test-' + crypto.randomBytes(4).toString('hex');
  await store.upsertUser({ username:'demo', name:'Demo Student', period:'test', role:'student', ...auth.makeHash(pw) });
  const tpw = 'test-' + crypto.randomBytes(4).toString('hex');
  await store.upsertUser({ username:'demoteacher', name:'Demo Teacher', period:'', role:'teacher', ...auth.makeHash(tpw) });
  if(store.flush) store.flush();
  fs.writeFileSync(path.join(__dirname, '..', 'private', 'dev-user.txt'), `demo ${pw}\ndemoteacher ${tpw}\n`);
  console.log('wrote private/dev-user.txt');
  process.exit(0);
})();
