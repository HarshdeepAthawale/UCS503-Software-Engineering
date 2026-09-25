import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma, type AppState, type OppType, type Proficiency, type RejectionCode, type SlaPledge } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/security/password";
import { BRANCHES } from "../src/lib/domain/branch";

/**
 * DEMO DATA - for the `nexus_demo` database ONLY.
 *
 * The project's rule is pilot honesty: the real database holds only rows made
 * by real people (CONTEXT.md). This script exists so the team can see how the
 * product looks and performs at institute scale without breaking that rule, so
 * it refuses to run against anything except a local database literally named
 * `nexus_demo`. Every account uses the reserved @example.test domain, which the
 * purge script already recognises.
 *
 *   npm run demo:setup     create nexus_demo, migrate, run this
 *   npm run dev:demo       start the app against it (email disabled)
 *
 * All demo accounts share DEMO_PASSWORD from .env.demo.local.
 *
 * The data is deterministic (seeded PRNG) and behaviourally realistic: posters
 * have responsiveness profiles, so badges, response rates and at-risk postings
 * differ the way they would with real people.
 */

// ── Guard ────────────────────────────────────────────────────────────────────

const url = process.env.DATABASE_URL ?? "";
const parsed = (() => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
})();
if (!parsed || parsed.pathname.replace(/^\//, "") !== "nexus_demo" || !["localhost", "127.0.0.1", "db"].includes(parsed.hostname)) {
  throw new Error("seed-demo only runs against a LOCAL database named nexus_demo. Refusing.");
}
const PASSWORD = process.env.DEMO_PASSWORD;
if (!PASSWORD || PASSWORD.length < 12) {
  throw new Error("Set DEMO_PASSWORD (12+ characters) in .env.demo.local.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

// ── Scale ────────────────────────────────────────────────────────────────────

const SCALE = {
  students: 800,
  faculty: 70,
  alumni: 40,
  admins: 2,
  opportunities: 320,
  teams: 70,
};
const DAY = 86_400_000;
const HOUR = 3_600_000;
const NOW = Date.now();

// ── Deterministic randomness ─────────────────────────────────────────────────

let seed = 20260926;
function rand(): number {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T;
const chance = (p: number) => rand() < p;
function sample<T>(xs: readonly T[], n: number): T[] {
  const copy = [...xs];
  const out: T[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0] as T);
  return out;
}

// ── Vocabulary ───────────────────────────────────────────────────────────────

const FIRST = ["Aarav", "Aditi", "Aditya", "Akash", "Ananya", "Anika", "Arjun", "Aryan", "Bhavya", "Chirag", "Dev", "Diya", "Gaurav", "Harsh", "Ishaan", "Ishita", "Jasleen", "Kabir", "Karan", "Kavya", "Khushi", "Manav", "Meera", "Mehak", "Naina", "Neha", "Nikhil", "Palak", "Parth", "Pranav", "Priya", "Rahul", "Riya", "Rohan", "Sahil", "Saanvi", "Sanya", "Shreya", "Simran", "Tanvi", "Tanya", "Uday", "Vansh", "Varun", "Vedika", "Yash", "Zoya", "Gurleen", "Harleen", "Jaskaran", "Navneet", "Rhea", "Sukhman", "Tejas", "Yuvraj"] as const;
const LAST = ["Sharma", "Verma", "Gupta", "Singh", "Kaur", "Malhotra", "Bansal", "Chopra", "Kapoor", "Mehta", "Agarwal", "Jain", "Arora", "Sethi", "Gill", "Sandhu", "Dhillon", "Grewal", "Bhatia", "Khanna", "Saini", "Mittal", "Goyal", "Chauhan", "Rana", "Thakur", "Nair", "Iyer", "Reddy", "Rao", "Das", "Bose", "Mishra", "Pandey", "Tiwari", "Joshi", "Kulkarni", "Patil", "Desai", "Shah"] as const;

const SKILLS: [string, string][] = [
  ["Python", "Programming"], ["Java", "Programming"], ["C++", "Programming"], ["JavaScript", "Programming"], ["TypeScript", "Programming"],
  ["Go", "Programming"], ["Rust", "Programming"], ["SQL", "Data"], ["PostgreSQL", "Data"], ["MongoDB", "Data"],
  ["React", "Web"], ["Next.js", "Web"], ["Node.js", "Web"], ["Django", "Web"], ["Flask", "Web"], ["HTML & CSS", "Web"],
  ["Machine Learning", "AI"], ["Deep Learning", "AI"], ["PyTorch", "AI"], ["TensorFlow", "AI"], ["Computer Vision", "AI"],
  ["Natural Language Processing", "AI"], ["Data Analysis", "Data"], ["Pandas", "Data"], ["Statistics", "Data"],
  ["Docker", "DevOps"], ["Kubernetes", "DevOps"], ["AWS", "DevOps"], ["Linux", "DevOps"], ["Git", "DevOps"], ["CI/CD", "DevOps"],
  ["Web Security", "Security"], ["Network Security", "Security"], ["Cryptography", "Security"], ["Penetration Testing", "Security"],
  ["Figma", "Design"], ["UI Design", "Design"], ["UX Research", "Design"],
  ["Embedded C", "Hardware"], ["Arduino", "Hardware"], ["VLSI", "Hardware"], ["PCB Design", "Hardware"], ["MATLAB", "Engineering"],
  ["AutoCAD", "Engineering"], ["SolidWorks", "Engineering"], ["ANSYS", "Engineering"], ["Signal Processing", "Engineering"],
  ["Android", "Mobile"], ["Flutter", "Mobile"], ["Technical Writing", "Communication"], ["Public Speaking", "Communication"],
];

const OPP_TEMPLATES: Record<OppType, { titles: string[]; domains: string[] }> = {
  RESEARCH: {
    titles: ["Research assistant - {topic}", "Undergraduate researcher for {topic}", "{topic} lab: summer research", "Literature review and experiments in {topic}"],
    domains: ["Machine Learning", "Computer Vision", "Cybersecurity", "VLSI Design", "Renewable Energy", "Structural Engineering", "Biotechnology", "Networks"],
  },
  INTERNSHIP: {
    titles: ["{topic} intern", "Summer internship - {topic}", "{topic} engineering intern", "Six-month internship in {topic}"],
    domains: ["Backend Development", "Frontend Development", "Data Engineering", "Product Design", "Cloud Infrastructure", "Embedded Systems", "Fintech"],
  },
  TA: {
    titles: ["Teaching assistant - {topic}", "Lab TA for {topic}", "Tutorial TA: {topic}"],
    domains: ["Data Structures", "Operating Systems", "Digital Electronics", "Engineering Mathematics", "Computer Networks", "Thermodynamics"],
  },
  HACKATHON_TEAM: {
    titles: ["Looking for a {topic} teammate", "Hackathon team needs {topic} skills", "Join our {topic} build for the hackathon"],
    domains: ["Web Development", "Machine Learning", "Blockchain", "IoT", "Healthcare Tech"],
  },
  MICRO_TASK: {
    titles: ["Short task: {topic}", "Weekend task - {topic}", "Two-week {topic} project"],
    domains: ["Data Labelling", "Website Updates", "Survey Analysis", "Poster Design", "Dataset Cleaning"],
  },
  REFERRAL: {
    titles: ["Referral: {topic} role at my company", "Can refer for {topic} openings", "{topic} referral for graduating students"],
    domains: ["Software Engineering", "Data Science", "Product Management", "Consulting", "Core Electronics"],
  },
};
const TYPE_WEIGHTS: [OppType, number][] = [["RESEARCH", 30], ["INTERNSHIP", 25], ["TA", 15], ["MICRO_TASK", 12], ["REFERRAL", 10], ["HACKATHON_TEAM", 8]];
const HACKATHONS = ["Smart India Hackathon", "TIET Makeathon", "HackMIT India Edition", "Google Solution Challenge", "IEEE Xtreme", "Code for Punjab", "ETHIndia", "Microsoft Imagine Cup"];
const TEAM_ROLES = ["Frontend developer", "Backend developer", "ML engineer", "Designer", "DevOps", "Hardware lead", "Pitch & research", "Mobile developer"];
const MESSAGES_FROM_POSTER = ["Thanks for applying - could you share a project you're proud of?", "Can you do a 20-minute call on Thursday?", "Your profile looks like a good fit. What's your availability this semester?", "Please send your latest transcript when you can."];
const MESSAGES_FROM_STUDENT = ["Thank you! Sharing the repository link here.", "Thursday works for me - any time after 3pm.", "I can give about 10 hours a week this semester.", "Sure, I'll send it by tomorrow."];

function weighted<T>(entries: [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of entries) {
    if ((r -= w) <= 0) return v;
  }
  return entries[0]![0];
}

const SLA_HOURS: Record<SlaPledge, number> = { H24: 24, H48: 48, WEEK: 168 };

/** How a poster behaves: chance of ever acknowledging, and typical delay. */
const PROFILES = {
  quick: { ackRate: 0.97, delayH: [1, 20] as const },
  average: { ackRate: 0.8, delayH: [10, 70] as const },
  slow: { ackRate: 0.55, delayH: [48, 200] as const },
  ghost: { ackRate: 0.15, delayH: [150, 400] as const },
};
type PosterProfile = keyof typeof PROFILES;

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const existing = await prisma.user.count();
  if (existing > 0) {
    throw new Error(`nexus_demo already has ${existing} users. Drop and recreate it first (npm run demo:setup does this).`);
  }

  console.log("hashing the shared demo password…");
  const passwordHash = await hashPassword(PASSWORD!);
  const usedEmails = new Set<string>();

  function person(role: string) {
    const first = pick(FIRST);
    const last = pick(LAST);
    let email = `${first}.${last}`.toLowerCase();
    let n = 1;
    while (usedEmails.has(email)) email = `${first}.${last}${++n}`.toLowerCase();
    usedEmails.add(email);
    return { id: randomUUID(), name: `${first} ${last}`, email: `${email}.${role}@example.test` };
  }

  // Skills
  const skills = SKILLS.map(([name, domain]) => ({ id: randomUUID(), name, domain }));
  await prisma.skill.createMany({ data: skills });

  // Users
  const superAdmin = { id: randomUUID(), name: "Demo Super Admin", email: "superadmin@example.test" };
  const admins = Array.from({ length: SCALE.admins }, () => person("admin"));
  const students = Array.from({ length: SCALE.students }, () => person("student"));
  const faculty = Array.from({ length: SCALE.faculty }, () => person("faculty"));
  const alumni = Array.from({ length: SCALE.alumni }, () => person("alumni"));
  const joined = (maxDaysAgo: number) => new Date(NOW - int(1, maxDaysAgo) * DAY);

  await prisma.user.createMany({
    data: [
      { ...superAdmin, passwordHash, role: "SUPER_ADMIN", status: "ACTIVE", createdAt: joined(200) },
      ...admins.map((u) => ({ ...u, passwordHash, role: "ADMIN" as const, status: "ACTIVE" as const, createdAt: joined(180) })),
      ...students.map((u) => ({ ...u, passwordHash, role: "STUDENT" as const, status: "ACTIVE" as const, createdAt: joined(150) })),
      ...faculty.map((u) => ({ ...u, passwordHash, role: "FACULTY" as const, status: "ACTIVE" as const, createdAt: joined(170) })),
      ...alumni.map((u) => ({ ...u, passwordHash, role: "ALUMNI" as const, status: "ACTIVE" as const, createdAt: joined(160) })),
    ],
  });
  console.log(`users: ${1 + admins.length + students.length + faculty.length + alumni.length}`);

  // Profiles + skills
  const studentInfo = new Map<string, { branch: string; cgpa: number; backlogs: number; skills: Set<string> }>();
  const profiles: Prisma.ProfileCreateManyInput[] = [];
  const userSkills: Prisma.UserSkillCreateManyInput[] = [];
  const PROF: Proficiency[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"];
  for (const s of students) {
    const branch = weighted<string>(BRANCHES.map((b) => [b, b === "COE" ? 6 : b === "ENC" || b === "ECE" ? 3 : 1]));
    const cgpa = Math.round(Math.min(9.95, Math.max(5, 7.4 + (rand() + rand() + rand() - 1.5) * 2)) * 100) / 100;
    const backlogs = chance(0.8) ? 0 : int(1, 3);
    const complete = chance(0.7);
    const mySkills = sample(skills, complete ? int(3, 7) : int(0, 2));
    studentInfo.set(s.id, { branch, cgpa, backlogs, skills: new Set(mySkills.map((k) => k.id)) });
    profiles.push({
      userId: s.id,
      branch,
      year: int(1, 4),
      cgpa,
      cgpaPublic: chance(0.4),
      backlogs,
      headline: complete ? `${pick(["Aspiring", "Curious", "Hands-on", "Self-taught"])} ${pick(mySkills.length ? mySkills : skills).name} developer` : null,
      bio: complete ? "Interested in building useful things and learning from people who ship." : null,
      githubUrl: complete && chance(0.7) ? `https://github.com/${s.email.split("@")[0]!.replace(/\./g, "-")}` : null,
      openTo: sample(["RESEARCH", "INTERNSHIP", "TA", "HACKATHON_TEAM", "MICRO_TASK", "REFERRAL"] as OppType[], complete ? int(1, 3) : 0),
      hoursPerWeek: complete && chance(0.6) ? pick([5, 8, 10, 12, 15, 20]) : null,
    });
    for (const k of mySkills) userSkills.push({ userId: s.id, skillId: k.id, proficiency: pick(PROF) });
  }
  for (const f of [...faculty, ...alumni]) {
    profiles.push({
      userId: f.id,
      headline: faculty.includes(f) ? `${pick(["Assistant", "Associate", ""])} Professor · ${pick(OPP_TEMPLATES.RESEARCH.domains)}`.trim() : `${pick(["SDE", "Data Scientist", "Product Manager", "Hardware Engineer"])} · class of ${int(2012, 2023)}`,
      bio: "Happy to work with motivated students.",
    });
  }
  await prisma.profile.createMany({ data: profiles });
  await prisma.userSkill.createMany({ data: userSkills });

  // Opportunities
  const posters = [...faculty, ...alumni];
  const posterProfile = new Map<string, PosterProfile>(
    posters.map((p) => [p.id, weighted<PosterProfile>([["quick", 30], ["average", 40], ["slow", 18], ["ghost", 12]])]),
  );
  const opps: (Prisma.OpportunityCreateManyInput & { id: string; posterId: string; deadline: Date; createdAt: Date; slaPledge: SlaPledge; seatCount: number })[] = [];
  const oppSkills: Prisma.OpportunitySkillCreateManyInput[] = [];
  for (let i = 0; i < SCALE.opportunities; i++) {
    const type = weighted(TYPE_WEIGHTS);
    const tpl = OPP_TEMPLATES[type];
    const domain = pick(tpl.domains);
    const createdAt = new Date(NOW - int(1, 110) * DAY - int(0, 23) * HOUR);
    const deadline = new Date(createdAt.getTime() + int(10, 60) * DAY);
    const stipend = type === "INTERNSHIP" ? chance(0.8) : chance(0.25);
    const restricted = type === "RESEARCH" && chance(0.3);
    const id = randomUUID();
    opps.push({
      id,
      posterId: pick(type === "REFERRAL" ? alumni : posters).id,
      type,
      title: pick(tpl.titles).replace("{topic}", domain),
      description: `We are looking for students interested in ${domain.toLowerCase()}. You will work closely with the team, meet weekly, and present your work at the end. Prior coursework helps but curiosity matters more.`,
      domain,
      duration: pick(["2 weeks", "1 month", "2 months", "One semester", "Summer (8 weeks)", null]),
      stipend,
      stipendAmount: stipend ? pick([5000, 8000, 10000, 15000, 20000, 25000]) : null,
      seatCount: type === "TA" ? int(2, 5) : int(1, 3),
      deadline,
      slaPledge: weighted<SlaPledge>([["H48", 50], ["WEEK", 35], ["H24", 15]]),
      status: deadline.getTime() < NOW ? (chance(0.15) ? "CLOSED" : "EXPIRED") : "LIVE",
      eligibleBranches: restricted ? sample([...BRANCHES], int(1, 3)) : [],
      minCgpa: restricted && chance(0.6) ? pick([6.5, 7, 7.5, 8]) : null,
      maxBacklogs: restricted && chance(0.5) ? 0 : null,
      createdAt,
    });
    for (const k of sample(skills, int(1, 4))) {
      oppSkills.push({ opportunityId: id, skillId: k.id, requirement: chance(0.6) ? "REQUIRED" : "PREFERRED" });
    }
  }
  await prisma.opportunity.createMany({ data: opps });
  await prisma.opportunitySkill.createMany({ data: oppSkills });
  console.log(`opportunities: ${opps.length}`);

  // Applications, with a realistic event timeline per application
  const applications: Prisma.ApplicationCreateManyInput[] = [];
  const events: Prisma.ApplicationEventCreateManyInput[] = [];
  const notifications: Prisma.NotificationCreateManyInput[] = [];
  const selectedApps: { id: string; studentId: string; posterId: string; oppId: string; at: Date }[] = [];
  const acknowledgedApps: { id: string; studentId: string; posterId: string; at: Date }[] = [];
  const activeCount = new Map<string, number>();
  const seatsTaken = new Map<string, number>();
  const REJECT: RejectionCode[] = ["STRONGER_APPLICANTS", "SKILL_MISMATCH", "SEATS_FILLED", "TIMING_CONFLICT", "PROFILE_INCOMPLETE"];

  for (const opp of opps) {
    const popularity = opp.type === "INTERNSHIP" ? int(8, 40) : opp.type === "RESEARCH" ? int(4, 25) : int(1, 12);
    const applicants = sample(students, popularity);
    const profile = PROFILES[posterProfile.get(opp.posterId)!];
    const windowEnd = Math.min(opp.deadline.getTime(), NOW);

    for (const st of applicants) {
      const info = studentInfo.get(st.id)!;
      if (opp.eligibleBranches && (opp.eligibleBranches as string[]).length && !(opp.eligibleBranches as string[]).includes(info.branch)) continue;
      if (opp.minCgpa != null && info.cgpa < Number(opp.minCgpa)) continue;
      if (opp.maxBacklogs != null && info.backlogs > Number(opp.maxBacklogs)) continue;
      if ((activeCount.get(st.id) ?? 0) >= 10) continue;

      const appliedAt = new Date(opp.createdAt.getTime() + rand() * Math.max(HOUR, windowEnd - opp.createdAt.getTime()));
      const id = randomUUID();
      let state = "APPLIED" as AppState; // widened: move() below changes it
      let t = appliedAt.getTime();
      let firstTransitionAt: Date | null = null;
      let rejectionCode: RejectionCode | null = null;
      events.push({ applicationId: id, actorId: st.id, fromState: null, toState: "APPLIED", createdAt: appliedAt });
      notifications.push({ userId: opp.posterId, type: "application.received", payload: { opportunityId: opp.id, applicationId: id }, createdAt: appliedAt, deliveredAt: appliedAt, readAt: chance(0.7) ? new Date(t + HOUR) : null });

      const move = (to: AppState, afterH: number) => {
        const at = t + afterH * HOUR;
        if (at > NOW) return false;
        events.push({ applicationId: id, actorId: opp.posterId, fromState: state, toState: to, createdAt: new Date(at) });
        notifications.push({ userId: st.id, type: "application.status_changed", payload: { applicationId: id, from: state, to }, createdAt: new Date(at), deliveredAt: new Date(at), readAt: chance(0.6) ? new Date(at + 2 * HOUR) : null });
        if (!firstTransitionAt) firstTransitionAt = new Date(at);
        state = to;
        t = at;
        return true;
      };

      if (chance(profile.ackRate) && move(chance(0.45) ? "SHORTLISTED" : "REJECTED", int(profile.delayH[0], profile.delayH[1]))) {
        if (state === "REJECTED") rejectionCode = pick(REJECT);
        if (state === "SHORTLISTED" && chance(0.6) && move("INTERVIEW", int(24, 120))) {
          const seatsLeft = opp.seatCount - (seatsTaken.get(opp.id) ?? 0);
          if (chance(0.45) && seatsLeft > 0 && move("SELECTED", int(24, 96))) {
            seatsTaken.set(opp.id, (seatsTaken.get(opp.id) ?? 0) + 1);
            selectedApps.push({ id, studentId: st.id, posterId: opp.posterId, oppId: opp.id, at: new Date(t) });
          } else if (chance(0.5) && move("REJECTED", int(24, 96))) {
            rejectionCode = pick(REJECT);
          }
        }
      }
      // Some students give up on a silent posting.
      if (state === "APPLIED" && chance(0.08)) {
        const at = t + int(72, 240) * HOUR;
        if (at < NOW) {
          events.push({ applicationId: id, actorId: st.id, fromState: "APPLIED", toState: "WITHDRAWN", createdAt: new Date(at) });
          state = "WITHDRAWN";
        }
      }
      if (["APPLIED", "SHORTLISTED", "INTERVIEW"].includes(state)) activeCount.set(st.id, (activeCount.get(st.id) ?? 0) + 1);
      if (firstTransitionAt) acknowledgedApps.push({ id, studentId: st.id, posterId: opp.posterId, at: firstTransitionAt });

      applications.push({ id, opportunityId: opp.id, studentId: st.id, status: state, appliedAt, firstTransitionAt, rejectionCode, createdAt: appliedAt });
    }
  }
  await prisma.application.createMany({ data: applications });
  for (let i = 0; i < events.length; i += 5000) await prisma.applicationEvent.createMany({ data: events.slice(i, i + 5000) });
  for (const [oppId, n] of seatsTaken) await prisma.opportunity.update({ where: { id: oppId }, data: { seatsFilled: n } });
  console.log(`applications: ${applications.length}, events: ${events.length}`);

  // Attestations on some completed engagements
  const attestations: Prisma.AttestationCreateManyInput[] = [];
  for (const a of selectedApps) {
    const mine = [...studentInfo.get(a.studentId)!.skills];
    if (!mine.length || !chance(0.6)) continue;
    for (const skillId of sample(mine, int(1, 2))) {
      attestations.push({ applicationId: a.id, skillId, issuerId: a.posterId, context: "Worked on this during the engagement and did it well.", createdAt: new Date(a.at.getTime() + 7 * DAY < NOW ? a.at.getTime() + 7 * DAY : a.at.getTime()) });
    }
  }
  await prisma.attestation.createMany({ data: attestations });

  // Message threads on a share of acknowledged applications
  const threads: Prisma.MessageThreadCreateManyInput[] = [];
  const messages: Prisma.MessageCreateManyInput[] = [];
  for (const a of acknowledgedApps) {
    if (!chance(0.18)) continue;
    const threadId = randomUUID();
    threads.push({ id: threadId, applicationId: a.id, createdAt: a.at });
    let at = a.at.getTime();
    for (let m = 0; m < int(2, 6); m++) {
      at += int(1, 30) * HOUR;
      if (at > NOW) break;
      const fromPoster = m % 2 === 0;
      messages.push({ threadId, senderId: fromPoster ? a.posterId : a.studentId, body: pick(fromPoster ? MESSAGES_FROM_POSTER : MESSAGES_FROM_STUDENT), createdAt: new Date(at) });
    }
  }
  await prisma.messageThread.createMany({ data: threads });
  await prisma.message.createMany({ data: messages });

  for (let i = 0; i < notifications.length; i += 5000) await prisma.notification.createMany({ data: notifications.slice(i, i + 5000) });
  console.log(`attestations: ${attestations.length}, threads: ${threads.length}, messages: ${messages.length}, notifications: ${notifications.length}`);

  // Teams
  let teamCount = 0;
  const leads = sample(students, SCALE.teams);
  for (const lead of leads) {
    const createdAt = new Date(NOW - int(1, 60) * DAY);
    const teamId = randomUUID();
    const roles = sample(TEAM_ROLES, int(2, 4)).map((label) => ({ id: randomUUID(), label, slotCount: int(1, 2) }));
    await prisma.team.create({
      data: {
        id: teamId,
        leadId: lead.id,
        name: `${pick(["Team", "Squad", "Crew"])} ${pick(["Nightowls", "Byte Club", "Null Pointers", "Circuit Breakers", "Stack Smashers", "Pixel Pushers", "Quantum Leap", "Code Blooded", "Ctrl Alt Elite", "Bit Brigade"])} ${int(1, 99)}`,
        hackathon: pick(HACKATHONS),
        description: chance(0.7) ? "Building something useful in 36 hours. We want people who enjoy shipping under pressure." : null,
        eventDate: chance(0.7) ? new Date(NOW + int(3, 45) * DAY) : null,
        createdAt,
        roles: {
          create: roles.map((r) => ({
            id: r.id,
            label: r.label,
            slotCount: r.slotCount,
            skills: { create: sample(skills, int(0, 3)).map((k) => ({ skillId: k.id })) },
          })),
        },
      },
    });

    let allFull = true;
    const onTeam = new Set([lead.id]);
    for (const role of roles) {
      let filled = 0;
      for (const st of sample(students, int(0, 5))) {
        if (onTeam.has(st.id)) continue;
        const status = filled < role.slotCount && chance(0.5) ? "ACCEPTED" : weighted<"PENDING" | "REJECTED" | "WITHDRAWN">([["PENDING", 60], ["REJECTED", 30], ["WITHDRAWN", 10]]);
        const at = new Date(createdAt.getTime() + int(1, 72) * HOUR);
        await prisma.teamJoinRequest.create({
          data: {
            teamRoleId: role.id,
            studentId: st.id,
            message: chance(0.6) ? "I'd love to help - I have built something similar before." : null,
            status,
            rejectionCode: status === "REJECTED" ? "SEATS_FILLED" : null,
            createdAt: at,
          },
        });
        if (status === "ACCEPTED") {
          filled++;
          onTeam.add(st.id);
          await prisma.teamMember.create({ data: { teamId, userId: st.id, roleId: role.id, joinedAt: new Date(at.getTime() + int(1, 48) * HOUR) } });
        }
      }
      if (filled) await prisma.teamRole.update({ where: { id: role.id }, data: { slotsFilled: filled } });
      if (filled < role.slotCount) allFull = false;
    }
    if (allFull) await prisma.team.update({ where: { id: teamId }, data: { status: "LOCKED" } });
    else if (chance(0.08)) await prisma.team.update({ where: { id: teamId }, data: { status: "CLOSED" } });
    teamCount++;
  }
  console.log(`teams: ${teamCount}`);

  // Moderation queue + alumni claims waiting for review
  for (const opp of sample(opps.filter((o) => o.status === "LIVE"), 6)) {
    await prisma.flag.create({
      data: { opportunityId: opp.id, reporterId: pick(students).id, reason: pick(["SPAM", "MISLEADING", "DUPLICATE", "OTHER"] as const), detail: "The description does not match what was discussed." },
    });
  }
  for (const a of sample(alumni, 5)) {
    await prisma.alumniClaim.create({
      data: { userId: a.id, rollNo: `10${int(1000000, 9999999)}`, gradYear: int(2015, 2024), degree: "B.E. Computer Engineering", proofUrl: "https://example.test/degree.pdf" },
    });
  }

  // At-risk: the same predicate the SLA sweep uses (opportunity.service.ts).
  const atRisk = await prisma.$executeRaw`
    UPDATE opportunities o SET status = 'AT_RISK'::"OppStatus"
    WHERE o.status = 'LIVE'::"OppStatus" AND EXISTS (
      SELECT 1 FROM applications a
      WHERE a.opportunity_id = o.id AND a.status = 'APPLIED'::"AppState" AND a.first_transition_at IS NULL
        AND a.applied_at < now() - (CASE o.sla_pledge WHEN 'H24'::"SlaPledge" THEN interval '24 hours'
          WHEN 'H48'::"SlaPledge" THEN interval '48 hours' ELSE interval '7 days' END))`;
  console.log(`at-risk postings: ${atRisk}`);

  // Sample logins by role, so the team knows where to look.
  const sampleOf = (xs: { email: string }[]) => xs[0]!.email;
  console.log("\nsign in with the DEMO_PASSWORD from .env.demo.local:");
  console.log(`  super admin  ${superAdmin.email}   (at /admin)`);
  console.log(`  admin        ${sampleOf(admins)}   (at /admin)`);
  console.log(`  student      ${sampleOf(students)}`);
  console.log(`  faculty      ${sampleOf(faculty)}`);
  console.log(`  alumni       ${sampleOf(alumni)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
