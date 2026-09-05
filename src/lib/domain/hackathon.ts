/** Common institute hackathons — hints for filters and team creation, not a closed list. */
export const HACKATHON_HINTS = [
  "Smart India Hackathon 2026",
  "Internal TIET Hackathon",
  "IEEE Xtreme",
  "Google Solution Challenge",
  "Microsoft Imagine Cup",
  "CodeForGood",
] as const;

/** Quick-add role slots students typically need on a hackathon team. */
export const TEAM_ROLE_TEMPLATES = [
  { label: "Frontend", skills: ["React", "JavaScript", "TypeScript"] },
  { label: "Backend", skills: ["Python", "Node.js", "Java"] },
  { label: "DevOps", skills: ["Docker", "AWS"] },
  { label: "Security", skills: ["Cybersecurity", "Network Security"] },
  { label: "ML / AI", skills: ["Python", "Machine Learning"] },
  { label: "Designer", skills: ["Figma", "UI Design"] },
] as const;
