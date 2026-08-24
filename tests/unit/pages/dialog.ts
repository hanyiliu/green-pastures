/**
 * The `<dialog>` methods jsdom 30 does not implement (08 §4).
 *
 * jsdom parses `<dialog>` and reflects its `open` attribute, and stops there:
 * `showModal()`, `show()` and `close()` are all absent, so a component that
 * asks the platform for a modal throws on mount. This installs the three, with
 * the parts of the specification the lightbox's contract depends on — `open`
 * flips, `close()` is idempotent, and closing fires a `close` event — and none
 * of the parts it does not.
 *
 * **What it deliberately does not fake.** No top layer, no `::backdrop`, no
 * inertness, no focus trap and no `Escape` handling. Those are exactly what
 * `D-04.7` chose a native `<dialog>` *for*, so faking them would turn "the
 * browser does this" into "this stub does this" and assert nothing. A test that
 * needs them belongs in 08's e2e matrix; here `close()` stands in for whatever
 * route the reader took out of the dialog, which is the same event the real one
 * dispatches for all three.
 *
 * Install once per file, in `beforeAll`. Not a `*.test.ts` file, so Vitest's
 * `include` never collects it.
 */
export function installDialogStub(): void {
  const proto = HTMLDialogElement.prototype;
  if (typeof proto.showModal === "function") return;

  proto.show = function show(this: HTMLDialogElement) {
    this.open = true;
  };

  proto.showModal = function showModal(this: HTMLDialogElement) {
    if (this.open) throw new Error("showModal() on an already-open dialog");
    this.open = true;
  };

  proto.close = function close(this: HTMLDialogElement, returnValue?: string) {
    if (!this.open) return;
    this.open = false;
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.dispatchEvent(new Event("close"));
  };
}
