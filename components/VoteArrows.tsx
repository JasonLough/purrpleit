"use client";

import { useState, useTransition } from "react";
import { vote } from "@/app/actions";
import type { VoteTarget } from "@/lib/db/schema";

function Arrow({ dir }: { dir: "up" | "down" }) {
  return (
    <svg viewBox="0 0 15 14" width="15" height="14" aria-hidden>
      <path
        d={dir === "up" ? "M7.5 0 L15 8 H10 V14 H5 V8 H0 Z" : "M7.5 14 L15 6 H10 V0 H5 V6 H0 Z"}
        fill="currentColor"
      />
    </svg>
  );
}

export function VoteArrows({
  type,
  id,
  score,
  myVote,
  showScore = true,
}: {
  type: VoteTarget;
  id: number;
  score: number;
  myVote: number;
  showScore?: boolean;
}) {
  const [current, setCurrent] = useState(myVote);
  const [, startTransition] = useTransition();
  const displayScore = score - myVote + current;

  function cast(dir: 1 | -1) {
    const next = (current === dir ? 0 : dir) as -1 | 0 | 1;
    setCurrent(next);
    startTransition(() => vote(type, id, next));
  }

  return (
    <div className="midcol">
      <button
        className={`arrow up ${current === 1 ? "on" : ""}`}
        onClick={() => cast(1)}
        aria-label="upvote"
      >
        <Arrow dir="up" />
      </button>
      {showScore && (
        <div className={`score ${current === 1 ? "likes" : current === -1 ? "dislikes" : ""}`}>
          {displayScore}
        </div>
      )}
      <button
        className={`arrow down ${current === -1 ? "on" : ""}`}
        onClick={() => cast(-1)}
        aria-label="downvote"
      >
        <Arrow dir="down" />
      </button>
    </div>
  );
}
