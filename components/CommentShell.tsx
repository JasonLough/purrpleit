"use client";

import { useState, type ReactNode } from "react";
import { VoteArrows } from "./VoteArrows";

export function CommentShell({
  id,
  score,
  myVote,
  tagline,
  descendants,
  children,
}: {
  id: number;
  score: number;
  myVote: number;
  tagline: ReactNode;
  descendants: number;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={`comment ${collapsed ? "collapsed" : ""}`} id={`c${id}`}>
      <VoteArrows type="comment" id={id} score={score} myVote={myVote} showScore={false} />
      <div className="entry" style={{ flex: 1, minWidth: 0 }}>
        <div className="tagline">
          <button className="expand" onClick={() => setCollapsed((c) => !c)}>
            [{collapsed ? "+" : "–"}]
          </button>
          {tagline}
          {collapsed && descendants > 0 && ` (${descendants} ${descendants === 1 ? "child" : "children"})`}
        </div>
        <div className="comment-body">{children}</div>
      </div>
    </div>
  );
}
