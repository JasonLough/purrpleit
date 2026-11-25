"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { addComment } from "@/app/actions";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "saving…" : "save"}
    </button>
  );
}

export function ReplyBox({
  postId,
  parentId,
  alwaysOpen = false,
}: {
  postId: number;
  parentId?: number;
  alwaysOpen?: boolean;
}) {
  const [open, setOpen] = useState(alwaysOpen);
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <div className="flat-list">
        <button onClick={() => setOpen(true)}>reply</button>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      className="reply-form"
      action={async (formData) => {
        await addComment(formData);
        formRef.current?.reset();
        if (!alwaysOpen) setOpen(false);
      }}
    >
      <input type="hidden" name="postId" value={postId} />
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <textarea name="body" required autoFocus={!alwaysOpen} />
      <SaveButton />
      {!alwaysOpen && (
        <button type="button" onClick={() => setOpen(false)}>
          cancel
        </button>
      )}
    </form>
  );
}
