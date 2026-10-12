#!/usr/bin/env node
/* Adds every student in private/roster.json who does not have an account
   yet to the database (DATABASE_URL, or ./data without it). Run after
   `npm run logins`. Existing accounts are left exactly as they are. */
process.env.SEED_ONLY = '1';
const { store, ready } = require('../server/index.js');
ready.then(() => { if(store.flush) store.flush(); return store.pool && store.pool.end(); })
  .then(() => process.exit(0), e => { console.error(e.message); process.exit(1); });
