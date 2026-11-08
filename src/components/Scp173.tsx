/** A peanut-shaped concrete statue streaked with spray paint. Original artwork for this app. */
export function Scp173() {
  return (
    <svg viewBox="0 0 100 100" aria-label="SCP-173" role="img" style={{ display: 'block', width: '100%', height: '100%' }}>
      <g stroke="#1b1a1c" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        {/* Stubby arms */}
        <path d="M31 57 C21 58 17 66 20 73 L27 71 C26 67 29 64 34 64 Z" fill="#b9b3a6" />
        <path d="M69 57 C79 58 83 66 80 73 L73 71 C74 67 71 64 66 64 Z" fill="#b9b3a6" />
        {/* Peanut body and head in one shape */}
        <path
          d="M50 5 C67 5 75 18 73 31 C72 39 67 43 67 48 C67 53 77 60 77 74 C77 88 65 96 50 96 C35 96 23 88 23 74 C23 60 33 53 33 48 C33 43 28 39 27 31 C25 18 33 5 50 5 Z"
          fill="#cfc9bb"
        />
        {/* Spray paint */}
        <g fill="none" strokeWidth="3.600" stroke="#b5261e" opacity="0.9">
          <path d="M31 30 C34 21 42 19 44 26" />
          <path d="M69 32 C66 22 58 20 56 27" />
          <path d="M33 70 C40 62 47 76 54 68 C60 62 64 72 68 66" />
        </g>
        <path d="M30 82 C38 78 44 88 52 82 C58 78 64 84 70 80" fill="none" strokeWidth="3.200" stroke="#3f7d44" opacity="0.9" />
        {/* Staring face */}
        <circle cx="41" cy="30" r="6.500" fill="#1b1a1c" stroke="none" />
        <circle cx="59" cy="30" r="6.500" fill="#1b1a1c" stroke="none" />
        <circle cx="42.500" cy="28.500" r="1.800" fill="#f2efe9" stroke="none" />
        <circle cx="60.500" cy="28.500" r="1.800" fill="#f2efe9" stroke="none" />
        <path d="M43 44 Q50 47 57 44" fill="none" strokeWidth="2.600" />
      </g>
    </svg>
  );
}
