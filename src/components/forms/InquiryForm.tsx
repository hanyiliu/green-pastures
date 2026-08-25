"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent as ReactChangeEvent,
  type FormEvent as ReactFormEvent,
  type ReactNode,
} from "react";

import { flushSync } from "react-dom";

import { track } from "@/components/layout/TrackedLink";
import { buttonRecipe } from "@/components/ui/Button";
import { withOverrides } from "@/components/ui/class-names";
import { Link } from "@/i18n/navigation";
import { childAgeOptionKey, desiredStartOptionKey } from "@/lib/inquiry/labels";
import { DESIRED_START_KEYWORDS, monthOptionIds } from "@/lib/inquiry/months";
import {
  CHILD_AGE_IDS,
  EMAIL_MAX_LENGTH,
  HONEYPOT_FIELD,
  INQUIRY_FORM_FIELDS,
  MESSAGE_MAX_LENGTH,
  NAME_MAX_LENGTH,
  parseInquiry,
  TURNSTILE_TOKEN_FIELD,
  type InquirySource,
} from "@/lib/inquiry/schema";

import { FormAlert } from "./FormAlert";
import { FormField, type FieldControlProps } from "./FormField";
import {
  inquiryErrorKey,
  UNKNOWN_ERROR_KEY,
  type InquiryErrorKey,
  type InquiryFieldCode,
  type InquiryFormCode,
  type InquiryFormFieldName,
  type InquiryResponseBody,
} from "./inquiry-codes";
import type { InquiryContact } from "./NoscriptFallback";
import { SuccessPanel } from "./SuccessPanel";
import { Turnstile, type TurnstileHandle } from "./Turnstile";

/**
 * The one form on the site (07 §1, `D-07.4`; 04 §3.5).
 *
 * It is the only interactive thing on the page a parent can get wrong, so the
 * decisions below are all about what happens when they do.
 *
 * **One schema, no second rule set** (`D-07.3`). Client validation is
 * `parseInquiry` from `src/lib/inquiry/schema.ts` — the same module the handler
 * re-parses every request with — filtered to the five controls the design
 * draws. There is no client-side copy of "at least two characters" anywhere,
 * which is why the two halves cannot drift and why the inline errors and the
 * server's 400 speak the same fourteen codes (INV-07.2).
 *
 * **The submit button is never `disabled`.** `D-07.4` is explicit and the
 * reason is worth restating: a `disabled` button drops out of the tab order and
 * off the accessibility tree, so the moment a submission starts, a screen
 * reader user loses the element they just activated and has nothing to return
 * to when it fails. It stays enabled, gains `aria-busy` and `aria-disabled`,
 * swaps its label to the pending copy, and a duplicate click is refused by the
 * handler instead — {@link busyRef}, which a click cannot outrun the way it can
 * outrun a state update.
 *
 * **Focus is moved twice, and only twice.** On a failed submit it goes to the
 * first invalid control, in the order the design draws them; on success it goes
 * to the heading of the panel that replaced the form. Neither happens on blur,
 * and neither happens on arrival — 07 §6 forbids auto-focusing the first input
 * when the `#visit` anchor lands, because a mobile keyboard opening uninvited
 * is worse than one tap.
 *
 * **Native validation is handed over, not removed.** The server-rendered form
 * carries `required`, `type="email"` and `maxlength` and no `noValidate`, so it
 * validates without JavaScript (`D-07.5`). The mount effect sets `noValidate`,
 * which is the moment this component takes the job over — the attribute is
 * absent in the server HTML and present only once there is JavaScript to
 * replace it with.
 *
 * **No toasts, no form library, no `autoFocus`** (`D-07.4`, 04 §3.5): every
 * outcome renders inline — the success panel in the card, the error banner
 * above the submit.
 */

/* -------------------------------------------------------------------------- *
 * Contract
 * -------------------------------------------------------------------------- */

export type InquiryFormProps = {
  /** Which placement submitted — `home` here, `enroll` on the subpage. */
  readonly source: InquirySource;
  /** From `site.contact`; printed in the two failure states that offer it. */
  readonly contact: InquiryContact;
  /** `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, read by the server component above. */
  readonly turnstileSiteKey: string;
  /**
   * Where the privacy line's link goes — `site.routes[privacy].path`, resolved
   * by the server component above (07 §4, 10 PR-6.9).
   *
   * A prop rather than a `getSite()` call, for the reason every other piece of
   * `content/` reaches this component as one (04 `D-04.2`): this is a client
   * component, and the slug is one string, not a reason to send `site.json`
   * across the boundary. INV-06.1 is satisfied either way — the literal is
   * never typed, it is looked up in `content/site.json`.
   */
  readonly privacyHref: string;
  /** The server-rendered `<NoscriptFallback>`, passed as a node (04 §3.5). */
  readonly noscript: ReactNode;
  /** Extra classes; an override of a property the recipe sets must be important. */
  readonly className?: string;
};

export type { InquiryContact };

/* -------------------------------------------------------------------------- *
 * Constants
 * -------------------------------------------------------------------------- */

/** Fixed and unlocalised, so the WAF rule and the logs can target it (`D-07.1`). */
const INQUIRY_ENDPOINT = "/api/inquiry";

const CONTENT_TYPE_JSON = "application/json";

/** 07 §1's table: the client aborts a submission after fifteen seconds. */
const SUBMIT_TIMEOUT_MS = 15_000;

/**
 * The bounded wait 07 §1 asks for when submit arrives before Turnstile has a
 * token. Comfortably inside {@link SUBMIT_TIMEOUT_MS}, so a challenge that never
 * resolves still leaves time to say so rather than timing out twice.
 */
const TOKEN_WAIT_MS = 12_000;

/**
 * The statuses the *platform* answers with, where no JSON code arrives.
 *
 * The 429 is the row that makes this table necessary: the Vercel WAF rule
 * returns its own body before the function runs (07 §3), so there is no
 * `{ code }` to read and the client has to know that 429 means `rate_limited`.
 * The rest are the handler's own statuses, mapped here as a fallback for a body
 * that failed to parse.
 */
const CODE_BY_STATUS: Readonly<Record<number, InquiryFormCode>> = {
  403: "forbidden",
  405: "forbidden",
  413: "payload_too_large",
  415: "forbidden",
  429: "rate_limited",
  502: "email_failed",
  503: "turnstile_unavailable",
};

/** 02's catch-all row — a status and a body that name no code we know. */
const UNKNOWN_CODE = "unknown";

/** The two outcomes 07 §1 marks "direct-contact fallback shown". */
const CONTACT_CODES: readonly InquiryFormCode[] = ["turnstile_unavailable", "email_failed"];

/**
 * `D-07.5`: without JavaScript the submit button is replaced by the fallback.
 * Written into the `noscript` element rather than nested as a `<style>` child
 * for the reason `MotionProvider` records — a scripting-enabled browser parses
 * `noscript` content as raw text, so real children would not survive hydration.
 */
const NOSCRIPT_HIDE_SUBMIT = "<style>[data-inquiry-submit]{display:none}</style>";

/* -------------------------------------------------------------------------- *
 * Values
 * -------------------------------------------------------------------------- */

type FieldValues = Readonly<Record<InquiryFormFieldName, string>>;
type FieldErrors = Readonly<Partial<Record<InquiryFormFieldName, InquiryFieldCode>>>;
type Touched = Readonly<Partial<Record<InquiryFormFieldName, true>>>;

const EMPTY_VALUES: FieldValues = {
  parentName: "",
  email: "",
  childAge: "",
  desiredStart: "",
  message: "",
};

const ALL_TOUCHED: Touched = Object.fromEntries(INQUIRY_FORM_FIELDS.map((name) => [name, true]));

/** The two announcements the polite live region ever makes. */
type Announcement = "status.submitting" | "status.error.title";

/**
 * A UUID v4 per form instance (07 §1's technical fields), regenerated only
 * after success so an identical retry collapses on Resend's idempotency key.
 *
 * `crypto.randomUUID` needs a secure context; the fallback keeps the field
 * well-formed on a plain-http preview rather than sending a value the schema
 * would reject.
 */
function randomUuid(): string {
  const api = globalThis.crypto;
  if (typeof api?.randomUUID === "function") return api.randomUUID();

  const bytes = new Uint8Array(16);
  if (typeof api?.getRandomValues === "function") api.getRandomValues(bytes);
  else
    for (let index = 0; index < bytes.length; index += 1)
      bytes[index] = Math.floor(Math.random() * 256);

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Noon UTC on the 15th — far enough from either edge that no zone shifts it. */
function monthDate(monthId: string): Date {
  return new Date(Date.UTC(Number(monthId.slice(0, 4)), Number(monthId.slice(5, 7)) - 1, 15, 12));
}

/* -------------------------------------------------------------------------- *
 * Classes (design: desktop L316–L325, mobile L227–L235)
 * -------------------------------------------------------------------------- */

/**
 * The white card is the Visit section's, not this component's (07 `D-07.4`:
 * the success panel replaces the form "inside the same card"), so the root here
 * is only the shell that swaps one for the other.
 */
const ROOT_CLASS = "flex w-full min-w-0 flex-col";

const FORM_CLASS = "flex w-full min-w-0 flex-col gap-3 md:gap-3.5";
const ROW_CLASS = "grid gap-2.5 md:gap-3";
const PAIR_CLASS = "grid grid-cols-2 gap-2.5 md:gap-3";
const LEGEND_CLASS = "font-body text-form-label text-muted";
const PRIVACY_CLASS = "font-body text-form-label text-muted";

/**
 * The privacy line's link to `/privacy` (07 §4: "this doc only needs a link
 * target for the notice"; 10 PR-6.9).
 *
 * `--color-form-link` and an underline, the same pair `FormAlert` and
 * `NoscriptFallback` already use for a link inside this white card and for the
 * contrast reason they record — sage on white measures 3.83:1 and this line is
 * 11px, which AA reads at the 4.5:1 threshold.
 */
const PRIVACY_LINK_CLASS = "font-bold text-form-link underline";

/**
 * 44px desktop / 46px mobile, radius 11, cream fill, one-pixel divider border.
 *
 * The invalid border is `--color-form-error` (03 §2.3) — the same `#d3402e` it
 * drew as `--color-yelp`, now named for the role rather than for the review
 * site. Non-text at 3:1, and it measures 4.62 against the card's white.
 */
const CONTROL_CLASS =
  "w-full rounded-input border border-divider bg-cream px-3 font-body text-input text-ink transition-colors duration-(--dur-word-swap) ease-soft aria-invalid:border-form-error md:px-3.5";

const INPUT_CLASS = `h-(--input-h) ${CONTROL_CLASS}`;

/** 70px mobile / 84px desktop (design L323 / mobile L233). */
const TEXTAREA_CLASS = `h-17.5 py-2.5 md:h-21 ${CONTROL_CLASS}`;

/** The `Select…` placeholder is drawn in `--color-muted-2` (design L321). */
const PLACEHOLDER_CLASS = "text-muted-2!";

/* -------------------------------------------------------------------------- *
 * The component
 * -------------------------------------------------------------------------- */

export function InquiryForm({
  source,
  contact,
  turnstileSiteKey,
  privacyHref,
  noscript,
  className,
}: InquiryFormProps) {
  const locale = useLocale();
  const t = useTranslations("visit.form");
  const tVisit = useTranslations("visit");
  const format = useFormatter();

  const [values, setValues] = useState<FieldValues>(EMPTY_VALUES);
  const [honeypot, setHoneypot] = useState("");
  const [touched, setTouched] = useState<Touched>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formCode, setFormCode] = useState<string | undefined>(undefined);
  const [announcement, setAnnouncement] = useState<Announcement | undefined>(undefined);
  const [succeeded, setSucceeded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /**
   * Bumped after a success, which is what regenerates `submissionId` and
   * `startedAt` — 07 §1 says "regenerated only after success".
   */
  const [instance, setInstance] = useState(0);

  /** 07 §1's second lazy-load trigger: the form has been focused at least once. */
  const [armed, setArmed] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const tokenRef = useRef("");
  const tokenWaitersRef = useRef<Array<(token: string) => void>>([]);
  const turnstileFailedRef = useRef(false);
  /** The duplicate-submit guard. A ref, because a click cannot outrun a ref. */
  const busyRef = useRef(false);

  /**
   * The two per-instance technical fields live in refs and in the DOM, never in
   * React state, because their values exist only in the browser: a UUID and a
   * clock reading generated during render would differ between the server pass
   * and the hydration pass and tear the tree. The effect below is the only
   * writer, and what it does is exactly what an effect is for — pushing a
   * browser-only fact into the DOM the server already rendered.
   */
  const submissionIdRef = useRef("");
  const startedAtRef = useRef(0);
  const submissionIdInputRef = useRef<HTMLInputElement>(null);
  const startedAtInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    submissionIdRef.current = randomUuid();
    startedAtRef.current = Date.now();

    const submissionIdInput = submissionIdInputRef.current;
    if (submissionIdInput !== null) submissionIdInput.value = submissionIdRef.current;

    const startedAtInput = startedAtInputRef.current;
    if (startedAtInput !== null) startedAtInput.value = String(startedAtRef.current);

    // `D-07.5`'s progressive-enhancement switch. The server HTML carries no
    // `novalidate`, so the native constraints validate the form without
    // JavaScript; this line is the moment JavaScript takes the job over.
    const form = formRef.current;
    if (form !== null) form.noValidate = true;
  }, [instance]);

  /**
   * 07 §1's second lazy-load trigger, as a subscription rather than an
   * `onFocus` prop: `focusin` is what actually bubbles from a control to the
   * form, and hanging a focus handler off a `<form>` is what
   * `jsx-a11y/no-noninteractive-element-interactions` exists to stop. `once`
   * means the listener removes itself the first time a parent touches the form.
   */
  useEffect(() => {
    const form = formRef.current;
    if (form === null || armed) return undefined;

    const onFocusIn = () => {
      setArmed(true);
    };
    form.addEventListener("focusin", onFocusIn, { once: true });
    return () => {
      form.removeEventListener("focusin", onFocusIn);
    };
  }, [armed]);

  /* ---------------------------------------------------------------------- *
   * Focus
   * ---------------------------------------------------------------------- */

  /**
   * The control is found by its `name`, which every one of them already carries
   * for the no-JavaScript POST, so no second registry of refs has to be kept in
   * step with the five fields.
   */
  const focusField = useCallback((name: string) => {
    formRef.current?.querySelector<HTMLElement>(`[name="${name}"]`)?.focus();
  }, []);

  /* ---------------------------------------------------------------------- *
   * Validation — the shared schema, filtered to the five drawn controls
   * ---------------------------------------------------------------------- */

  const codesFor = useCallback(
    (candidate: FieldValues): FieldErrors => {
      const parsed = parseInquiry({
        ...candidate,
        locale,
        source,
        submissionId: submissionIdRef.current,
        startedAt: startedAtRef.current,
        [HONEYPOT_FIELD]: "",
      });
      if (parsed.ok) return {};

      const found: Partial<Record<InquiryFormFieldName, InquiryFieldCode>> = {};
      for (const name of INQUIRY_FORM_FIELDS) {
        const code = parsed.fields[name];
        if (code !== undefined) found[name] = code;
      }
      return found;
    },
    [locale, source],
  );

  const firstInvalid = useCallback(
    (found: FieldErrors): InquiryFormFieldName | undefined =>
      INQUIRY_FORM_FIELDS.find((name) => found[name] !== undefined),
    [],
  );

  const onChange = useCallback(
    (name: InquiryFormFieldName) =>
      (event: ReactChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const next = { ...values, [name]: event.target.value };
        setValues(next);
        // Re-validate on change only while an error is already showing, so the
        // message clears as the parent fixes it and never appears mid-typing.
        if (errors[name] !== undefined) {
          setErrors({ ...errors, [name]: codesFor(next)[name] });
        }
      },
    [values, errors, codesFor],
  );

  const onBlur = useCallback(
    (name: InquiryFormFieldName) => () => {
      setTouched((previous) => ({ ...previous, [name]: true }));
      setErrors((previous) => ({ ...previous, [name]: codesFor(values)[name] }));
    },
    [values, codesFor],
  );

  const errorFor = useCallback(
    (name: InquiryFormFieldName): string | undefined => {
      const code = errors[name];
      if (code === undefined || touched[name] !== true) return undefined;
      return t(inquiryErrorKey(code, name));
    },
    [errors, touched, t],
  );

  /* ---------------------------------------------------------------------- *
   * Turnstile
   * ---------------------------------------------------------------------- */

  const onToken = useCallback((token: string) => {
    tokenRef.current = token;
    turnstileFailedRef.current = false;
    for (const waiter of tokenWaitersRef.current.splice(0)) waiter(token);
  }, []);

  const onTurnstileUnavailable = useCallback(() => {
    turnstileFailedRef.current = true;
    for (const waiter of tokenWaitersRef.current.splice(0)) waiter("");
  }, []);

  /** Resolves with the token, or with `""` when the challenge never arrives. */
  const awaitToken = useCallback((): Promise<string> => {
    if (tokenRef.current.length > 0) return Promise.resolve(tokenRef.current);
    if (turnstileFailedRef.current) return Promise.resolve("");

    turnstileRef.current?.execute();

    return new Promise<string>((resolve) => {
      let waiter: (token: string) => void = () => undefined;
      const timer = setTimeout(() => {
        tokenWaitersRef.current = tokenWaitersRef.current.filter((entry) => entry !== waiter);
        resolve("");
      }, TOKEN_WAIT_MS);
      waiter = (token: string) => {
        clearTimeout(timer);
        resolve(token);
      };
      tokenWaitersRef.current.push(waiter);
    });
  }, []);

  /** 07 §1: after any failed server attempt, Turnstile re-executes on retry. */
  const rearmTurnstile = useCallback(() => {
    tokenRef.current = "";
    turnstileRef.current?.reset();
  }, []);

  /* ---------------------------------------------------------------------- *
   * Submit
   * ---------------------------------------------------------------------- */

  const failWith = useCallback(
    (code: string) => {
      setFormCode(code);
      setAnnouncement(undefined);
      track("inquiry_failed", { code });
      rearmTurnstile();
    },
    [rearmTurnstile],
  );

  async function onSubmit(event: ReactFormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;

    const found = codesFor(values);

    if (Object.keys(found).length > 0) {
      // `flushSync`, so `aria-invalid` and the error element the control's
      // `aria-describedby` points at are both in the DOM before focus lands on
      // it. Focusing first would announce the field without the reason.
      flushSync(() => {
        setTouched(ALL_TOUCHED);
        setErrors(found);
        setFormCode(undefined);
        setAnnouncement("status.error.title");
      });
      const first = firstInvalid(found);
      if (first !== undefined) focusField(first);
      return;
    }

    setTouched(ALL_TOUCHED);

    busyRef.current = true;
    setErrors({});
    setFormCode(undefined);
    setAnnouncement("status.submitting");
    setSubmitting(true);

    try {
      const token = await awaitToken();
      if (token.length === 0) {
        failWith("turnstile_unavailable");
        return;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, SUBMIT_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(INQUIRY_ENDPOINT, {
          method: "POST",
          headers: { "content-type": CONTENT_TYPE_JSON },
          body: JSON.stringify({
            ...values,
            locale,
            source,
            submissionId: submissionIdRef.current,
            startedAt: startedAtRef.current,
            [HONEYPOT_FIELD]: honeypot,
            [TURNSTILE_TOKEN_FIELD]: token,
          }),
          signal: controller.signal,
        });
      } catch {
        failWith("network");
        return;
      } finally {
        clearTimeout(timer);
      }

      const body = await readBody(response);

      if (response.ok && body?.ok === true) {
        track("inquiry_submitted", { locale, source, childAge: values.childAge });
        tokenRef.current = "";
        turnstileRef.current?.reset();
        setValues(EMPTY_VALUES);
        setHoneypot("");
        setTouched({});
        setErrors({});
        setFormCode(undefined);
        setAnnouncement(undefined);
        setInstance((previous) => previous + 1);
        setSucceeded(true);
        return;
      }

      const fields = body?.ok === false ? body.fields : undefined;
      if (fields !== undefined) {
        const serverErrors: Partial<Record<InquiryFormFieldName, InquiryFieldCode>> = {};
        for (const name of INQUIRY_FORM_FIELDS) {
          const code = fields[name];
          if (code !== undefined) serverErrors[name] = code;
        }
        flushSync(() => {
          setErrors(serverErrors);
          setAnnouncement("status.error.title");
        });
        const first = firstInvalid(serverErrors);
        if (first !== undefined) focusField(first);
        rearmTurnstile();
        return;
      }

      const code = (body?.ok === false ? body.code : undefined) ?? CODE_BY_STATUS[response.status];
      failWith(code ?? UNKNOWN_CODE);
    } finally {
      busyRef.current = false;
      setSubmitting(false);
    }
  }

  const onReset = useCallback(() => {
    setSucceeded(false);
    setAnnouncement(undefined);
  }, []);

  /* ---------------------------------------------------------------------- *
   * Options
   * ---------------------------------------------------------------------- */

  const monthIds = useMemo(() => monthOptionIds(new Date()), []);

  if (succeeded) {
    return (
      <div className={withOverrides("InquiryForm", ROOT_CLASS, className)}>
        <SuccessPanel onReset={onReset} />
      </div>
    );
  }

  const alertKey: InquiryErrorKey =
    formCode === undefined ? UNKNOWN_ERROR_KEY : inquiryErrorKey(formCode);

  const showContact =
    formCode !== undefined && (CONTACT_CODES as readonly string[]).includes(formCode);

  return (
    <div className={withOverrides("InquiryForm", ROOT_CLASS, className)}>
      <form
        ref={formRef}
        lang={locale}
        action={INQUIRY_ENDPOINT}
        method="post"
        className={FORM_CLASS}
        onSubmit={(event) => {
          void onSubmit(event);
        }}
      >
        <p className={LEGEND_CLASS}>{t("requiredLegend")}</p>

        <div className={`${ROW_CLASS} md:grid-cols-2`}>
          <FormField
            name="parentName"
            required
            label={t("fields.parentName.label")}
            error={errorFor("parentName")}
            control={(props: FieldControlProps) => (
              <input
                {...props}
                type="text"
                value={values.parentName}
                onChange={onChange("parentName")}
                onBlur={onBlur("parentName")}
                autoComplete="name"
                autoCapitalize="words"
                maxLength={NAME_MAX_LENGTH}
                className={INPUT_CLASS}
              />
            )}
          />
          <FormField
            name="email"
            required
            label={t("fields.email.label")}
            error={errorFor("email")}
            control={(props: FieldControlProps) => (
              <input
                {...props}
                type="email"
                inputMode="email"
                value={values.email}
                onChange={onChange("email")}
                onBlur={onBlur("email")}
                autoComplete="email"
                maxLength={EMAIL_MAX_LENGTH}
                className={INPUT_CLASS}
              />
            )}
          />
        </div>

        <div className={PAIR_CLASS}>
          <FormField
            name="childAge"
            required
            label={t("fields.childAge.label")}
            error={errorFor("childAge")}
            control={(props: FieldControlProps) => (
              <select
                {...props}
                value={values.childAge}
                onChange={onChange("childAge")}
                onBlur={onBlur("childAge")}
                className={`${INPUT_CLASS} ${values.childAge === "" ? PLACEHOLDER_CLASS : ""}`}
              >
                <option value="" disabled>
                  {t("fields.childAge.placeholder")}
                </option>
                {CHILD_AGE_IDS.map((id) => (
                  <option key={id} value={id}>
                    {tVisit(childAgeOptionKey(id))}
                  </option>
                ))}
              </select>
            )}
          />
          <FormField
            name="desiredStart"
            label={t("fields.desiredStart.label")}
            error={errorFor("desiredStart")}
            control={(props: FieldControlProps) => (
              <select
                {...props}
                value={values.desiredStart}
                onChange={onChange("desiredStart")}
                onBlur={onBlur("desiredStart")}
                className={`${INPUT_CLASS} ${values.desiredStart === "" ? PLACEHOLDER_CLASS : ""}`}
              >
                {/* Selectable, unlike `childAge`'s: the field is optional, so
                    "no answer" has to stay reachable after one is chosen. */}
                <option value="">{t("fields.desiredStart.placeholder")}</option>
                {DESIRED_START_KEYWORDS.map((keyword) => (
                  <option key={keyword} value={keyword}>
                    {tVisit(desiredStartOptionKey(keyword))}
                  </option>
                ))}
                {monthIds.map((monthId) => (
                  <option key={monthId} value={monthId}>
                    {format.dateTime(monthDate(monthId), "dateMonth")}
                  </option>
                ))}
              </select>
            )}
          />
        </div>

        <FormField
          name="message"
          label={t("fields.message.label")}
          error={errorFor("message")}
          control={(props: FieldControlProps) => (
            <textarea
              {...props}
              value={values.message}
              onChange={onChange("message")}
              onBlur={onBlur("message")}
              maxLength={MESSAGE_MAX_LENGTH}
              className={TEXTAREA_CLASS}
            />
          )}
        />

        {/* 07 §1's technical fields. Real inputs, so the no-JavaScript
            URL-encoded POST carries them to the handler's 303 path too. */}
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="source" value={source} />
        <input ref={submissionIdInputRef} type="hidden" name="submissionId" />
        <input ref={startedAtInputRef} type="hidden" name="startedAt" />
        <input
          type="text"
          name={HONEYPOT_FIELD}
          value={honeypot}
          onChange={(event: ReactChangeEvent<HTMLInputElement>) => {
            setHoneypot(event.target.value);
          }}
          className="sr-only"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        <Turnstile
          ref={turnstileRef}
          siteKey={turnstileSiteKey}
          locale={locale}
          armed={armed}
          onToken={onToken}
          onUnavailable={onTurnstileUnavailable}
        />

        {formCode === undefined ? null : (
          <FormAlert messageKey={alertKey} contact={showContact ? contact : undefined} />
        )}

        <button
          type="submit"
          data-inquiry-submit=""
          aria-busy={submitting}
          aria-disabled={submitting}
          className={`${buttonRecipe("submit", "sage")} md:self-start`}
        >
          {submitting ? t("status.submitting") : t("submit")}
        </button>

        <noscript dangerouslySetInnerHTML={{ __html: NOSCRIPT_HIDE_SUBMIT }} />
        {noscript}

        <p className={PRIVACY_CLASS}>
          {t.rich("privacy", {
            link: (chunks) => (
              <Link href={privacyHref} className={PRIVACY_LINK_CLASS}>
                {chunks}
              </Link>
            ),
          })}
        </p>

        {/*
          The polite outcome announcement (`D-07.4`). It stays empty for the
          server failures, which `FormAlert` announces itself through
          `role="alert"` — one outcome, announced once.
        */}
        <p aria-live="polite" className="sr-only">
          {announcement === undefined ? null : t(announcement)}
        </p>
      </form>
    </div>
  );
}

/** A body that is not JSON — the WAF's 429 page, a proxy error — is not fatal. */
async function readBody(response: Response): Promise<InquiryResponseBody | undefined> {
  try {
    return (await response.json()) as InquiryResponseBody;
  } catch {
    return undefined;
  }
}
