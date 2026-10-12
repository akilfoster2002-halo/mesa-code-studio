# Code Studio

**Live: https://code-studio-3ic6.onrender.com** (Render web service `srv-db6er9142hec73c05jo0`,
redeploys on every push to main; database: Supabase project `code-studio`, schema `codestudio`).

The MESA CS block editor: a Scratch-style editor on its own website, with a login for every
student, auto-save, and history. This is the standard editor going forward.

## What students get

- **Every Scratch block**: Motion, Looks, Sound, Events, Control, Sensing, Operators, Variables,
  Lists and My Blocks (138 blocks), plus the **Pen**, **Music** and **Text to Speech** extensions
  (＋ at the bottom of the category list). Same colours, words and behaviour as Scratch 3.
  Block words stay in English (they are the code); everything else is English/Español (ES/EN button).
- **Drop a block anywhere**: between any two blocks, above the first, below the last, at the top of
  any loop/if/else (empty or not), round a whole script (an empty C block wraps it), or into any
  slot. A grey bar shows where it will land. Dragging a block takes the blocks under it, as in
  Scratch. Right-click → **Delete Block** removes only that block (a loop's insides stay).
  Drag onto the palette to delete; drag onto another sprite to copy. Ctrl/⌘-Z undoes.
- **Costumes and backdrops**: ⤒ Upload (or drag files in, or paste) PNG, JPG, GIF, WebP, BMP,
  AVIF, SVG… PNG with a see-through background works best. Big pictures are shrunk to fit;
  a picture with a solid background gets a 🪄 **Remove background** button. Also ⇋ Flip and a
  built-in library.
- **Sounds**: ⤒ Upload MP3, WAV, OGG, M4A/AAC, FLAC, WebM, AIFF, or the sound out of an MP4/MOV
  video. MP3 is kept as is; everything else is saved as WAV so it plays on every computer.
  🎙 Record from the microphone, or pick from the library.
- **Auto-save**: every change is saved about 1½ seconds later ("✓ Saved 2:31"). If the internet
  drops, the work is kept in the browser and sent when it comes back.
- **Names and history**: every project has a name (click the title to rename). 🕘 **History**
  lists saved versions (one every 2 minutes of work, up to 60 per project, thinned so the
  oldest stay) and "Go back to this version" — the version being replaced is kept too.
  💾 Save now makes a version on purpose.
- **My Projects**: all of a student's projects with pictures, plus rename, duplicate, delete
  (and 🗑 Recently deleted to bring one back). 📁 lets them download a project file or load one.

## Logins

Every student in periods 2–6 (from the "Comp Sci Grade/HW input" sheet, 128 students) has an
account. **Usernames** are first name + first letter of the last name (`emilyc`); **passwords** are
an easy word and two digits (`tiger47`), not case-sensitive.

The passwords are only on this computer, never in the repo:

- `private/login-cards.html` — open and print: one cut-out card per student, by period
- `private/logins.csv` — the same as a spreadsheet, plus the **teacher** account

The teacher account (`teacher`) sees **🍎 Students**: every period, each student's projects
(opened read-only) and **Reset password**.

To add students: add lines to `private/students.txt` (`period | Last, First`), run
`npm run logins` (existing students keep their passwords), then `npm run seed` with
`DATABASE_URL` set to put the new accounts in the live database. The class list never goes in
this repo — `private/` is gitignored.

Sessions last 12 hours (lab computers are shared) — remind students to **Log out**.
Five wrong passwords is fine; eight in ten minutes locks that username for ten minutes.

## Running it

```bash
npm install
npm start
```

Then open http://localhost:8790. Without `DATABASE_URL` everything is kept in `data/` (JSON +
files). `npm test` runs the server tests.

## Hosting

A Node web service plus a Postgres database (tables are prefixed `cs_`, so it can share a
database with something else). Set:

| variable | |
|---|---|
| `DATABASE_URL` | Postgres connection string (required in production — Render's disk is wiped on every deploy) |
| `SESSION_SECRET` | any long random string (keeps everyone signed in across restarts) |
| `NODE_ENV` | `production` |

`render.yaml` describes the Render web service. On Supabase the app signs in as its own role
`code_studio` through the session pooler (`aws-0-us-east-1.pooler.supabase.com:5432`, user
`code_studio.<project ref>`); that role's default `search_path` is the `codestudio` schema, so the
tables stay out of `public`, which Supabase serves over its web API. The password and session
secret are in `private/` and in the Render environment, never in the repo.

## How it is built

| file | job |
|---|---|
| `server/index.js` | static files + the JSON API (login, projects, versions, assets, teacher) |
| `server/store.js` | Postgres or JSON-file storage behind one interface; version thinning |
| `server/auth.js` | scrypt passwords, signed session cookie |
| `public/js/blocks.js` | every block, as data: shape, words, slots, menus |
| `public/js/vm.js` | runs the blocks with Scratch's rules (30 fps threads, clones, broadcasts, My Blocks…) |
| `public/js/render.js` | the stage, graphic effects, pen, speech bubbles, pixel-accurate touching |
| `public/js/editor.js` | palette + scripts canvas, drag and drop, menus, variables, Make a Block |
| `public/js/media.js` | loading, uploading and converting pictures and sounds; remove background; record |
| `public/js/panes.js` | sprite list, Costumes and Sounds tabs, library |
| `public/js/stage.js` | ⚑/■, mouse and keys, monitors, the ask box, dragging sprites |
| `public/js/app.js` | sign-in, My Projects, the editor screen, auto-save, history, teacher page |
| `public/js/library.js` | built-in sprites/backdrops (SVG) and sounds (made by WebAudio) |
