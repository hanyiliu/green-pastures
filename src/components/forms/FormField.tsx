"use client";

import { useId, type ReactNode } from "react";

/**
 * One labelled control, its optional help text and its optional error text
 * (04 §3.5).
 *
 * **`control` is a render prop, not a node.** 07 §1's accessibility contract
 * ties four attributes to ids this component owns — `htmlFor`/`id`,
 * `aria-describedby`, `aria-invalid` and `aria-required` — and a caller that
 * received the ids as strings and had to remember to spread them would
 * eventually not. Handing the control the props it must wear makes the contract
 * structural: {@link FormField} generates the ids, decides which describers
 * exist, and the caller can only render a control that already carries them.
 *
 * **The ids are `useId()`-scoped**, so the same form can be mounted twice on one
 * page — the home Visit section and the Enrollment page share one component
 * (07 `D-07.2`) — without two `parentName` labels pointing at one input.
 *
 * **The required marker is a glyph, and the sentence that explains it is a
 * key.** 07 §1 asks for "a visible marker whose text is a JSON key"; 02 ships
 * `visit.form.requiredLegend` ("* required") and no per-field marker string, so
 * the legend carries the words once at the top of the form and each required
 * field carries the `*` the legend names. The glyph is `aria-hidden`: the
 * control's own `required`/`aria-required` is what a screen reader announces,
 * and reading "star" before every label would be noise.
 */

/** The props {@link FormField} hands the control it wraps. */
export type FieldControlProps = {
  readonly id: string;
  readonly name: string;
  readonly required: boolean;
  readonly "aria-required": boolean;
  readonly "aria-invalid": boolean;
  /** The error and help elements that exist, or `undefined` when neither does. */
  readonly "aria-describedby": string | undefined;
};

export type FormFieldProps = {
  readonly name: string;
  readonly label: ReactNode;
  readonly control: (props: FieldControlProps) => ReactNode;
  /** The resolved error copy. Its presence is what sets `aria-invalid`. */
  readonly error?: ReactNode;
  readonly help?: ReactNode;
  readonly required?: boolean;
};

/** Nunito 700, `--text-form-label`, `--color-body` — design L317 / mobile L228. */
const LABEL_CLASS = "font-body text-form-label font-bold text-body";

/**
 * The error sits at the label's size so the field's box does not jump between
 * states, and takes its colour from `--color-yelp` — the only red 03 mints.
 * It is never colour-only: the text itself says what is wrong, and the control
 * carries `aria-invalid`.
 */
const ERROR_CLASS = "font-body text-form-label font-bold text-yelp";

const HELP_CLASS = "font-body text-form-label text-muted";

/** 6px between label and control on desktop, 5px on mobile (design L317 / L228). */
const FIELD_CLASS = "flex min-w-0 flex-col gap-1.25 md:gap-1.5";

export function FormField({ name, label, control, error, help, required = false }: FormFieldProps) {
  const scope = useId();
  const controlId = `${scope}-${name}`;
  const errorId = `${controlId}-error`;
  const helpId = `${controlId}-help`;

  const describedBy = [
    help === undefined ? undefined : helpId,
    error === undefined ? undefined : errorId,
  ]
    .filter((id) => id !== undefined)
    .join(" ");

  return (
    <div className={FIELD_CLASS}>
      <label htmlFor={controlId} className={LABEL_CLASS}>
        {label}
        {required ? (
          <span aria-hidden="true" className="ms-0.5">
            *
          </span>
        ) : null}
      </label>
      {control({
        id: controlId,
        name,
        required,
        "aria-required": required,
        "aria-invalid": error !== undefined,
        "aria-describedby": describedBy.length === 0 ? undefined : describedBy,
      })}
      {help === undefined ? null : (
        <p id={helpId} className={HELP_CLASS}>
          {help}
        </p>
      )}
      {error === undefined ? null : (
        <p id={errorId} className={ERROR_CLASS}>
          {error}
        </p>
      )}
    </div>
  );
}
