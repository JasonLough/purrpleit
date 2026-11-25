import { Fragment } from "react";

const URL_RE = /(https?:\/\/[^\s<>()]+[^\s<>().,!?;:'"])/g;

function linkify(text: string) {
  return text.split(URL_RE).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noreferrer">
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

export function UserText({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className="usertext">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((l) => l.startsWith(">"))) {
          return (
            <blockquote key={i}>
              <p>{linkify(lines.map((l) => l.replace(/^>\s?/, "")).join(" "))}</p>
            </blockquote>
          );
        }
        return (
          <p key={i}>
            {lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {linkify(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
