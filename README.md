# Code Studio

**Live: https://mesa-code-studio.onrender.com** (Render web service `srv-db6k8paj9qps73coko90`,
redeploys on every push to main of this repo; database: Supabase project `code-studio`, schema `codestudio`).

The MESA CS block editor: a Scratch-style editor on its own website, with a login for every
student, auto-save, and history. This is the standard editor going forward.

## Classroom (/)

The front page is set out like Google Classroom. A teacher sees a card per class (period); a
student goes straight to their own class. Each class has:

- **Stream** — the teacher's posts (one class or "Post to all my classes"; links are clickable)
  and an **Upcoming** box of work due soon.
- **Classwork** — **Game Design** (the one built-in assignment: the student's game in the block
  editor) and the teacher's own assignments. The tools (Blocks, Learn, Design, HTML) stay in the top
  bar. A game is done when it is **turned in**, which is the editor lock: the student can still open
  and play it, not change it, until the teacher presses **Give back**. **🔒 Turn in all** locks a
  whole class. The **Stream** shows each assignment as a card; the teacher's Game Design card shows
  every student's game (its picture and their name, 🔒 when turned in).
- **Game Feedback** (built in, after Game Design) — students play 4 classmates' games and fill out
  the feedback slip beside each one (the same slip as Class Games). Done at 4 finished slips; the
  teacher sees whose games each student reviewed.
- **＋ Create assignment** (teacher, on Classwork) — title, instructions, topic, due date, for one
  class or all of them. Students open it, **＋ Add HTML file** (up to 5 `.html` files, 400 KB each)
  and **Turn in** (Unsubmit to change it). The assignment page lists **every student by name** with
  their files and Assigned / Turned in / late / Missing; a file opens as the page it makes (in a
  sandboxed frame, so it cannot reach the site) or as its code. Built-in assignments (the Game
  Design Packet, the mazes, Intro to HTML…) have the same page: every student's name, their
  progress, and for the packet a link straight to that student's packet.
- **Grading** — each assignment has points (100 unless the teacher changes it; 0 = ungraded). On
  the assignment page the teacher types a grade next to each student's name (it saves straight
  away and the student sees it as e.g. 18 / 20) and opens 💬 **Private comments**, a thread
  between the teacher and that one student; the student can reply from their Your work card.
  Grades shows the grade (click it to go grade) and the class average of the grades given.
- **People** (teacher) — the class list with last login, and the teacher dashboard.
- **Grades** (teacher: every student × every assignment, with the class average) /
  **My work** (student).

Progress is worked out from what the tools already save; the list itself is
`public/js/classwork.js`. Posts, the teacher's assignments and the hide/due settings are in
`cs_classes` (one row per period); what students attach is in `cs_submissions`,
API `/api/room`. The block editor moved to **/studio** (old `/#/p/<id>` links are sent there).

## What students get (the block editor, /studio)

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
- **🖌 Paint**: draw a new sprite (under the sprite list), a new costume (Costumes tab), or a
  backdrop (🖌 under the Stage), and **✏️ Edit** any costume. Brush, eraser, line, rectangle and
  circle (outline or filled), paint bucket, text and a colour picker, 14 colours plus any colour,
  4 sizes, undo/redo (also Ctrl/⌘-Z). Sprites are drawn on a see-through canvas at twice stage size
  so they stay sharp; the ✛ in the middle is the costume's centre, and empty space round the
  drawing is cut off. Editing a costume puts it back exactly where it was.
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

## Learn (/learn)

**https://mesa-code-studio.onrender.com/learn** (🎮 in the top bar): coding games for 3rd graders,
same logins, English/Español, 🔊 read-aloud.

- **Bit's maze**, 18 levels in 4 chapters, each with a 🧠 word: 🤖 *Steps in order* (sequence),
  🔁 *Loops* (repeat, with a block limit so the loop is needed), 🐞 *Bug Hunt* (the code arrives
  with one mistake; fix it), 🔀 *IF / THEN* (repeat until ⭐, if wall ahead / path left / path right /
  💎 here). Tap a block to add it where the orange bar is; tap a gap to move the bar. ▶ Run acts it
  out and lights up each block as it runs. Fewer blocks = more ⭐ (3 at the best answer).
  Levels and their answers are in `public/js/learn-levels.js`; `tests/learn.test.js` solves every
  level, so a new level that cannot be solved fails the tests.
- **🧠 Code Words**: match 6 coding words to what they mean, against the clock.
- Links to the MESA games (Bug Squad, Arcade, Dino Run, Pong, Asteroid Dodge, MESA CS 0.2) and free
  sites (Blockly Games, Code.org, Scratch, Lightbot, CodeCombat).
- Stars are saved per student (`cs_learn`) and only ever go up. Teachers: 🍎 **Learn progress**
  shows stars and levels per chapter, by period.

## Intro to HTML (/html)

**https://mesa-code-studio.onrender.com/html** (`</> HTML` in the top bar): about 30 minutes of
short, repeat-until-it-sticks activities on the first HTML tags. Same logins, English/Español.

1. 🃏 **Flash Cards** — 14 tags; "Not yet" sends a card to the back until it is known.
2. ⌨️ **Type It** — type 14 real lines; a wrong key does not go in; the page shows what it makes.
3. 🔒 **Close the Tag** — 10 quick rounds: pick the closing tag.
4. 🎯 **What Did It Make?** — see a page, pick the code that made it.
5. 🧱 **Build a Page** — tap the lines of 4 pages in order (`<html>`, `<head>`, `<body>`…).
6. 🐞 **Fix the Tag** — pick the line with no bug; 💡 says what the bug was.
7. ✏️ **My First Page** — a code box beside a live page, tag buttons, Code Studio pictures
   (`<img src="star.png">`), and 5 goals to tick off. The page is saved.

Each ends with a score out of 100; the best is kept (inside `cs_learn`, key `html`) and **Again**
plays it once more. Content is in `public/js/html-lessons.js` (`tests/html.test.js` checks it).
Teachers: 🍎 **HTML progress** shows the best score per activity, by period.

Every tool's top bar has tabs back to 🏫 Classroom and across to ◆ Blocks, 🎮 Learn, 🎨 Design and
`</>` HTML (`public/js/sitenav.js`); in the editor they are in the Menu.

## Game Design Studio (/design)

**https://mesa-code-studio.onrender.com/design**: planning a game before building it, about an
hour of work, at a 3rd-grade reading level, in English and Spanish. It uses the **same logins**
(signing in to either site signs in to both), and the 🎨 button in Code Studio's top bar opens it.

It follows the Game Design Packet, one step per page (about 65 min in all):
👋 You are a game designer (keep it small) · 🔍 Research (play 2 of the arcade games at
arcade-blocks.onrender.com and answer player / goal / what stops you) · 💡 Big idea (game type,
idea mixer, title, pitch sentence, teacher check) · 🕹 Player (keys → actions, drawing) · 🎯 Goal ·
⚙️ Mechanics · 🔁 Core loop · 📏 IF / THEN rules · 👾 Challenge (drawing) · 🏁 Win & lose ·
⭐ Feedback · ⚖️ Balance · 🧠 Code plan (ideas filled in from the student's own answers) ·
🖼 Screen sketch with labels · 🎉 Checklist → **Build it in Code Studio**.

Every step has a 🧠 **Learn** card with one computer-science word (input, loop, conditional,
variable, algorithm, prototype, iterate…), a hidden 🟡 Pac-Man example, and 🔊 read-aloud on every
question. Some steps have a quick ❓ check question; a step is ✅ once its ⭐ boxes are filled.
📄 **My plan** shows the whole packet on one page to print.

Teachers: 🍎 **Game designs** lists every student by period (game title, steps done, last saved)
with the ⬜/✅ **Idea OK** check (the packet's "teacher initials" box) and 📄 to open or print
any student's plan. Plans save like projects (a copy in the browser first, then the server) into
the `cs_designs` table. A save from a copy that is out of date (the plan was changed on another
computer) is refused, and that page loads the newer copy.

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
