/**
 * The Philosophy section's public surface (04 §2: "one folder per section").
 *
 * `page.tsx` composes eight sections and takes one line from each, so the
 * section is the folder's default export as well as its named one — the named
 * export is what the unit tests and any future caller import by name.
 */
export { PhilosophySection, default } from "./PhilosophySection";
