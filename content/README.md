# Editing the words on the Green Pastures website

This is the guide for the people who own the words: the daycare, and whoever writes the Chinese. You do not
need to install anything, and you do not need to know how the site is built. Everything happens in your
browser, on github.com.

**One folder.** Everything you will ever edit is inside this `content/` folder. Words live in a language
folder; facts — the phone number, the hours, the licence number — live once in `content/site.json`. If the
answer to "where do I change this?" is not a path that starts with `content/`, the answer is "ask the
developer."

Every change you make becomes a **pull request**: a proposal the site shows you on a private preview link
before anything goes live. Nothing you do here can break the public site by accident.

Beside this guide is [`GLOSSARY.md`](GLOSSARY.md): what every word in these instructions means — *key*,
*locale*, *collection*, *provisional* — and the agreed English, Simplified and Traditional rendering of every
term the site repeats. Read a row of it whenever a word here is unfamiliar.

---

## 1 · What is in this folder

```
content/
├── site.json                     the facts: phone, hours, licence, photos, order of things
├── README.md                     this guide
├── GLOSSARY.md                   the words we keep the same, in all three languages
├── zh-Hans/                      the Simplified Chinese words — same file names, still being filled in
└── en/                           the English words
    ├── messages/                 one file per page or area  (12 files)
    │   ├── common.json           top bar, footer, buttons, language switch
    │   ├── home.json             everything on the home page
    │   ├── philosophy.json       the Philosophy page
    │   ├── programs.json         the Programs page
    │   ├── menu.json             the Menu page
    │   ├── gallery.json          the Gallery page
    │   ├── reviews.json          the Reviews page
    │   ├── team.json             the Our Team page
    │   ├── visit.json            the "Book a tour" form
    │   ├── email.json            the two emails the form sends
    │   ├── errors.json           "Page not found" and "Something went wrong"
    │   └── faq.json              reserved — there is no FAQ page yet
    └── collections/              repeatable things  (6 files)
        ├── programs.json         the three programs
        ├── teachers.json         the teacher cards
        ├── testimonials.json     the parent reviews
        ├── menu.json             the week of meals
        ├── gallery.json          photo captions
        └── faq.json              reserved — currently empty
```

**Chinese.** `content/zh-Hans/` is the Simplified Chinese half, with the same file names in the same two
folders: the Chinese for a sentence is at the same path with `zh-Hans` in place of `en`, under the same key.

It is **not finished**. Only the sentences the design already had in Chinese are in there — the home page and
the navigation, mostly; several files are still empty and none of the collections have been translated. That
is expected and it blocks nothing: a page with no Chinese yet shows the English. Filling it in is §7, and the
coverage report is the to-do list.

Traditional Chinese will live in `content/zh-Hant/` and **is not switched on yet** (§7).

---

## 2 · Where is the text for…

| What you see on the site | File (inside `content/en/`, and the same path inside `content/zh-Hans/`) | Look under |
|---|---|---|
| Top bar, menu words, footer links, "Book a tour", the language switch | `messages/common.json` | `nav`, `footer`, `localeSwitcher`, `links` |
| The quotation marks drawn around a parent's review | `messages/common.json` | `punctuation.quoteOpen`, `punctuation.quoteClose` — “ ” in English and Simplified, 「 」 the usual Traditional choice |
| Home — headline, green badge, the two buttons, the meals card | `messages/home.json` | `hero` |
| Home — the philosophy, programs, menu, gallery, reviews, teachers and visit blocks | `messages/home.json` | `philosophy`, `programs`, `menu`, `gallery`, `testimonials`, `teachers`, `visit` |
| Philosophy page — the principles and the daily rhythm | `messages/philosophy.json` | `principles`, `day`, `badges` |
| Programs / Menu / Gallery / Reviews / Team page headings and the words around the content | `messages/programs.json`, `menu.json`, `gallery.json`, `reviews.json`, `team.json` | every one has `kicker` and `heading`; then whatever that page needs — `intro` and `note` on Menu, `footnote` on Programs and Team, `hint` and `filters` on Gallery, `countLine` and `yelpCta` on Reviews, `roles` on Team |
| The three program cards (names, ages, descriptions) | `collections/programs.json` | `infant`, `toddler`, `preschool` |
| The dishes for each weekday, and the dietary chips | `collections/menu.json` | `week.mon.breakfast` … `week.fri.snack`, `dietary` |
| The teacher cards | `collections/teachers.json` | `reyes`, `ping`, `chen` |
| Parent reviews | `collections/testimonials.json` | `meiL`, `davidPriya`, `karenT`, `alanW` |
| Photo captions, and the description a screen reader reads out | `collections/gallery.json` | `photos.g01` … `photos.g08`, `categories` |
| The tour-request form — labels, error messages, thank-you | `messages/visit.json` | `form` |
| The two emails the form sends (to you, and back to the parent) | `messages/email.json` | `inquiry`, `autoReply` |
| "Page not found" and "Something went wrong" | `messages/errors.json` | `notFound`, `serverError` |
| Browser-tab titles and the grey text under a Google result | each page's file | `meta.title`, `meta.description`; plus `common.json` → `meta` |
| Hours, phone, email, address, Yelp rating, licence number, photo files, the order of teachers | `site.json` (one file, no language) | `hours`, `contact`, `yelp`, `license`, `images`, `teachers` |
| The daycare's name in each language | `site.json` → `brand.name`, `brand.shortName` | one entry per language, inside the one field |
| Anything still showing a made-up sample value | `site.json` → `provisional` | see §6 |

### Three things that table cannot show you

**A key ending in `Short` is the phone wording of the key above it.** In
`content/en/messages/philosophy.json`:

```json
"intro": "Certified Montessori guides, unhurried mornings, and a prepared home where independence grows naturally — in English and 中文.",
"introShort": "Certified Montessori guides, unhurried mornings, and a prepared home — in English and 中文."
```

Both exist; the site picks one by screen width. Change one and forget the other and half your visitors keep
reading the old sentence, with nothing to warn you. **Always fix the pair.**

**The footer year is not stored anywhere.** `common.json` → `footer.copyright` is
`"© {year} {brandName} · {brandNameOther} · Fremont, CA · License # {license}"`. The site fills in the year,
the names and the licence number itself. There is nothing to update in January.

**The daycare's name is never typed into a sentence.** Copy contains `{brandName}` or `{brandShortName}`, and
the site puts the right name in for the language being read. Changing the name is one edit in `site.json` and
every page follows.

---

## 3 · Seven rules

1. **Change only the words between the quotes.** The part on the left of the colon is the key — the site
   looks the sentence up by that name. Renaming it makes the text disappear.
2. **Keep every `{…}` exactly as it is** — all of it, including anything after a comma. `{brandName}` and
   `{weekday}` are filled in by the site; `{count, number}` and `{rating, number, rating}` say *fill in this
   number, formatted for this language*. Translate the words around a placeholder, move it if the sentence
   needs it elsewhere, never translate what is inside it. **One placeholder behaves differently in Chinese:**
   `{count, plural, one {review} other {reviews}}` picks the English word by the number, and Chinese has one
   form for both — so the Chinese sentence writes the noun plainly. English
   `"<count>{count, number}</count> {count, plural, one {review} other {reviews}} · Fremont parents"` becomes
   `"<count>{count, number}</count> 条评价 · 弗里蒙特家长"`. That is correct, not a lost placeholder.
3. **`\n` is a line break.** In `home.json` → `hero.title` the value is
   `"Where small hands\nlearn <em>big things</em>"` — two lines. Keep it, or move it, but do not press Enter
   inside the quotes.
4. **Every English change needs the same key in each Chinese file.** English is the reference: a sentence
   exists in English first, then in Simplified, then in Traditional. The check on your pull request lists the
   two Chinese languages separately, so one English edit usually makes two lines on the to-do list.
5. **No numbers, phone numbers, links or file names in a language file.** Those are facts and they belong in
   `site.json`, once, for all languages. A phone number copied into three files is a phone number that will
   be wrong in two of them.
6. **Keep the tags English has; never invent one.** Three appear in the text today, and they are not HTML —
   each names a role the design paints: `<em>…</em>` is the hand-drawn sage underline (`hero.title`, the
   philosophy quote, Mei L.'s review), `<count>…</count>` wraps the review number that counts up, and
   `<day>…</day>` is the bold weekday in the menu line. Put the same tags around the words that carry the same
   emphasis in your language. Anything else — `<br>`, `<b>`, `<a href=…>` — is rejected: use `\n` for a line
   break and ask the developer for a link.
7. **JSON files have no comments — never add a `_comment` key.** It is not a note, it is a real entry the
   check rejects. Put the explanation in the pull request instead, or in this guide.

---

## 4 · Changing a sentence, step by step

1. Open the repository on github.com. Click into `content` → `en` → `messages` → the file from the table in
   §2, say `home.json`. Click the **pencil** icon ("Edit this file").
2. Find the key and change the words between the quotes. Leave the key, the quotes, the commas, and anything
   inside `{…}` or `<…>` alone.
3. Click **Commit changes…**. In **Commit message** write what changed in plain words — "Update hero
   subtitle". In **Extended description** paste the `Bead:` line from §5. Choose **Create a new branch for
   this commit and start a pull request**, keep the branch name it suggests, and click **Propose changes**.
4. The next screen pre-fills a description from the template. Say what changed, which screens it touches and
   which languages, then click **Create pull request**. **Leave the `Bead:` line at the very bottom** — the
   check reads the last line and nothing may come after it.
5. Now do the same sentence in Chinese. Use the branch selector at the top left of the file view to switch to
   your new branch, open the same file under `content/zh-Hans/messages/`, and edit the same key — or add it,
   if that file does not have it yet. This time choose **Commit directly to the branch**, pasting the `Bead:`
   line again, because *every* commit is checked, not only the first. It joins the same pull request. If
   Traditional Chinese has been switched on by then, repeat under `content/zh-Hant/messages/`. If you cannot
   translate it, leave it and say so in the pull request; the translator picks it up from the coverage report.
   And if the key has a `Short` twin, edit that too, in every language.
6. Within a few minutes the pull request shows its **checks** and a comment with a **preview link**. Open it
   and look at the screen you changed, in each language, on a desktop and on a phone. Two things to watch
   for: text in brackets like `⟦home.hero.title⟧` means that key is missing everywhere (check the spelling),
   and an English sentence sitting on a Chinese page means that language's version is missing and the site
   fell back to English.
7. Green checks and a preview that looks right → write "ready" as a comment. The developer approves and
   presses **Squash and merge**. The live site updates in about two minutes.
8. A red check → click **Details** next to it, scroll to the red lines, and look them up in §10. Something
   wrong on the preview → edit again on the same branch (repeat 1–3, choosing your branch, `Bead:` line each
   time) and the preview rebuilds.

---

## 5 · The `Bead:` line

Every commit and every pull request has to end with one line naming the piece of work it belongs to. There is
a standing entry for content edits, so you paste the same line every time and never touch the tracker:

```
Bead: <content-edits id>
```

> **The developer fills this in.** The standing "content edits" entry has not been created yet. Until the real
> id replaces `<content-edits id>` on this line, ask the developer for it before your first edit — pasting the
> placeholder will fail the check.

Where it goes:

- in the **Extended description** box of *every* commit, including the second and third ones on the same
  branch;
- as the **very last line** of the pull request description — the template already puts it there. Nothing
  after it: no heading, no signature, no horizontal rule.

If you forget, the `bead-trailer` check goes red with *"no Bead: trailer on commit …"*. It is not damage; the
developer fixes the wording on your branch. Next time, paste it into every commit.

---

## 6 · Replacing a value that is not real yet

The site ships with a working phone number, address, inbox, licence number, Yelp rating and three teachers —
**none of them real**. They are sample defaults, plausible on purpose, so the previews and the layouts look
honest and you edit a value instead of inventing one in a blank field.

Because a convincing fake is exactly what a machine cannot spot, every one of them is listed by name in
`content/site.json`, in a block called `provisional` at the very bottom. **The site cannot be launched while
that list has anything in it.** This is the owner's launch homework.

### What is on the list today — 21 entries

| Path in `site.json` | What it is now |
|---|---|
| `brand.url` | `https://greenpastures.example` |
| `brand.name.zh-Hans` · `brand.shortName.zh-Hans` | 优朵幼儿园 · 优朵 — the Chinese name, not confirmed |
| `contact.email` | `hello@greenpasturesdaycare.com` |
| `contact.phone` · `contact.phoneDisplay` | `+15105550142` · `(510) 555-0142` |
| `contact.address.street` · `contact.address.postalCode` | `1234 Sample Way` · `94538` |
| `contact.mapsUrl` | the Google Maps link for that made-up address |
| `email.sendingDomain` · `email.fromAddress` | `mail.greenpasturesdaycare.com` · `no-reply@mail.…` |
| `license` | `000000000` |
| `yelp.rating` · `yelp.reviewCount` · `yelp.url` | `5` · `47` — **numbers, written without quotes** (step 2a) — · a guessed Yelp page |
| `collections.teachers.ping.name` · `collections.teachers.reyes.name` · `collections.teachers.chen.name` | Ms. Ping · Ms. Reyes · Ms. Chen 陈老师 |
| `collections.teachers.ping.credentials` · `collections.teachers.reyes.credentials` · `collections.teachers.chen.credentials` | the three credential lines |

### What the list looks like

Open `content/site.json` and scroll to the bottom. The last block in the file is this — twenty-one lines, each
one the address of a value somewhere above it:

```
  "provisional": [
    "brand.url",
    "brand.name.zh-Hans",
    …
    "collections.teachers.chen.credentials"
  ]
```

**An address is a route through the file.** `license` is the field called `license`. `contact.phoneDisplay` is
the `phoneDisplay` field inside the `contact` block. `brand.name.zh-Hans` is the Simplified entry inside
`brand` → `name`. And the six `collections.teachers.…` lines are the one kind that does *not* point into
`site.json` at all — they point at the teachers' words, which live in a language file (step 2b below).

### The checklist — replacing one, from start to finish

Worked through with the licence number. Every provisional value goes the same way.

1. **Pick one.** Open `content/site.json` on github.com and click the **pencil**. Read the `provisional` list
   at the bottom and choose a line you now know the real answer to — say `"license"`.

2. **Change the value.** Scroll up to the field of that name and type the real one between the quotes:

   ```
   before:   "license": "000000000",
   after:    "license": "412345678",
   ```

   Nothing else on that line changes: the key stays, the quotes stay, the comma at the end stays. The licence
   number is written as text even though it reads as digits — that is what keeps its leading zeros — and
   nineteen of the twenty-one entries work exactly like this.

   **2a. The two exceptions are numbers, and numbers have no quotes.** `yelp.rating` and `yelp.reviewCount`
   are the only entries on the list written as bare digits:

   ```
   before:   "rating": 5,          "reviewCount": 47,
   after:    "rating": 4.8,        "reviewCount": 132,
   ```

   Type the digits and nothing else. The absent quotes are not an oversight for you to correct — adding them
   (`"rating": "4.8"`) turns the number into text, and the check rejects it by name (§10). A rating may carry
   one decimal point and has to be between 0 and 5; a review count is a whole number, so no decimal point and
   no comma inside it — `1234`, never `1,234`. `yelp.url` in the same block is ordinary text and keeps its
   quotes.

   **2b. If the line begins `collections.teachers.`** the value is not in this file.
   `collections.teachers.ping.name` is the `name` field of the `ping` entry in **each language's**
   `collections/teachers.json` — today that is
   `content/en/collections/teachers.json` and `content/zh-Hans/collections/teachers.json`, and
   `content/zh-Hant/…` too once Traditional is switched on. Change the name in every one of them, in the same
   pull request, then come back to `site.json` for step 3.

3. **Delete that line from the `provisional` list.** Scroll back down to the list and remove the whole line,
   comma included:

   ```
   before:       "email.fromAddress",        after:        "email.fromAddress",
                 "license",                                "yelp.rating",
                 "yelp.rating",                            "yelp.reviewCount",
   ```

   Commas are the only punctuation the list cares about: every line ends with one **except the last**, which
   ends with none. So if the line you delete is the last one, take the comma off the line above it.

   *This is the step people forget, and it is the step that decides everything* — the launch gate reads the
   list, not the value. A real licence number whose line is still listed still blocks the launch.

4. **Commit and open the pull request** exactly as in §4 step 3 — plain-words commit message, `Bead:` line in
   the extended description, new branch, **Propose changes**.

5. **Read what the check says.** While anything is left, an ordinary pull request prints a line like

   ```
   provisional values (20 remaining): brand.url · brand.name.zh-Hans · contact.email · …
   ```

   and **passes**. That is not a failure: a shorter list is the progress you just made. Two lines from the same
   check that *are* failures: `provisional path does not resolve: yelp.rating` means a value was deleted while
   its line stayed behind (delete the line too), and `--release: 20 provisional values remain` is the launch
   gate, which is only ever run deliberately (step 7).

6. **Repeat whenever a real value arrives.** There is no deadline before launch and no rush — the site works
   with the samples, it just cannot go live with them.

7. **The end of it.** Before launch the developer runs one command, `pnpm validate:content --release`. It
   fails while a single entry remains and prints the ones left; when the list is empty it prints nothing and
   the site can go live. You never run that command — but emptying the list is the only thing that satisfies
   it, and no software can check that the values you typed are true. That part is yours.

**How to see what is left without opening the file.** Every pull request's check prints the block in step 5,
listing each remaining path with its current value, and the same block appears in the coverage report the
check publishes. Nothing on the live site marks a provisional value — no badge, no warning — so this list is
the only place the truth is written down.

**Two special cases.** *Deleting instead of replacing* — if the daycare has no Yelp page, delete the whole
`yelp` block **and** its three lines from `provisional`; a block that is gone is not provisional. *A sample
that turns out to be right* — the Chinese name, perhaps — delete its line anyway. The list means "not
confirmed yet", and confirming it is the act.

> **Status.** The automatic `content` check is still being wired up (§10). Until it appears on your pull
> requests, the developer reads the `provisional` list by hand before merging and runs the launch gate the
> same way. The steps above do not change; only who notices first.

---

## 7 · Adding or changing a Chinese translation

English is written first, always. Then:

1. The pull request's check publishes a **coverage report** — a to-do list of every key that English has and a
   Chinese file does not, with Simplified and Traditional counted separately. (Until that check is live —
   §10 — ask the developer for the list, or work down the English file yourself: today `zh-Hans` has the home
   page and the navigation and nothing else.)
2. For each missing key, open the file **at the same path** under `content/zh-Hans/` and add the key with the
   Chinese text. Same key, same place in the file, same `{…}`, same tags, same `\n`.
3. Commit to the same branch, `Bead:` line in the extended description. The list shrinks on the next run.

Style: full-width punctuation （，。：）; the agreed rendering for every recurring term — they are all in
[`GLOSSARY.md`](GLOSSARY.md), which is the translator's file to keep as well as to read, so a word you had to
stop and decide about belongs there in the same pull request; and **never commit machine translation nobody
has read.**

**Traditional Chinese (`zh-Hant`) is not switched on yet.** When it arrives it will be created once, by the
developer, by converting the Simplified files character-by-character. That produces files that are *readable*,
not *finished*: the conversion cannot know that a word natural in the mainland reads oddly in Taiwan, and it
does not touch punctuation like 「 」. So the job on those files is a **read-through**, not a re-translation.
Nothing ever re-converts them, so an edit is never overwritten. Until a person has read every file, the
language stays off the site — which blocks nothing else.

---

## 8 · Adding a teacher, a review, a program, a menu week

A collection needs **two edits**: the entry in `site.json` (who exists, in what order, with which photo) and
the words in `collections/<name>.json` **in every language**.

**A new teacher.** In `site.json`, add her to `teachers[]` at the position she should appear:

```json
{ "id": "lopez", "icon": "📚" }
```

Then in `content/en/collections/teachers.json` — and in each Chinese `teachers.json` — add an entry with that
same id. Copy the shape of an existing one; `ping` is the fullest:

```json
"lopez": {
  "name": "Ms. Lopez",
  "credentials": "Early childhood education · 4 years in toddler rooms",
  "summary": "One sentence for the card on a laptop.",
  "summaryShort": "The same, shorter, for a phone.",
  "bio": "Two or three sentences for her page.",
  "tags": ["Toddler room", "English · Español"]
}
```

`name`, `summary`, `bio` and `tags` are required; `credentials`, `summaryShort` and `bioShort` are optional —
add a `Short` one when the full sentence is too long for a phone.

If she has a photograph rather than an emoji, upload it (§11), replace `"icon"` with
`"photo": { "src": "/images/team/lopez.jpg", "width": 800, "height": 800 }` in `site.json`, and add
`"photoAlt"` to her text entry in **every** language — what a screen reader says and what shows if the photo
fails to load. It is required as soon as she has a photo, and the check names her if it is missing. (That is
why `ping`, who has the photograph, carries eight fields, and `reyes` and `chen`, who have emoji, carry six.)

**Removing** a teacher: delete her from `site.json` *and* from every language's `teachers.json`.
**Reordering** them: move the entry in `site.json` only — the text files are looked up by id, not by order.

**A review.** `site.json` → `testimonials[]` gets `{ "id": "…", "rating": 5, "onHome": true, "onMobile": true }`
(`onHome` and `onMobile` decide whether it appears on the home page and on phones), plus an optional
`"sourceUrl"` linking to the review where it was written. Each language's `collections/testimonials.json`
gets `quote`, `author` and `relation` under the same id.

**A program.** `site.json` → `programs[]` carries the id, the age range in months, the teacher-to-child ratio
and the photo; each language's `collections/programs.json` carries `name`, `ageLabel`, `summary`,
`description`, `highlights` and `photoAlt` — every program has a photograph, so `photoAlt` is required —
plus `summaryShort` when the card line is too long for a phone (today only `infant` has one). The age *label*
("6 – 18 months") is words and lives in the language file; the age *numbers* live in `site.json`.

**A menu week.** Fifteen cells in each language's `collections/menu.json` — `week.mon` … `week.fri`, each with
`breakfast`, `lunch` and `snack`. No `site.json` change. The menu on the site is a **rotating sample week**,
not this week's actual food: `menu.json` → `note` says so, "Sample menu — the live menu is posted each
Monday." Refresh it when the kitchen's rotation changes, not weekly, unless you decide otherwise.

**Photo captions.** Each photo id in `site.json` → `gallery.photos[]` has an `alt` sentence in every language's
`collections/gallery.json`, under `photos.<id>`.

**The three teachers who ship with the site are samples**, not real people — so replacing them is an edit here
*and* six deletions from the `provisional` list (§6).

---

## 9 · Changing hours, phone, Yelp, the licence, the inbox

One file, no language: `content/site.json`.

- `hours.open` and `hours.close` are 24-hour times, `"07:30"` and `"18:00"`. The site writes them out properly
  in each language — never type "7:30 am" into a language file. There is **one** opening time and it applies to
  every day in `hours.days`; a Friday-only exception has nowhere to go and is a developer change. Ask, do not
  improvise.
- `contact.phone` (`+15105550142`, the form a phone dials) and `contact.phoneDisplay` (`(510) 555-0142`, what
  the page prints) are a pair. **Both** must change.
- `contact.email`, `contact.address`, `contact.mapsUrl` — the address is split into `street`, `city`, `region`,
  `postalCode`, `country`.
- `email.sendingDomain` and `email.fromAddress` are the address tour-request emails come *from*. It has to be a
  domain the email service has verified, so change these **with the developer**.
- `yelp.rating` and `yelp.reviewCount` are **numbers: they have no quotes, and adding any breaks them.** Type
  the digits alone — `"rating": 4.8` (a decimal point is allowed; it has to be between 0 and 5) and
  `"reviewCount": 132` (a whole number, and no comma inside it). `yelp.url` beside them is text and keeps its
  quotes, and so does `license` — the licence is stored as text precisely so its leading zeros survive. If the
  daycare has no Yelp page at all, the whole `yelp` block can go; see the special cases in §6.

Everything else in this file is text in quotes. Getting that wrong — letters inside a number, or quotes around
one — fails the check, and the message names the field (§10).

Almost every value in this section is also on the provisional list, so most edits here are §6 edits too.

---

## 10 · When a check goes red

Each line names the language it is talking about. The common ones:

| The check says | What it means | What to do |
|---|---|---|
| `missing in zh-Hans: home.hero.subtitle` | English has a key Simplified Chinese does not | add that key to the matching file under `content/zh-Hans/` |
| `missing in zh-Hant: …` | the same key is also absent from Traditional | add it there too — two separate lines, and fixing one does not fix the other |
| `extra key in zh-Hans: home.hero.subtitel` | a typo, or a leftover | fix the spelling to match English, or delete it |
| `empty string: team.footnote` | `""` is never allowed | write the text, or remove the key in **every** language |
| `ICU arguments differ: reviews.countLine — en {count}, zh-Hans none` | a placeholder was dropped | put `{count}` back, exactly |
| `rich tags differ: home.hero.title — en <em>, zh-Hans none` | an `<em>…</em>` was lost | wrap the same words in `<em>…</em>` |
| `invalid JSON: content/zh-Hans/messages/home.json:12` | a quote or a comma is missing near line 12 | compare with the English file; the developer can fix it |
| `yelp.rating: expected number, received string` | quotes were typed around a number, or letters were typed into one | delete the quotes and leave the digits bare — `yelp.rating` and `yelp.reviewCount` are the only two numbers you will ever edit (§6 step 2a, §9) |
| `illegal escape` on a value with `'{` in it | an apostrophe sitting right before a `{` swallows the placeholder | put a space between them, or reword |
| `HTML not allowed in value: …` | a `<br>`, `<b>` or link was typed | delete it — `\n` for a line break, ask for a link |
| `array length differs: philosophy.badges — en 3, zh-Hant 2` | a list gained or lost an item in one language | every language needs the same number of items in the same order |
| `teachers.lopez: required field missing — photoAlt` | a collection entry is short a field | copy an existing entry of the same kind and fill in everything it has |
| `unknown id "lopez" in teachers.json` | the id is not in `site.json` yet | add it to `site.json` → `teachers[]` first (§8) |
| `image not found: public/images/team/lopez.jpg` | the file name is wrong, or the upload is missing | upload it (§11) or fix the name |
| `provisional values (20 remaining): …` | **not an error** — the normal listing of what is still a sample | nothing today; before launch, §6 |
| `provisional path does not resolve: yelp.rating` | a value was deleted and its line is still listed | delete the leftover line — this one *does* fail |
| `--release: 20 provisional values remain` | the launch gate refusing to go live with sample data | §6; nothing launches until this prints nothing |
| `format` | spacing or indentation drifted | nothing for you to do; the developer tidies your branch |

The `static`, `unit`, `build` and `e2e-ok` checks do not fail on text changes. If one does, the developer
looks. The Lighthouse comment is advice, never a blocker.

> **Status.** The `content` check described here is being wired up now. Until it appears on your pull
> requests, the developer runs the same checks by hand before merging — the rules do not change, only who
> notices first.

---

## 11 · Photos

Photographs live in `public/images/`, in the subfolder for their area — `hero/`, `philosophy/`, `team/`,
`gallery/`, `map/`. On github.com: open the folder on your branch → **Add file → Upload files** → drag the
file in → commit to the branch, pasting the `Bead:` line as in §4 step 3, because this is a commit like any
other.

> **Status.** There are no photographs in the repository yet — `public/images/` and its subfolders arrive with
> the first real ones, and the pages show coloured placeholder shapes until then. The developer does the first
> upload; after that the folders are there and the steps above work.

Then point at it in `site.json` with its pixel `width` and `height`, and write its `alt` sentence in every
language.

Sizes that keep the pages fast — the site resizes them per device, so bigger is not better:

| | Longest edge | Format | Size |
|---|---|---|---|
| Hero and philosophy photos | ≤ 1,600 px | JPEG or WebP | ≤ 400 KB |
| Gallery photos | ≤ 1,200 px | JPEG or WebP | ≤ 400 KB |
| Teacher portraits | 800 × 800 | JPEG or WebP | ≤ 400 KB |

File names in lowercase with hyphens. To replace a photo, upload a new one under the same name.

---

## 12 · What not to touch

Everything outside `content/` and `public/images/`. Concretely: anything under `src/`, `docs/`, `.github/`,
`.beads/`, `package.json`, `pnpm-lock.yaml`, `next.config.ts`.

And inside `site.json`, four blocks are **structure, not facts** — they decide what pages exist and how the
site is put together:

- `routes` and `nav` — the pages and the navigation
- `menu.days` and `menu.meals` — that a week has Monday to Friday and three meals
- `ages` — the age bounds the programs are computed from
- `timeZone`

Also: **never rename a key** (the part left of the colon). And **never add a `_comment` key** to any JSON file
— see rule 7.

If a change seems to need one of these, it is a developer change. Ask.

*(If you are browsing the repository on your own computer you may see files ending `.d.json.ts` beside each
JSON file. They are generated automatically, they are not part of the repository, and they are not yours.)*

---

## 13 · Where to ask

- **On the pull request itself.** Comments on a pull request are the conversation, and they stay attached to
  the change forever. This is the best place for "does this read right?"
- **The developer**, for anything that is not a word or a fact — and always before changing the sending
  domain, the hours structure, or anything in §12.
- Every version of every word is kept. Nothing you edit is ever lost, and any change can be undone.

---

## Appendix — for the developer

Maintain this file with the tree. It is the reader's only document: if a path here stops existing, or the
`Bead:` id in §5 lands, this file is part of that change, not a follow-up.

**Sources.** `docs/technical/09-deployment-operations.md` §4 is the specification for this guide (§4.2 fixes
its contents and order); `docs/technical/02-i18n-content-contract.md` is the binding content contract —
`D-02.18` (one entry point), `D-02.13` (`Short` pairs), `D-02.19` (brand names as a localized value),
`D-02.20` / `INV-02.10` (provisional values), `D-02.21` (`zh-Hant` seeding). `D-09.11` owns the `Bead:` line,
`D-09.13` the menu cadence, and 09 §4.10 owns [`GLOSSARY.md`](GLOSSARY.md), which this file links from §7 and
from the top; the two are maintained together, since the glossary explains the vocabulary this guide uses.

**Two places this guide follows the code rather than 09 §4.6.** That section calls all eight teacher fields
required and says `photoAlt` is required even for a teacher with an emoji; the schema the check will actually
run (`src/content/schemas/teachers.ts`, and 02's field list) makes `credentials`, `summaryShort`, `bioShort`
and `photoAlt` optional, with `photoAlt` required only for a teacher who has a photograph
(`requirePhotoAlt`, `INV-02.3`) — and the shipped tree agrees: `ping` has eight fields, `reyes` and `chen`
six. §8 documents what the check enforces. The same for `programs`: `summaryShort` is optional there too and
only `infant` carries one today. If 09 §4.6 is meant literally, the tree and the schema are what must change,
and this guide follows.

**Still to fill in here.** The standing content-edits bead id in §5 (`OQ-09.5`), which is the one placeholder
in this guide that will fail a check if pasted as written.

**Operations appendix** — keep these three lines current, they live nowhere else:

| | |
|---|---|
| Secret rotation log | not yet started — first entry is due with the first production key (09 §2) |
| Last dependency review | not yet — Renovate opens a grouped PR weekly; the developer merges and re-runs Lighthouse quarterly (09 §5) |
| Uptime check | not yet created — an external HTTPS probe every 5 minutes against `/en`, alerting the developer (09 §5.1 item 17) |
