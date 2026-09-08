# Thapar Nexus — PPT Content (6 slides)

Prof's brief: Introduction · Motivation · Societal Impact · Target Audience · Technology & Deployment · Limitations.
Team: **Harshdeep Athawale (1024031062) · Aakriti Chauhan (1024031055) · Sehaj Dhillon (1024030620)**

Written for a non-technical audience — no engineering/infrastructure terms (no CI/CD pipelines, GitHub Actions, rate limiting internals). Every slide is feature/product-level and written in depth, since this needs to stand fully on its own in front of the professor. The one exception is Slide 5, added at the professor's request to name the stack and deployment — kept light, not deep.

---

## Slide 1 — Introduction

**Title:** Thapar Nexus — A Verified Opportunity Pipeline for the Institute
**Content:**
- A single, verified platform where every real opportunity inside the institute — research assistantships, teaching assistantships, internships, hackathon teams, and alumni referrals — is posted, discovered, and tracked in one place, instead of scattered across WhatsApp groups and noticeboards.
- Every member's identity is verified before they can use the platform: students and faculty sign up with their official institute email and a one-time password, while alumni go through a manual claim-and-approve process — so postings and applicants are always genuine.
- Profiles are structured, not just a bio: branch, year, a verified list of skills, and past projects, giving faculty and alumni a real picture of a student instead of a resume that can say anything.
- Every posting is structured too — clear eligibility (branch, CGPA, backlogs), required skills, number of seats, a deadline, and a promised response time — so students know exactly what they're applying for and by when they'll hear back.
- Once a student applies, the application moves through a visible, tracked pipeline — Applied, Shortlisted, Interview, Selected or Rejected — and every step is time-stamped and permanent, so nothing gets quietly lost or edited after the fact.
- The platform's signature idea is accountability for silence: it measures exactly how long a poster takes to respond, and shows that as a public reliability score, so slow or unresponsive posters can no longer hide behind silence.
- Built-in messaging, notifications, and an admin oversight panel round out the experience — but every conversation is tied to a real application, not an open inbox, keeping the platform focused and safe.
- In one line: Thapar Nexus is not a social network or a feed — it's a pipeline that guarantees every application ends in a decision, and makes it visible when it doesn't.

**Speaker notes:** This slide should do the heavy lifting — walk through it slowly enough that the professor understands the full shape of the product (who joins, what they post, what happens to an application, and the responsiveness score) before the later slides build on it.

---

## Slide 2 — Motivation

**Title:** Why We Built This
**Content:**
- Inside the institute, real opportunities — a research seat with a professor, a TA position, an internship referral from an alumnus, a spot on a hackathon team — travel almost entirely through informal channels: WhatsApp groups, noticeboards, and word of mouth.
- That means visibility depends on who you know, not what you're capable of — a student outside the "right" group simply never hears about the opportunity in time to apply.
- The deeper, more painful problem is what happens after a student does apply: an email to a professor or a message to an alumnus can vanish into silence, with no way to know if it was rejected, still being considered, or never even opened.
- Every member of this team has lived this exact moment — writing to five or six professors, hearing back from none of them, and being left to guess whether to keep waiting, follow up, or give up and move on.
- That silence isn't just an inconvenience — it wastes a student's time, damages their confidence, and can quietly cost them a real opportunity they were genuinely qualified for.
- We wanted to fix this at the root instead of papering over it: rather than build one more place to "post and hope," we built a pipeline where every application is tracked to a real outcome, and every poster's responsiveness is visible and measured.

**Speaker notes:** Ground this in the lived, personal version of the story — the professor should recognize the "emailed five professors, heard back from none" moment as something real, not a hypothetical.

---

## Slide 3 — Societal Impact

**Title:** Why It Matters Beyond the App
**Content:**
- Levels the playing field: today, students who are already well-connected hear about opportunities first through informal networks; a single, searchable platform gives a first-year student with no connections the same access as a senior with the right group memberships.
- Restores trust between students and the faculty or alumni who post opportunities — a visible responsiveness record gives every poster a real incentive to reply, instead of just an informal expectation to.
- Protects merit: a skill a student claims will eventually need to be backed by an actual completed opportunity, not just typed onto a profile, so competency can't be exaggerated or faked.
- Reduces the anxiety and wasted energy that comes from not knowing where you stand — a student can see exactly what stage their application is at, instead of refreshing their inbox for weeks wondering if anyone even saw it.
- Keeps alumni meaningfully connected to their alma mater after they lose their institute email — giving back through referrals and mentorship becomes easy and structured instead of informal and ad hoc.
- Makes the campus safer by design: all communication happens inside the context of a real application, so there's no open, unattached messaging that could be misused.
- The model isn't specific to one institute — any college or university facing the same "WhatsApp group and word of mouth" problem could adopt the same idea.

**Speaker notes:** The equity point (first bullet) is the strongest one for a societal-impact framing — lead with it, since it reframes the whole project as fairness of access, not just convenience.

---

## Slide 4 — Target Audience

**Title:** Who It's For
**Content:**
- **Students** — the primary users. They sign up with their institute email, build a verified profile, discover opportunities that genuinely match their branch, year, and skills, apply within a fair limit so no one can spam every posting, and track every application in real time until it reaches a decision.
- **Faculty** — the people offering research and teaching opportunities. They post clearly defined openings, commit to a response-time promise, review applicants through a clean, ranked pipeline instead of a flooded inbox, and can vouch for a skill once a student has genuinely worked with them.
- **Alumni** — graduates who no longer have an institute email but still want to give back. They go through a one-time verification (proving their roll number and graduation year), after which they can post referrals, mentor current students, and share real interview experience.
- **Administrators** — the people responsible for keeping the whole system trustworthy. They approve alumni verification requests, step in on flagged or suspicious postings, maintain the master list of recognized skills, and keep an eye on how the platform is performing institute-wide.

**Speaker notes:** Frame these four as a loop, not four separate audiences — students apply, faculty and alumni respond and vouch, admins keep the whole loop honest.

---

## Slide 5 — Technology & Deployment

**Title:** How It's Built
**Content:**
- Built with **Next.js and TypeScript** — a modern, widely-used web framework that lets one codebase serve both the pages students see and the logic behind them.
- Data is stored in **PostgreSQL**, a mature, industry-standard database, hosted on **Supabase**.
- **Prisma** manages the database schema and every migration — a tracked, ordered change to the database's structure — so as features are added over time, the database evolves safely with a clear history instead of ad-hoc edits.
- The application is deployed as two connected pieces: the **frontend on Vercel** (what students, faculty, and alumni interact with) and the **backend on Render** (where data and business logic are handled), presented behind one single address so it feels like one seamless application.
- File storage (such as uploaded résumés) also runs on Supabase's storage service, alongside the database.

**Speaker notes:** Keep this one light — name the pieces (Next.js, TypeScript, PostgreSQL/Supabase, Prisma migrations, Vercel + Render) without going into how they talk to each other; that detail isn't needed for this audience.

---

## Slide 6 — Limitations

**Title:** What's Not There Yet
**Content:**
- Skill attestation — the idea that a professor or alumnus can vouch for a skill only after actually working with a student — is designed but not fully live yet; today, skills on a profile are still self-declared.
- Smart, automatic matching of students to the opportunities most relevant to them isn't built yet — students currently have to search and filter for themselves.
- There's no team-formation feature yet for students who want to find teammates for a hackathon or project together.
- Students can't yet save a search or get alerted the moment a new matching opportunity is posted — they have to check back themselves.
- Profiles don't yet support verified project links — projects are currently listed as-is, without an extra layer of verification.
- The platform is currently built and tested for one institute; opening it up to other colleges and universities is a future step.
- It hasn't yet been used day-to-day by a full batch of real students and faculty — the next step is a live pilot to see how it holds up at real scale.

**Speaker notes:** Close on honesty, not apology — every gap here is a known, named next step, not something we're hiding.
