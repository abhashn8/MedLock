"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HsAlertBanner } from "@/components/hipaa-shield/HsAlertBanner";
import { HsModal } from "@/components/hipaa-shield/HsModal";
import { HsPrimaryButton } from "@/components/hipaa-shield/HsPrimaryButton";
import { HsReadOnlyBanner } from "@/components/hipaa-shield/HsReadOnlyBanner";
import { HsSecondaryButton } from "@/components/hipaa-shield/HsSecondaryButton";
import { HsTextInput } from "@/components/hipaa-shield/HsTextInput";
import { useDashboardRbac } from "@/lib/rbac/context";
import { cn } from "@/lib/utils";

type CourseCategory =
  | "Privacy"
  | "Security"
  | "Administrative"
  | "Technical / Software"
  | "Physical"
  | "Breach"
  | "Business Associates"
  | "De-identification";

type CourseLevel = "Foundation" | "Intermediate" | "Advanced";

type LessonModule = {
  title: string;
  minutes: number;
  summary: string;
};

type TrainingCourseLibraryItem = {
  id: string;
  title: string;
  category: CourseCategory;
  level: CourseLevel;
  audience: string[];
  durationMinutes: number;
  status: "Ready" | "Recommended" | "Advanced";
  description: string;
  objectives: string[];
  modules: LessonModule[];
  checkpoints: string[];
};

const categories: Array<CourseCategory | "All"> = [
  "All",
  "Privacy",
  "Security",
  "Administrative",
  "Technical / Software",
  "Physical",
  "Breach",
  "Business Associates",
  "De-identification",
];

const courses: TrainingCourseLibraryItem[] = [
  {
    id: "privacy-fundamentals",
    title: "HIPAA Privacy Fundamentals",
    category: "Privacy",
    level: "Foundation",
    audience: ["All workforce", "Privacy Officer", "Compliance Manager"],
    durationMinutes: 35,
    status: "Ready",
    description:
      "A plain-language introduction to PHI, permitted uses and disclosures, patient rights, and how minimum necessary decisions show up in everyday work.",
    objectives: [
      "Identify PHI across paper, oral, and electronic contexts.",
      "Apply minimum necessary thinking before sharing information.",
      "Recognize patient rights and escalation points.",
    ],
    modules: [
      { title: "What counts as PHI", minutes: 8, summary: "Identifiers, treatment context, billing data, and operational examples." },
      { title: "Permitted uses and disclosures", minutes: 12, summary: "Treatment, payment, operations, authorizations, and exceptions." },
      { title: "Patient rights", minutes: 10, summary: "Access, amendment, restrictions, confidential communications, and accounting requests." },
      { title: "Privacy judgment scenarios", minutes: 5, summary: "Short cases for minimum necessary decisions." },
    ],
    checkpoints: ["Scenario quiz", "Privacy acknowledgement", "Manager sign-off for high-access roles"],
  },
  {
    id: "minimum-necessary",
    title: "Minimum Necessary and PHI Disclosure",
    category: "Privacy",
    level: "Intermediate",
    audience: ["Privacy Officer", "Auditor", "Support teams"],
    durationMinutes: 28,
    status: "Recommended",
    description:
      "Teaches staff how to reduce unnecessary exposure by limiting PHI to what is needed for the purpose, audience, and workflow.",
    objectives: [
      "Map a request to the smallest useful PHI set.",
      "Spot disclosures that need privacy review.",
      "Document decisions for audit-ready evidence.",
    ],
    modules: [
      { title: "Disclosure purpose", minutes: 7, summary: "Treatment, operations, reporting, and support examples." },
      { title: "Data minimization patterns", minutes: 8, summary: "Field-level reduction, redaction, and summaries." },
      { title: "Approval handoffs", minutes: 6, summary: "When to involve the privacy officer or legal reviewer." },
      { title: "Audit evidence", minutes: 7, summary: "How to record a decision without creating extra PHI risk." },
    ],
    checkpoints: ["Disclosure worksheet", "Minimum necessary quiz", "Sample audit note"],
  },
  {
    id: "patient-rights",
    title: "Patient Rights and Access Requests",
    category: "Privacy",
    level: "Intermediate",
    audience: ["Privacy Officer", "Compliance Manager", "Front office"],
    durationMinutes: 30,
    status: "Ready",
    description:
      "Covers access requests, identity verification, amendment requests, restrictions, and handling confidential communication preferences.",
    objectives: [
      "Route patient access requests correctly.",
      "Understand timing and verification expectations.",
      "Recognize when a denial or exception needs review.",
    ],
    modules: [
      { title: "Request intake", minutes: 7, summary: "Identity, scope, format, and requester expectations." },
      { title: "Access and amendment", minutes: 9, summary: "Operational workflow for access and record correction." },
      { title: "Restrictions and confidential communications", minutes: 7, summary: "How preferences are captured and honored." },
      { title: "Escalation cases", minutes: 7, summary: "Complex cases that need privacy officer review." },
    ],
    checkpoints: ["Access workflow simulation", "Identity verification checklist"],
  },
  {
    id: "security-awareness",
    title: "HIPAA Security Awareness",
    category: "Security",
    level: "Foundation",
    audience: ["All workforce", "Security Officer", "Developer"],
    durationMinutes: 30,
    status: "Ready",
    description:
      "The baseline security course for protecting ePHI: passwords, MFA, phishing, device hygiene, suspicious activity, and reporting.",
    objectives: [
      "Recognize common ePHI security risks.",
      "Use access, MFA, and device safeguards correctly.",
      "Report suspicious events quickly and accurately.",
    ],
    modules: [
      { title: "ePHI risk basics", minutes: 6, summary: "Confidentiality, integrity, availability, and practical examples." },
      { title: "Authentication and MFA", minutes: 7, summary: "Strong authentication, shared-account risks, and remote access." },
      { title: "Phishing and malware", minutes: 8, summary: "How attacks look and what to do before clicking." },
      { title: "Report fast", minutes: 9, summary: "What to report, to whom, and what not to investigate alone." },
    ],
    checkpoints: ["Security quiz", "Phishing simulation", "MFA attestation"],
  },
  {
    id: "admin-safeguards",
    title: "Administrative Safeguards and Workforce Responsibilities",
    category: "Administrative",
    level: "Intermediate",
    audience: ["Admin", "Compliance Manager", "Security Officer"],
    durationMinutes: 42,
    status: "Recommended",
    description:
      "A management-oriented course covering risk analysis, risk management, workforce security, policies, sanctions, and periodic review.",
    objectives: [
      "Explain how risk analysis supports HIPAA security decisions.",
      "Connect workforce roles to access and training obligations.",
      "Use policies, sanctions, and reviews as compliance evidence.",
    ],
    modules: [
      { title: "Risk analysis lifecycle", minutes: 10, summary: "Identifying threats, likelihood, impact, and remediation." },
      { title: "Workforce security", minutes: 9, summary: "Authorization, supervision, termination, and role changes." },
      { title: "Policies and sanctions", minutes: 9, summary: "How documented rules become enforceable controls." },
      { title: "Review cadence", minutes: 14, summary: "Access reviews, training refreshers, and evidence exports." },
    ],
    checkpoints: ["Risk analysis worksheet", "Policy review acknowledgement", "Access review exercise"],
  },
  {
    id: "technical-software",
    title: "Technical Safeguards for Software Teams",
    category: "Technical / Software",
    level: "Advanced",
    audience: ["Developer", "Security Officer", "Data Analyst"],
    durationMinutes: 48,
    status: "Advanced",
    description:
      "Software-focused training on access control, encryption, audit controls, secure logs, PHI-safe development, and production support.",
    objectives: [
      "Design software access boundaries for ePHI.",
      "Use encryption, audit logging, and session safeguards properly.",
      "Avoid leaking PHI through logs, exports, or test fixtures.",
    ],
    modules: [
      { title: "Access control design", minutes: 10, summary: "Least privilege, RBAC, session controls, and admin paths." },
      { title: "Encryption and transmission", minutes: 8, summary: "At rest, in transit, secrets, TLS, and key handling." },
      { title: "Audit logs and integrity", minutes: 9, summary: "What to log, how to avoid PHI leakage, and tamper-evident trails." },
      { title: "Secure SDLC for PHI", minutes: 12, summary: "Code review, test data, incident playbooks, and change control." },
      { title: "Production support", minutes: 9, summary: "Screenshares, debug traces, and emergency access expectations." },
    ],
    checkpoints: ["Secure logging checklist", "RBAC design review", "PHI-safe test data exercise"],
  },
  {
    id: "access-controls",
    title: "Access Control, MFA, Encryption, and Audit Logs",
    category: "Technical / Software",
    level: "Intermediate",
    audience: ["Security Officer", "Admin", "Developer"],
    durationMinutes: 38,
    status: "Recommended",
    description:
      "Hands-on technical safeguards training focused on accounts, MFA, encryption decisions, audit log review, and alert escalation.",
    objectives: [
      "Understand unique user identification and access review.",
      "Explain when encryption and MFA reduce ePHI risk.",
      "Review audit events for suspicious behavior.",
    ],
    modules: [
      { title: "Identity and unique users", minutes: 8, summary: "No shared users, role changes, and account disablement." },
      { title: "MFA and remote access", minutes: 8, summary: "Cloud apps, admin sessions, and recovery risks." },
      { title: "Encryption decisions", minutes: 8, summary: "Transport, storage, exports, and backup considerations." },
      { title: "Audit log review", minutes: 14, summary: "What events matter and how to escalate anomalies." },
    ],
    checkpoints: ["Audit review drill", "MFA exception workflow", "Encryption control quiz"],
  },
  {
    id: "physical-safeguards",
    title: "Physical Safeguards for Workstations and Facilities",
    category: "Physical",
    level: "Foundation",
    audience: ["All workforce", "Security Officer", "Operations"],
    durationMinutes: 26,
    status: "Ready",
    description:
      "Practical safeguards for workstations, facility access, paper PHI, screens, visitors, remote work, and device disposal.",
    objectives: [
      "Protect PHI in physical and remote work environments.",
      "Recognize workstation and facility access risks.",
      "Handle device movement, loss, and disposal correctly.",
    ],
    modules: [
      { title: "Facility and visitor access", minutes: 6, summary: "Badges, escorting, restricted areas, and records." },
      { title: "Workstation use", minutes: 7, summary: "Screen positioning, locking, printing, and clean desk practices." },
      { title: "Remote work safeguards", minutes: 7, summary: "Private space, secure networks, family/roommate exposure, and travel." },
      { title: "Device lifecycle", minutes: 6, summary: "Inventory, loss reporting, disposal, and media reuse." },
    ],
    checkpoints: ["Clean desk attestation", "Remote work checklist", "Device loss scenario"],
  },
  {
    id: "breach-notification",
    title: "Breach Awareness and Notification Workflow",
    category: "Breach",
    level: "Intermediate",
    audience: ["All workforce", "Privacy Officer", "Security Officer"],
    durationMinutes: 34,
    status: "Ready",
    description:
      "Explains what may be a breach, how to report quickly, what details to preserve, and how notifications are coordinated.",
    objectives: [
      "Recognize suspected impermissible use or disclosure.",
      "Escalate incidents without delaying investigation.",
      "Understand risk assessment and notification workflow.",
    ],
    modules: [
      { title: "What might be a breach", minutes: 8, summary: "Impermissible use/disclosure, unsecured PHI, and exceptions." },
      { title: "First-hour reporting", minutes: 8, summary: "What to capture and what not to alter." },
      { title: "Risk assessment factors", minutes: 9, summary: "Nature of PHI, unauthorized recipient, acquisition/viewing, and mitigation." },
      { title: "Notification operations", minutes: 9, summary: "Individual, regulator, media, and business associate workflows." },
    ],
    checkpoints: ["Breach scenario simulation", "Notification timeline quiz", "Escalation checklist"],
  },
  {
    id: "business-associates",
    title: "Business Associates, BAAs, and Subcontractors",
    category: "Business Associates",
    level: "Intermediate",
    audience: ["Privacy Officer", "Compliance Manager", "Security Officer"],
    durationMinutes: 36,
    status: "Recommended",
    description:
      "Covers vendor due diligence, Business Associate Agreements, subcontractor tracking, evidence requests, and renewal workflows.",
    objectives: [
      "Identify when a vendor is a business associate.",
      "Know what BAA and sub-BAA evidence should cover.",
      "Connect vendor risk scores to remediation decisions.",
    ],
    modules: [
      { title: "Business associate triggers", minutes: 8, summary: "PHI access, processing, storage, support, and analytics examples." },
      { title: "BAA evidence", minutes: 8, summary: "Agreement scope, signed artifacts, expiration, and covered services." },
      { title: "Subcontractors", minutes: 8, summary: "Flow-down obligations and sub-BAA tracking." },
      { title: "Vendor risk operations", minutes: 12, summary: "Risk scores, certifications, renewals, and remediation." },
    ],
    checkpoints: ["Vendor classification quiz", "BAA evidence review", "Subcontractor register exercise"],
  },
  {
    id: "secure-messaging",
    title: "Secure Messaging and Emailing PHI",
    category: "Security",
    level: "Foundation",
    audience: ["All workforce", "Privacy Officer", "Support teams"],
    durationMinutes: 24,
    status: "Ready",
    description:
      "Practical guidance for sending PHI: verifying recipients, limiting content, using secure channels, and responding to misdirected messages.",
    objectives: [
      "Verify recipient identity and authority before sharing.",
      "Reduce PHI in messages and attachments.",
      "Escalate misdirected messages quickly.",
    ],
    modules: [
      { title: "Recipient verification", minutes: 6, summary: "Identity, authority, and address confirmation." },
      { title: "Message minimization", minutes: 6, summary: "Subject lines, attachments, screenshots, and secure portal use." },
      { title: "Secure channel selection", minutes: 6, summary: "Email, portal, phone, mail, and patient preference considerations." },
      { title: "Misdirected messages", minutes: 6, summary: "Containment, reporting, and documentation." },
    ],
    checkpoints: ["Secure message checklist", "Misdirected email scenario"],
  },
  {
    id: "deidentification-basics",
    title: "De-identification Basics",
    category: "De-identification",
    level: "Intermediate",
    audience: ["Data Analyst", "Privacy Officer", "Developer"],
    durationMinutes: 32,
    status: "Recommended",
    description:
      "Introduces de-identification concepts, direct identifiers, residual risk, expert determination, and when to ask privacy leadership.",
    objectives: [
      "Recognize direct and indirect identifiers.",
      "Explain why de-identification is not just removing names.",
      "Know when expert determination or privacy review is needed.",
    ],
    modules: [
      { title: "Identifier patterns", minutes: 8, summary: "Names, geography, dates, device identifiers, and account numbers." },
      { title: "Safe harbor mindset", minutes: 8, summary: "Common identifier classes and operational pitfalls." },
      { title: "Expert determination", minutes: 8, summary: "Residual risk, statistical context, and documentation." },
      { title: "Analytics workflows", minutes: 8, summary: "Exports, dashboards, model prompts, and review checkpoints." },
    ],
    checkpoints: ["Identifier spotting exercise", "Export review checklist", "Privacy escalation scenario"],
  },
];

const categoryStyles: Record<CourseCategory, string> = {
  Privacy: "border-teal-200 bg-teal-50 text-teal-700",
  Security: "border-red-200 bg-red-50 text-red-700",
  Administrative: "border-blue-200 bg-blue-50 text-blue-700",
  "Technical / Software": "border-purple-200 bg-purple-50 text-purple-700",
  Physical: "border-amber-200 bg-amber-50 text-amber-700",
  Breach: "border-rose-200 bg-rose-50 text-rose-700",
  "Business Associates": "border-indigo-200 bg-indigo-50 text-indigo-700",
  "De-identification": "border-gray-200 bg-gray-50 text-gray-700",
};

function minutesLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

export default function TrainingCourseLibraryPage() {
  const rbac = useDashboardRbac();
  const canWrite = rbac.canWritePage("training_course_library");
  const readOnly = rbac.permissionFor("training_course_library") === "read_only";
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<CourseCategory | "All">("All");
  const [activeLevel, setActiveLevel] = useState<CourseLevel | "All">("All");
  const [selectedCourse, setSelectedCourse] = useState<TrainingCourseLibraryItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filteredCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter((courseItem) => {
      const matchesCategory = activeCategory === "All" || courseItem.category === activeCategory;
      const matchesLevel = activeLevel === "All" || courseItem.level === activeLevel;
      const haystack = [
        courseItem.title,
        courseItem.category,
        courseItem.level,
        courseItem.description,
        courseItem.audience.join(" "),
        courseItem.objectives.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return matchesCategory && matchesLevel && (!q || haystack.includes(q));
    });
  }, [activeCategory, activeLevel, search]);

  const stats = useMemo(() => {
    const totalMinutes = courses.reduce((sum, courseItem) => sum + courseItem.durationMinutes, 0);
    const lessonCount = courses.reduce((sum, courseItem) => sum + courseItem.modules.length, 0);
    return {
      courses: courses.length,
      categories: categories.length - 1,
      lessons: lessonCount,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    };
  }, []);

  function showPlaceholder(action: string) {
    setNotice(`${action} is ready as a UI action. Real persistence can be wired to training_courses next.`);
  }

  return (
    <div className="min-h-full bg-hs-page px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[1280px] space-y-6">
        {readOnly ? <HsReadOnlyBanner /> : null}
        {notice ? (
          <HsAlertBanner variant="INFO" onDismiss={() => setNotice(null)}>
            {notice}
          </HsAlertBanner>
        ) : null}

        <section className="rounded-hs-card border border-hs-border bg-hs-card p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-hs-caption font-semibold uppercase tracking-[0.1em] text-hs-primary">Workforce LMS</p>
              <h1 className="mt-2 text-hs-title font-semibold text-hs-text">Training Course Library</h1>
              <p className="mt-2 text-hs-body text-hs-muted">
                A book-style HIPAA lesson library organized around Privacy, Security, Breach Notification, and the
                administrative, technical, and physical safeguards used to protect PHI and ePHI.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-hs-pill border border-hs-border bg-hs-fill px-3 py-1 text-hs-caption font-medium text-hs-muted">
                  HHS/OCR topic structure
                </span>
                <span className="rounded-hs-pill border border-hs-border bg-hs-fill px-3 py-1 text-hs-caption font-medium text-hs-muted">
                  LMS-ready lessons
                </span>
                <Link
                  href="/dashboard/training-tracker"
                  className="rounded-hs-pill border border-hs-border bg-hs-card px-3 py-1 text-hs-caption font-medium text-hs-primary underline"
                >
                  Training tracker
                </Link>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {canWrite ? (
                <>
                  <HsSecondaryButton type="button" onClick={() => showPlaceholder("Assign bundle")}>
                    Assign bundle
                  </HsSecondaryButton>
                  <HsPrimaryButton type="button" onClick={() => showPlaceholder("Create course")}>
                    Create course
                  </HsPrimaryButton>
                </>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <article className="rounded-hs-card border border-hs-border bg-hs-card p-5 shadow-sm">
            <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Courses</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-hs-text">{stats.courses}</p>
            <p className="mt-1 text-sm text-hs-muted">Ready-to-assign lessons</p>
          </article>
          <article className="rounded-hs-card border border-hs-border bg-hs-card p-5 shadow-sm">
            <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Categories</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-hs-text">{stats.categories}</p>
            <p className="mt-1 text-sm text-hs-muted">Privacy, security, safeguards, breach</p>
          </article>
          <article className="rounded-hs-card border border-hs-border bg-hs-card p-5 shadow-sm">
            <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Lessons</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-hs-text">{stats.lessons}</p>
            <p className="mt-1 text-sm text-hs-muted">Short modules inside courses</p>
          </article>
          <article className="rounded-hs-card border border-hs-border bg-hs-card p-5 shadow-sm">
            <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Seat time</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-hs-text">{stats.totalHours}h</p>
            <p className="mt-1 text-sm text-hs-muted">Complete library estimate</p>
          </article>
        </section>

        <section className="rounded-hs-card border border-hs-border bg-hs-card p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <HsTextInput
              label="Search library"
              placeholder="Search PHI, breach, MFA, vendors, safeguards…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-hs-secondary font-medium text-hs-text">Level</span>
              <select
                value={activeLevel}
                onChange={(event) => setActiveLevel(event.target.value as CourseLevel | "All")}
                className="h-10 rounded-hs border border-hs-border bg-hs-card px-3 text-hs-body text-hs-text focus:outline-none focus:shadow-hs-focus"
              >
                <option value="All">All levels</option>
                <option value="Foundation">Foundation</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </label>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={cn(
                  "whitespace-nowrap rounded-hs-pill border px-3 py-1.5 text-sm font-medium transition-colors",
                  activeCategory === category
                    ? "border-hs-primary bg-hs-primary text-white"
                    : "border-hs-border bg-hs-card text-hs-muted hover:bg-hs-fill",
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          {filteredCourses.map((courseItem) => (
            <article
              key={courseItem.id}
              className="flex min-h-[360px] flex-col rounded-hs-card border border-hs-border bg-hs-card p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    "rounded-hs-pill border px-2.5 py-1 text-hs-caption font-medium",
                    categoryStyles[courseItem.category],
                  )}
                >
                  {courseItem.category}
                </span>
                <span className="rounded-hs-pill bg-hs-fill px-2.5 py-1 text-hs-caption font-medium text-hs-muted">
                  {courseItem.level}
                </span>
              </div>
              <h2 className="mt-4 text-lg font-semibold leading-snug text-hs-text">{courseItem.title}</h2>
              <p className="mt-2 line-clamp-4 text-sm leading-6 text-hs-muted">{courseItem.description}</p>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-hs bg-hs-page px-2 py-2">
                  <p className="text-hs-caption text-hs-muted">Duration</p>
                  <p className="text-sm font-semibold text-hs-text">{minutesLabel(courseItem.durationMinutes)}</p>
                </div>
                <div className="rounded-hs bg-hs-page px-2 py-2">
                  <p className="text-hs-caption text-hs-muted">Lessons</p>
                  <p className="text-sm font-semibold text-hs-text">{courseItem.modules.length}</p>
                </div>
                <div className="rounded-hs bg-hs-page px-2 py-2">
                  <p className="text-hs-caption text-hs-muted">Status</p>
                  <p className="text-sm font-semibold text-hs-text">{courseItem.status}</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Objectives</p>
                <ul className="mt-2 space-y-1.5 text-sm text-hs-muted">
                  {courseItem.objectives.slice(0, 2).map((objective) => (
                    <li key={objective} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-hs-primary" aria-hidden />
                      <span>{objective}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-auto pt-5">
                <HsSecondaryButton type="button" className="w-full" onClick={() => setSelectedCourse(courseItem)}>
                  Open course book
                </HsSecondaryButton>
              </div>
            </article>
          ))}
        </section>

        {filteredCourses.length === 0 ? (
          <section className="rounded-hs-card border border-hs-border bg-hs-card p-8 text-center">
            <h2 className="text-hs-section font-semibold text-hs-text">No courses found</h2>
            <p className="mt-2 text-hs-body text-hs-muted">Try a broader search or choose “All” categories.</p>
          </section>
        ) : null}
      </div>

      <HsModal
        open={Boolean(selectedCourse)}
        onClose={() => setSelectedCourse(null)}
        title={selectedCourse?.title ?? "Course"}
        className="max-w-[760px]"
        footer={
          <>
            <HsSecondaryButton type="button" onClick={() => setSelectedCourse(null)}>
              Close
            </HsSecondaryButton>
            {canWrite ? (
              <HsPrimaryButton type="button" onClick={() => showPlaceholder("Assign selected course")}>
                Assign selected course
              </HsPrimaryButton>
            ) : null}
          </>
        }
      >
        {selectedCourse ? (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <span
                className={cn(
                  "rounded-hs-pill border px-2.5 py-1 text-hs-caption font-medium",
                  categoryStyles[selectedCourse.category],
                )}
              >
                {selectedCourse.category}
              </span>
              <span className="rounded-hs-pill bg-hs-fill px-2.5 py-1 text-hs-caption font-medium text-hs-muted">
                {selectedCourse.level}
              </span>
              <span className="rounded-hs-pill bg-hs-fill px-2.5 py-1 text-hs-caption font-medium text-hs-muted">
                {minutesLabel(selectedCourse.durationMinutes)}
              </span>
            </div>

            <div>
              <h3 className="text-base font-semibold text-hs-text">About this course</h3>
              <p className="mt-2 text-sm leading-6 text-hs-muted">{selectedCourse.description}</p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-hs-text">Lesson outline</h3>
              <ol className="mt-3 space-y-3">
                {selectedCourse.modules.map((moduleItem, index) => (
                  <li key={moduleItem.title} className="rounded-hs border border-hs-border bg-hs-page p-3">
                    <div className="flex items-start gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-hs-primary/10 text-hs-caption font-semibold text-hs-primary">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-hs-text">
                          {moduleItem.title} · {moduleItem.minutes}m
                        </p>
                        <p className="mt-1 text-sm leading-6 text-hs-muted">{moduleItem.summary}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-hs border border-hs-border bg-hs-card p-4">
                <h3 className="text-sm font-semibold text-hs-text">Learners should be able to</h3>
                <ul className="mt-2 space-y-2 text-sm text-hs-muted">
                  {selectedCourse.objectives.map((objective) => (
                    <li key={objective} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-hs-primary" aria-hidden />
                      <span>{objective}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-hs border border-hs-border bg-hs-card p-4">
                <h3 className="text-sm font-semibold text-hs-text">Evidence and checkpoints</h3>
                <ul className="mt-2 space-y-2 text-sm text-hs-muted">
                  {selectedCourse.checkpoints.map((checkpoint) => (
                    <li key={checkpoint} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-hs-primary" aria-hidden />
                      <span>{checkpoint}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-hs border border-hs-border bg-hs-fill p-4">
              <h3 className="text-sm font-semibold text-hs-text">Recommended roles</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedCourse.audience.map((audience) => (
                  <span key={audience} className="rounded-hs-pill bg-hs-card px-2.5 py-1 text-hs-caption font-medium text-hs-muted">
                    {audience}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </HsModal>
    </div>
  );
}
