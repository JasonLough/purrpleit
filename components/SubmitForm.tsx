"use client";

import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { submitPost, type SubmitState } from "@/app/actions";

export function SubmitForm() {
  const params = useSearchParams();
  const [kind, setKind] = useState<"link" | "self">(params.get("kind") === "self" ? "self" : "link");
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitPost, {});

  return (
    <form action={action} className="form">
      <ul className="tabmenu" style={{ borderBottom: "1px solid var(--header-border)", marginBottom: 10 }}>
        {(["link", "self"] as const).map((k) => (
          <li key={k}>
            <a
              href="#"
              className={kind === k ? "selected" : ""}
              onClick={(e) => {
                e.preventDefault();
                setKind(k);
              }}
            >
              {k === "link" ? "link" : "text"}
            </a>
          </li>
        ))}
      </ul>
      <input type="hidden" name="kind" value={kind} />
      {state.error && <div className="error">{state.error}</div>}
      <div className="field">
        <label className="field-title" htmlFor="title">
          title
        </label>
        <textarea id="title" name="title" rows={2} maxLength={300} required />
      </div>
      {kind === "link" ? (
        <div className="field">
          <label className="field-title" htmlFor="url">
            url
          </label>
          <input id="url" name="url" type="url" placeholder="https://" required />
        </div>
      ) : (
        <div className="field">
          <label className="field-title" htmlFor="body">
            text
          </label>
          <textarea id="body" name="body" rows={8} required />
        </div>
      )}
      <div className="field">
        <label className="field-title" htmlFor="tag">
          tag <span style={{ fontWeight: "normal", color: "#888" }}>(optional)</span>
        </label>
        <input id="tag" name="tag" type="text" placeholder="e.g. science" maxLength={20} />
        <div className="hint">one word, shows up as [tag] next to the title</div>
      </div>
      <button type="submit" disabled={pending}>
        {pending ? "submitting…" : "submit"}
      </button>
    </form>
  );
}
