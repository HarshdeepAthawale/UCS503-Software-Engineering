import type { NavIcon as Icon } from "@/lib/client/nav";

/** Line icons for navigation (24px grid, 1.75 stroke, currentColor). */
const PATHS: Record<Icon | "bell" | "plus" | "search", React.ReactNode> = {
  opportunities: (
    <>
      <rect x="3.5" y="7" width="17" height="12.5" rx="2.5" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17" />
    </>
  ),
  applications: (
    <>
      <path d="M8 4.5h8M7 4.5H6A1.5 1.5 0 0 0 4.5 6v13A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5V6A1.5 1.5 0 0 0 18 4.5h-1" />
      <path d="m8.5 13 2.5 2.5 4.5-5" />
    </>
  ),
  postings: (
    <>
      <path d="M6 3.5h8l4 4v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" />
      <path d="M14 3.5v4h4M8.5 12.5h7M8.5 16h5" />
    </>
  ),
  teams: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M15.5 5.8a3 3 0 0 1 0 5.4M17.5 14.2A5.5 5.5 0 0 1 20.5 19" />
    </>
  ),
  messages: <path d="M5 5.5h14A1.5 1.5 0 0 1 20.5 7v8a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5Z" />,
  console: (
    <>
      <path d="M12 3.5 5 6.2v5.1c0 4.3 3 7.6 7 9.2 4-1.6 7-4.9 7-9.2V6.2Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8.5" r="3.25" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  bell: (
    <>
      <path d="M12 4a5 5 0 0 0-5 5v3l-1.8 3.2a.5.5 0 0 0 .4.8h12.8a.5.5 0 0 0 .4-.8L17 12V9a5 5 0 0 0-5-5Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
};

export function NavIcon({ name, size = 20 }: { name: Icon | "bell" | "plus" | "search"; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
