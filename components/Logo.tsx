import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="purrpleit home">
      <svg width="40" height="38" viewBox="0 0 40 38" aria-hidden>
        <path d="M6 14 L4 2 L15 9 Z" fill="#7b52d6" stroke="#3b2275" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M34 14 L36 2 L25 9 Z" fill="#7b52d6" stroke="#3b2275" strokeWidth="1.5" strokeLinejoin="round" />
        <ellipse cx="20" cy="22" rx="16" ry="13" fill="#9b72ef" stroke="#3b2275" strokeWidth="1.5" />
        <ellipse cx="14" cy="20" rx="3.2" ry="4" fill="#fff" />
        <ellipse cx="26" cy="20" rx="3.2" ry="4" fill="#fff" />
        <ellipse cx="14.6" cy="20.6" rx="1.6" ry="2.4" fill="#ff5a1f" />
        <ellipse cx="26.6" cy="20.6" rx="1.6" ry="2.4" fill="#ff5a1f" />
        <path d="M18.5 26 L21.5 26 L20 27.6 Z" fill="#ffb3c7" />
        <path d="M20 27.6 Q17.5 30.5 15.5 28.5 M20 27.6 Q22.5 30.5 24.5 28.5" stroke="#3b2275" strokeWidth="1.1" fill="none" />
        <path d="M3 24 L11 25 M3 28 L11 27 M37 24 L29 25 M37 28 L29 27" stroke="#3b2275" strokeWidth="0.9" />
      </svg>
      <span>purrpleit</span>
    </Link>
  );
}
