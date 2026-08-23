# Words we keep the same

Two kinds of word cause trouble on a bilingual site: the words this repository uses for its own parts (*key*,
*locale*, *provisional*), and the words the daycare uses about itself (*Montessori*, *Toddler*, *Book a
tour*). This file fixes both, once, so that everyone writes them the same way in every file.

- **Part 1** explains the repository's own vocabulary — every word you will meet while editing, in a sentence
  you can act on.
- **Part 2** is the term list: each fixed term with its English, Simplified Chinese and Traditional Chinese
  rendering.

The translator owns this file and the developer reviews it. Editing it is an ordinary content change:
the pencil on github.com, the `Bead:` line, a pull request — exactly the steps in
[`README.md`](README.md) §4, which is the guide this file sits beside.

---

## Part 1 · The words this repository uses

| The word | What it means, and what to do with it |
|---|---|
| **locale** | A language, and the folder that holds it: `en`, `zh-Hans`, `zh-Hant`. "Add it in the other locale" means "open the file with the same name in the other folder". The folder names are spelled exactly like that, capital letters included. |
| **`en` / `zh-Hans` / `zh-Hant`** | English · Simplified Chinese · Traditional Chinese. `en` and `zh-Hans` are on the site; `zh-Hant` is not switched on yet. |
| **reference locale** | `en`. A sentence exists in English first, then in Chinese. The check compares each Chinese file against English, never one Chinese against the other. |
| **file** (a developer may say *namespace*) | One JSON file per screen or area, under `messages/`. The file name is the front of every key's address: `home.hero.title` lives in `messages/home.json`, under `hero`, at `title`. |
| **key** | The name to the left of the colon. The site looks the sentence up by that name, so renaming a key makes the text disappear. Never rename one. |
| **value** | What sits to the right of the colon, and the only part you change. In a language file it is always text between quotes. In `site.json` two facts are **numbers instead** — `yelp.rating` and `yelp.reviewCount` — and a number is written bare, with no quotes at all; adding quotes to one turns it into text and the check rejects it. |
| **key path** (*dotted path*) | A route through a file, block by block: `contact.phoneDisplay` is the `phoneDisplay` field inside the `contact` block; `brand.name.zh-Hans` is the Simplified entry inside `brand` → `name`. |
| **collection** | A repeatable thing — a teacher, a program, a review, a photo, a menu day. Every collection lives in two halves: the facts in `site.json`, the words in `collections/<name>.json` in *each* language. |
| **id** | The short name that ties the two halves together: `ping`, `infant`, `meiL`, `g01`. Ids are never translated and never shown to a visitor. |
| **entry** | One id's block inside a collection file — everything the site knows about that one teacher, in that one language. |
| **`Short` twin** | A key whose name ends in `Short` is the phone wording of the key beside it (`summary` / `summaryShort`). Both exist; the site picks one by screen width. Change one without the other and half your visitors keep reading the old sentence. |
| **placeholder** `{…}` | A slot the site fills in: `{brandName}`, `{count, number}`, `{weekday}`. Copy it across exactly, commas and all; move it in the sentence if the grammar needs it elsewhere; never translate what is inside it. |
| **plural block** | `{count, plural, one {review} other {reviews}}` picks the English word by the number. Chinese has one form for both, so the Chinese sentence just writes the noun with its measure word: English `<count>{count, number}</count> {count, plural, one {review} other {reviews}} · Fremont parents` becomes `<count>{count, number}</count> 条评价 · 弗里蒙特家长`. Dropping the plural block in Chinese is correct, not a mistake. |
| **rich-text tag** | `<em>`, `<count>`, `<day>` — not HTML. Each marks a role the design paints: `<em>` is the hand-drawn sage underline, `<count>` is the number that counts up, `<day>` is the bold weekday. Keep the tags English has, around the words that carry the same emphasis. Never invent a new one. |
| **`\n`** | A line break inside a value — a backslash and an `n`, two characters. Keep it, or move it to where the Chinese line should break; never press Enter inside the quotes. |
| **`⟦…⟧`** | Brackets around a key name on the preview (`⟦home.hero.title⟧`) mean that key is missing from *every* language. Usually a spelling slip in a key you just added. |
| **fallback** | An English sentence sitting on a Chinese page. It means that language is missing that key and the site showed English rather than a blank. Add the key. |
| **fact vs. word** | Numbers, times, phone numbers, links, file names and the order of things are **facts** and live once in `site.json`, with no language. Anything a visitor reads as a sentence is a **word** and lives in a language folder. The check refuses the opposite. |
| **localized value** | The one fact that genuinely differs by language — the daycare's name. It stays a single field in `site.json` with one entry per language, rather than being copied into three language files. See Part 2. |
| **provisional value** (*sample default*) | A made-up but believable value the site ships with — the phone number, the licence number, the three teachers — so that previews look honest. Every one is listed by path in `site.json` → `provisional`, and **the site cannot go live while that list has anything in it**. Replacing one: [`README.md`](README.md) §6. |
| **the launch gate** (`validate:content --release`) | A command the *developer* runs before launch. It fails while `provisional` still has entries and prints every path left. Never yours to run — but it is the reason step 3 of the checklist matters. |
| **the `content` check** | The automatic reader on your pull request: it compares the languages, prints one line per problem and one for every value still provisional. The lines are translated into plain English in [`README.md`](README.md) §10, which also records that this check is still being wired up — until it is, the developer does the same reading by hand. |
| **coverage report** (*parity*) | The check's to-do list: every key English has that a Chinese file does not, counted separately for Simplified and Traditional. One English sentence therefore makes two lines on the list, not one. |
| **`--warn-locale`** | A switch the developer sets while a language is still being filled in; it demotes that language's missing keys to warnings. Nothing for you to do, and it is ignored at launch — the language either gets finished or gets switched off. |
| **seed** (Traditional Chinese) | `zh-Hant` is created once by converting the Simplified files character by character. The result is *readable*, not *finished*, so the job on those files is a **read-through** — reading and correcting — not a re-translation. Nothing ever re-converts them, so your edits are never overwritten. |
| **full-width punctuation** | Chinese values use `，。：、（）` and not `, . : ( )`. The commas and colons that hold the JSON together — outside the quotes — stay ordinary. |
| **rotating sample week** (the menu) | The week of meals in the repository is a sample that repeats, not this week's food: `messages/menu.json` → `note` says the live menu is posted each Monday, at the daycare. Refresh it when the kitchen's rotation changes, not every week. |
| **`Bead:` line** | The single line at the end of every commit and every pull request saying which piece of work it belongs to. One standing line covers all content edits — [`README.md`](README.md) §5. |
| **pull request** | Your change, proposed rather than applied: it gets a private preview link, the checks read it, someone approves it, and only then does it reach the public site. |
| **`.d.json.ts`** | Files with this ending sit beside each JSON file on a developer's computer. They are generated, they are not in the repository, and they are not yours. |

---

## Part 2 · Fixed terms, in three languages

**How to read the table.** *In the tree* means the rendering is already written in the files, at the path
given — use it, do not invent a second one. *Proposed* means nothing is written yet: the first person who
needs the term should use the proposal, or change it here in the same pull request and then use what they
wrote. Either way the decision is made once, in this file.

**The Traditional column is a glyph conversion, not yet a reading.** Nothing under `content/zh-Hant/` exists
yet. Every Traditional cell below is the character-by-character conversion of the Simplified one, offered so
that the reviewer has something to correct rather than a blank page. Part 3 lists what a glyph conversion
cannot decide.

### 2.1 The daycare's name — data, not a term

The name is the one thing in this file you do **not** type into a sentence. It lives once, in
`content/site.json`:

| Field | `en` | `zh-Hans` | `zh-Hant` |
|---|---|---|---|
| `brand.name` | Green Pastures Montessori Daycare | 优朵幼儿园 | 優朵幼兒園 — *not in the file yet; it is added when `zh-Hant` is switched on* |
| `brand.shortName` | Green Pastures | 优朵 | 優朵 — *same* |

Three things follow, and they are why the name is here at all:

1. **Copy never contains the name.** Sentences carry `{brandName}` or `{brandShortName}`, and the site fills
   in the right language — which is why the gallery title is `{brandShortName}的日常` and not the name spelled
   out. The check hunts for the name inside language files and rejects it.
2. **绿茵园 is not the name.** It was the prototype's placeholder and was rejected. It must not reappear
   anywhere in copy.
3. **The Chinese name is provisional.** `brand.name.zh-Hans` and `brand.shortName.zh-Hans` are both on the
   `provisional` list: they are a proposal, not a decision. Confirming or changing them is one edit in
   `site.json` plus deleting their two lines ([`README.md`](README.md) §6) — and nothing else in the
   repository has to change.

### 2.2 Navigation and buttons

| English | `zh-Hans` | `zh-Hant` (seed) | Status |
|---|---|---|---|
| Philosophy | 教学理念 | 教學理念 | in the tree — `zh-Hans/messages/common.json` → `nav.philosophy` |
| Programs | 课程班级 | 課程班級 | in the tree — `nav.programs` |
| Menu | 餐点 | 餐點 | in the tree — `nav.menu` |
| Gallery | 相册 | 相冊 | in the tree — `nav.gallery` |
| Reviews | 家长评价 | 家長評價 | in the tree — `nav.reviews` |
| Our Team | 我们的团队 | 我們的團隊 | in the tree — `nav.team` |
| Book a tour | 预约参观 | 預約參觀 | in the tree — `nav.bookTour`, and `home.json` → `hero.ctaPrimary` |
| Request a tour *(the form's own button)* | 申请参观 | 申請參觀 | in the tree — `visit.json` → `form.submit`. Deliberately different from "Book a tour": that one takes you to the form, this one sends it. |
| Contact *(footer link)* | 联系我们 | 聯繫我們 · 聯絡我們 | proposed — `common.json` → `nav.contact` has no Chinese yet. Traditional: Taiwan prefers 聯絡. |

### 2.3 The words that head a section

| English | `zh-Hans` | `zh-Hant` (seed) | Status |
|---|---|---|---|
| Our philosophy | 我们的理念 | 我們的理念 | in the tree — `zh-Hans/messages/home.json` → `philosophy.eyebrow` |
| Programs & ages | 课程与年龄 | 課程與年齡 | in the tree — `programs.eyebrow` |
| A week of meals | 一周餐点 | 一週餐點 · 一周餐點 | in the tree (Simplified) — `menu.eyebrow`. Traditional: see Part 3 on 周 / 週. |
| Our photo wall | 我们的照片墙 | 我們的照片牆 | in the tree — `gallery.eyebrow` |
| Who we are | 我们是谁 | 我們是誰 | in the tree — `teachers.eyebrow` |

### 2.4 The programs

The program names are the labels on the three cards, and they are also the words parents will use on the
phone. Nothing is written in Chinese yet — `zh-Hans/collections/programs.json` is still empty — so these are
proposals for whoever fills it in.

| English | `zh-Hans` | `zh-Hant` (seed) | Status |
|---|---|---|---|
| Infant (6 – 18 months) | 婴儿班 | 嬰兒班 | proposed |
| Toddler (1.5 – 3 years) | 幼儿班 | 幼兒班 | proposed |
| Preschool (3 – 4½ years) | 学前班 | 學前班 | proposed |
| room *(as in "toddler room")* | 班级 | 班級 | proposed — English says *room*, Chinese counts classes, not rooms |
| stepping stone *(the home page's "three little stepping-stones")* | 成长的小台阶 | 成長的小台階 | proposed — a picture, not a term: render the idea, keep it short |

Ages are written differently and are not a straight conversion: English "6 – 18 months" and "4½ years"
become 6–18个月 and 4岁半 (in the tree already, at `home.json` → `hero.subtitle`: 6个月到4岁半). The age
*label* is words and lives in the language file; the age *numbers* live in `site.json`.

### 2.5 Montessori vocabulary

| English | `zh-Hans` | `zh-Hant` (seed) | Status |
|---|---|---|---|
| Montessori | 蒙特梭利 | 蒙特梭利 | in the tree — `home.json` → `hero.badge` |
| Montessori daycare | 蒙特梭利日托 | 蒙特梭利日托 | in the tree — `hero.badge` |
| certified Montessori teachers | 认证蒙特梭利老师 | 認證蒙特梭利老師 | in the tree — `hero.subtitle` |
| follow the child('s pace) | 跟随孩子的节奏 | 跟隨孩子的節奏 | in the tree — `philosophy.quote` |
| practical life | 日常生活练习 | 日常生活練習 | proposed |
| prepared environment | 有准备的环境 | 有準備的環境 | proposed |
| head teacher | 主班老师 | 主班老師 | proposed — one teacher carries this badge |
| assistant teacher | 助教老师 | 助教老師 | proposed |
| kindergarten-ready | 幼小衔接 | 幼小銜接 | proposed, and a **trap**: American "kindergarten" is the first year of school at about five, not 幼儿园, which is what this daycare itself is. Never translate it as 幼儿园. |

### 2.6 Meals, places, and the everyday words

| English | `zh-Hans` | `zh-Hant` (seed) | Status |
|---|---|---|---|
| breakfast · lunch · snack | 早餐 · 午餐 · 点心 | 早餐 · 午餐 · 點心 | in the tree — `home.json` → `menu.title` |
| bilingual (home) | 双语（之家） | 雙語（之家） | in the tree — `hero.subtitle` |
| Fremont, CA | 加州弗里蒙特 | 加州弗里蒙特 | in the tree — `hero.badge` |
| Fremont parents | 弗里蒙特家长 | 弗里蒙特家長 | in the tree — `home.json` → `testimonials.countLine` |
| reviews *(as counted: "47 reviews")* | 条评价 | 條評價 | in the tree — `testimonials.countLine` |
| tour | 参观 | 參觀 | in the tree — see 2.2 |
| Vegetarian options daily *(dietary chip)* | 每日素食选择 | 每日素食選擇 | proposed — `collections/menu.json` → `dietary.vegetarian` |
| Allergy-aware kitchen *(dietary chip)* | 关注过敏的厨房 | 關注過敏的廚房 | proposed — `dietary.allergy` |
| Familiar flavors from home *(dietary chip)* | 熟悉的家常味道 | 熟悉的家常味道 | proposed — `dietary.flavors`. The emoji at the front of each chip is part of the value: keep it. |

### 2.7 Words that stay in Latin script

**AMS** (the credential — write "AMS 认证", never spell the acronym out in Chinese), **Yelp** (already in the
tree: 在 Yelp 阅读全部评价), **Google Maps**, and **CA** inside a postal address. Leave a space either side of
a Latin word inside a Chinese sentence.

One label that looks like a term but is not yours: the language switch shows **EN · 简 · 繁** and the names
简体中文 / 繁體中文, and those live in the site's code (`src/i18n/routing.ts`), not in `content/`. If one of
them is wrong, ask the developer.

---

## Part 3 · Traditional Chinese: what a glyph conversion cannot decide

The Traditional column above is a mechanical conversion. Four kinds of thing it gets wrong, for the reviewer
to watch for:

1. **Quotation marks.** Simplified writes “ ” — Traditional usually writes 「 」. These are content, not code:
   they live in each language's `common.json` → `punctuation.quoteOpen` / `quoteClose`, so the fix is one edit
   in that file, not a hunt through the quotes.
2. **Characters with a choice behind them.** 周 (week) may be 週 in Traditional; 里 may be 裡 or 裏. A
   converter picks one; a reader picks the right one.
3. **Words, not just letters.** The conversion changes glyphs only, deliberately, so a word that is natural in
   the mainland stays as it is even when the region says something else. 幼儿园 converts to 幼兒園, which is
   right for Taiwan and reads oddly in Hong Kong, where it is 幼稚園.
4. **Which region.** Taiwan and Hong Kong differ in vocabulary and in punctuation habits, and nobody has
   decided which one this site speaks yet (`OQ-02.8` in the plan). Until someone does, the read-through
   should record its choices here rather than only in the files.

---

## Part 4 · Adding or changing a term

**Adding one.** If you had to stop and decide how to say something, it belongs here. Add the row in the same
pull request as the sentence that made you decide, so the two never disagree.

**Changing an agreed one.** Change the row *and* every value that uses the old wording, in the same pull
request — the check compares languages against each other, not against this file, so nothing will catch a
half-finished rename. Say in the pull request which term changed and why.

**Disagreeing with one.** A rendering marked *proposed* is nobody's decision yet: overwrite it. One marked *in
the tree* is already on the site, so changing it is the paragraph above.

---

## Appendix — for the developer

This file is specified by `docs/technical/09-deployment-operations.md` §4.10, with §4.5 (translator's path)
and `D-09.12` (the three-locale workflow) behind it; `D-02.19` makes the brand name data rather than a
glossary entry, which is why §2.1 states the rule instead of asking anyone to copy the name; `D-09.13` is the
rotating sample week recorded in Part 1.

Every *in the tree* citation resolves against `content/zh-Hans/**` as it stands today; the Simplified renderings
come from the design's `I18N` table in `docs/design/desktop/Green Pastures - Homepage.dc.html`, which is where
the seeded copy came from. Two things to revisit:

- **When `zh-Hant` is seeded and reviewed** (`PR-8.8`): the Traditional column stops being a seed. Mark the
  rows the reviewer confirmed, and add `brand.name["zh-Hant"]` / `brand.shortName["zh-Hant"]` to §2.1 once
  they are in `site.json` (`PR-8.2`).
- **When the Chinese collections are written** (`PR-8.1`): §2.4's program names and §2.6's dietary chips move
  from *proposed* to *in the tree*, with their paths.
