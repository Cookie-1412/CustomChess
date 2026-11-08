/** A gaunt pale figure clutching its face. Original artwork for this app. */
export function Scp096() {
  return (
    <svg viewBox="0 0 100 100" aria-label="SCP-096" role="img" style={{ display: 'block', width: '100%', height: '100%' }}>
      <g stroke="#17151a" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round">
        {/* Hunched body and folded legs */}
        <path d="M34 97 C26 80 30 62 44 54 L62 54 C76 62 80 82 72 97 Z" fill="#c9c6c0" />
        <path d="M30 97 C38 84 48 82 54 88 C60 82 72 84 78 97 Z" fill="#b5b2ac" />
        <path d="M44 66 q9 5 18 0 M46 74 q8 4 15 0" fill="none" strokeWidth="1.8" />
        {/* Long arms reaching up around the head */}
        <path d="M38 60 C20 56 14 40 22 22 L29 25 C25 38 30 48 42 50 Z" fill="#d8d5cf" />
        <path d="M68 60 C86 56 92 40 84 22 L77 25 C81 38 76 48 64 50 Z" fill="#d8d5cf" />
        {/* Head */}
        <path d="M53 8 C72 8 76 28 71 42 C67 56 60 62 53 62 C46 62 39 56 35 42 C30 28 34 8 53 8 Z" fill="#e4e1db" />
        {/* Hollow eyes and screaming mouth */}
        <ellipse cx="44" cy="29" rx="6.5" ry="7.5" fill="#17151a" />
        <ellipse cx="62" cy="29" rx="6.5" ry="7.5" fill="#17151a" />
        <circle cx="44" cy="29" r="1.8" fill="#f2efe9" stroke="none" />
        <circle cx="62" cy="29" r="1.8" fill="#f2efe9" stroke="none" />
        <path d="M43 43 C46 39 60 39 63 43 C65 50 60 59 53 59 C46 59 41 50 43 43 Z" fill="#2a0f12" />
        <path d="M46 43 v4 M50 41.500 v5 M54 41.500 v5 M58 42 v5 M47 56 v-4 M53 58 v-5 M59 55 v-4" stroke="#e4e1db" strokeWidth="1.500" fill="none" />
        {/* Long fingers over the face */}
        <path d="M22 22 l-5 -12 M25 21 l-1 -14 M28 23 l4 -13" fill="none" strokeWidth="3.600" stroke="#17151a" />
        <path d="M22 22 l-5 -12 M25 21 l-1 -14 M28 23 l4 -13" fill="none" strokeWidth="1.600" stroke="#d8d5cf" />
        <path d="M84 22 l5 -12 M81 21 l1 -14 M78 23 l-4 -13" fill="none" strokeWidth="3.600" stroke="#17151a" />
        <path d="M84 22 l5 -12 M81 21 l1 -14 M78 23 l-4 -13" fill="none" strokeWidth="1.600" stroke="#d8d5cf" />
      </g>
    </svg>
  );
}
