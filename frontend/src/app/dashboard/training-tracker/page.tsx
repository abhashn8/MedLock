"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ROLE_DETAILS, ROLES, type Role, type RoleColor } from "@/lib/rbac/permissions";
import { useDashboardRbac } from "@/lib/rbac/context";
import { HsAlertBanner } from "@/components/hipaa-shield/HsAlertBanner";
import { HsPrimaryButton } from "@/components/hipaa-shield/HsPrimaryButton";
import { HsReadOnlyBanner } from "@/components/hipaa-shield/HsReadOnlyBanner";
import { HsSecondaryButton } from "@/components/hipaa-shield/HsSecondaryButton";
import { cn } from "@/lib/utils";

type CourseStatus = "PASS" | "WARNING" | "FAIL" | "PENDING";

type TrainingCourse = {
  key: "privacy" | "security" | "breach";
  title: string;
  category: string;
  durationMinutes: number;
  progress: number;
  status: CourseStatus;
  dueLabel: string;
  about: string;
  evidence: string;
};

type RoleTrainingMock = {
  overallCompletion: number;
  readinessLabel: string;
  managerNote: string;
  courses: TrainingCourse[];
};

const courseAbout: Record<TrainingCourse["key"], Pick<TrainingCourse, "title" | "category" | "durationMinutes" | "about">> = {
  privacy: {
    title: "HIPAA Privacy Fundamentals",
    category: "Privacy Rule",
    durationMinutes: 35,
    about:
      "Covers permitted uses and disclosures, minimum necessary practices, patient rights, and day-to-day PHI handling expectations.",
  },
  security: {
    title: "HIPAA Security Awareness",
    category: "Security Rule",
    durationMinutes: 30,
    about:
      "Covers access hygiene, incident reporting, workstation safeguards, MFA expectations, and recognizing suspicious activity.",
  },
  breach: {
    title: "Breach Awareness and Response",
    category: "Breach Response",
    durationMinutes: 25,
    about:
      "Covers recognizing potential breaches, escalation timelines, documentation, and when privacy/security leadership must be notified.",
  },
};

function course(
  key: TrainingCourse["key"],
  progress: number,
  status: CourseStatus,
  dueLabel: string,
  evidence: string,
): TrainingCourse {
  return {
    ...courseAbout[key],
    key,
    progress,
    status,
    dueLabel,
    evidence,
  };
}

const mockTrainingByRole: Record<Role, RoleTrainingMock> = {
  admin: {
    overallCompletion: 96,
    readinessLabel: "Executive ready",
    managerNote: "Admin track emphasizes access approvals, escalation ownership, and audit packet readiness.",
    courses: [
      course("privacy", 100, "PASS", "Complete", "Signed acknowledgement retained for annual review."),
      course("security", 100, "PASS", "Complete", "Completed with elevated-access attestation."),
      course("breach", 88, "WARNING", "Due in 5 days", "Needs final breach notification simulation."),
    ],
  },
  privacy_officer: {
    overallCompletion: 98,
    readinessLabel: "Privacy lead ready",
    managerNote: "Privacy track is strongest on patient rights, disclosure review, and breach notification ownership.",
    courses: [
      course("privacy", 100, "PASS", "Complete", "Privacy decision checklist accepted."),
      course("security", 94, "PASS", "Complete", "Security awareness refresher passed."),
      course("breach", 100, "PASS", "Complete", "Breach notification tabletop completed."),
    ],
  },
  security_officer: {
    overallCompletion: 91,
    readinessLabel: "Security ready",
    managerNote: "Security track focuses on access control, anomaly review, and technical safeguard response.",
    courses: [
      course("privacy", 82, "WARNING", "Due in 9 days", "Needs minimum-necessary review refresh."),
      course("security", 100, "PASS", "Complete", "Technical safeguards module passed."),
      course("breach", 92, "PASS", "Complete", "Incident escalation drill complete."),
    ],
  },
  compliance_manager: {
    overallCompletion: 87,
    readinessLabel: "Monitoring needed",
    managerNote: "Compliance track is on pace but still has open evidence export and remediation workflow lessons.",
    courses: [
      course("privacy", 92, "PASS", "Complete", "Policy workflow knowledge check passed."),
      course("security", 78, "WARNING", "Due in 7 days", "Needs security exceptions refresher."),
      course("breach", 90, "PASS", "Complete", "Corrective action workflow complete."),
    ],
  },
  auditor: {
    overallCompletion: 79,
    readinessLabel: "Read-only evidence pending",
    managerNote: "Auditor track needs stronger familiarity with evidence exports and access review language.",
    courses: [
      course("privacy", 84, "WARNING", "Due in 4 days", "Pending final patient-rights quiz."),
      course("security", 72, "WARNING", "Due in 10 days", "Needs audit log interpretation exercise."),
      course("breach", 80, "WARNING", "Due in 12 days", "Needs breach timeline review."),
    ],
  },
  data_analyst: {
    overallCompletion: 68,
    readinessLabel: "PHI handling risk",
    managerNote: "Data analyst track needs de-identification guardrails and PHI export handling reinforced.",
    courses: [
      course("privacy", 70, "WARNING", "Due in 3 days", "Needs PHI handling scenario review."),
      course("security", 62, "PENDING", "Due this week", "MFA and local export handling module incomplete."),
      course("breach", 72, "WARNING", "Due in 8 days", "Needs incident reporting handoff check."),
    ],
  },
  developer: {
    overallCompletion: 54,
    readinessLabel: "Overdue",
    managerNote: "Developer track is overdue on security awareness and breach reporting expectations for code/data access.",
    courses: [
      course("privacy", 66, "WARNING", "Due in 2 days", "Needs minimum-necessary refresher."),
      course("security", 48, "FAIL", "Overdue", "Secure SDLC and secrets handling module overdue."),
      course("breach", 48, "FAIL", "Overdue", "Breach escalation exercise not completed."),
    ],
  },
};

const statusStyles: Record<CourseStatus, string> = {
  PASS: "border-hs-success-border bg-hs-success-bg text-hs-success",
  WARNING: "border-[#FDE68A] bg-hs-warning-bg text-hs-warning",
  FAIL: "border-hs-danger-border bg-hs-danger-bg text-hs-danger",
  PENDING: "border-hs-border bg-hs-fill text-hs-muted",
};

const roleColorStyles: Record<RoleColor, string> = {
  purple: "bg-purple-500",
  teal: "bg-teal-500",
  red: "bg-red-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  gray: "bg-gray-500",
  pink: "bg-pink-500",
};

function isUrgentDue(label: string) {
  const lower = label.toLowerCase();
  return lower.includes("overdue") || lower.includes("this week") || lower.includes("2 days") || lower.includes("3 days");
}

export default function TrainingTrackerPage() {
  const rbac = useDashboardRbac();
  const canWrite = rbac.canWritePage("training_tracker");
  const readOnly = rbac.permissionFor("training_tracker") === "read_only";
  const [expandedRole, setExpandedRole] = useState<Role | null>("developer");
  const [notice, setNotice] = useState<string | null>(null);

  const stats = useMemo(() => {
    const rows = ROLES.map((role) => mockTrainingByRole[role]);
    const allCourses = rows.flatMap((row) => row.courses);
    const average = Math.round(rows.reduce((sum, row) => sum + row.overallCompletion, 0) / rows.length);
    const overdue = allCourses.filter((courseItem) => courseItem.status === "FAIL").length;
    const dueSoon = allCourses.filter((courseItem) => courseItem.status !== "PASS" && isUrgentDue(courseItem.dueLabel)).length;
    const onTrackRoles = rows.filter((row) => row.overallCompletion >= 85).length;

    return {
      average,
      overdue,
      dueSoon,
      onTrackRoles,
    };
  }, []);

  function showPlaceholder(action: string) {
    setNotice(`${action} is mocked for this training dashboard. Real assignment workflows can be wired to training_assignments next.`);
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
              <p className="text-hs-caption font-semibold uppercase tracking-[0.1em] text-hs-primary">Workforce</p>
              <h1 className="mt-2 text-hs-title font-semibold text-hs-text">Training tracker</h1>
              <p className="mt-2 text-hs-body text-hs-muted">
                A role-based HIPAA training readiness view for the seven MedLock roles. This mock shows progress,
                upcoming remediation, and what each role needs to understand before handling compliance workflows.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-hs-pill border border-hs-border bg-hs-fill px-3 py-1 text-hs-caption font-medium text-hs-muted">
                  7 roles tracked
                </span>
                <span className="rounded-hs-pill border border-hs-border bg-hs-fill px-3 py-1 text-hs-caption font-medium text-hs-muted">
                  HIPAA annual readiness
                </span>
                <Link
                  href="/dashboard/training-course-library"
                  className="rounded-hs-pill border border-hs-border bg-hs-card px-3 py-1 text-hs-caption font-medium text-hs-primary underline"
                >
                  Course library
                </Link>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {canWrite ? (
                <>
                  <HsSecondaryButton type="button" onClick={() => showPlaceholder("Send reminders")}>
                    Send reminders
                  </HsSecondaryButton>
                  <HsPrimaryButton type="button" onClick={() => showPlaceholder("Assign course")}>
                    Assign course
                  </HsPrimaryButton>
                </>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <article className="rounded-hs-card border border-hs-border bg-hs-card p-5 shadow-sm">
            <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Completion</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-hs-text">{stats.average}%</p>
            <p className="mt-1 text-sm text-hs-muted">Average across all seven roles</p>
          </article>
          <article className="rounded-hs-card border border-hs-border bg-hs-card p-5 shadow-sm">
            <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Overdue lessons</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-hs-danger">{stats.overdue}</p>
            <p className="mt-1 text-sm text-hs-muted">Requires manager follow-up</p>
          </article>
          <article className="rounded-hs-card border border-hs-border bg-hs-card p-5 shadow-sm">
            <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Due soon</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-hs-warning">{stats.dueSoon}</p>
            <p className="mt-1 text-sm text-hs-muted">Open items due this week</p>
          </article>
          <article className="rounded-hs-card border border-hs-border bg-hs-card p-5 shadow-sm">
            <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">On-track roles</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-hs-success">{stats.onTrackRoles}</p>
            <p className="mt-1 text-sm text-hs-muted">At or above 85% completion</p>
          </article>
        </section>

        <section className="rounded-hs-card border border-hs-border bg-hs-card p-6">
          <div className="mb-4">
            <h2 className="text-hs-section font-semibold text-hs-text">HIPAA curriculum</h2>
            <p className="mt-1 text-sm text-hs-muted">
              Three focused courses mirror the seed training content and are tailored by role below.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {Object.entries(courseAbout).map(([key, courseInfo]) => (
              <article key={key} className="rounded-hs border border-hs-border bg-hs-page p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-primary">
                      {courseInfo.category}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-hs-text">{courseInfo.title}</h3>
                  </div>
                  <span className="rounded-hs-pill bg-hs-fill px-2.5 py-1 text-hs-caption font-medium text-hs-muted">
                    {courseInfo.durationMinutes}m
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-hs-muted">{courseInfo.about}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-hs-section font-semibold text-hs-text">Role readiness board</h2>
            <p className="text-sm text-hs-muted">Seven MedLock roles with mock HIPAA progress and evidence notes.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {ROLES.map((role) => {
              const detail = ROLE_DETAILS[role];
              const training = mockTrainingByRole[role];
              const expanded = expandedRole === role;

              return (
                <article key={role} className="rounded-hs-card border border-hs-border bg-hs-card p-5 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("size-2.5 rounded-full", roleColorStyles[detail.color])} aria-hidden />
                        <h3 className="text-lg font-semibold text-hs-text">{detail.label}</h3>
                      </div>
                      <p className="mt-1 text-sm text-hs-muted">{detail.description}</p>
                      <p className="mt-2 text-sm font-medium text-hs-text">{training.readinessLabel}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div
                        className="grid size-20 place-items-center rounded-full border border-hs-border bg-hs-page"
                        style={{
                          background: `conic-gradient(rgb(37 99 235) ${training.overallCompletion}%, transparent 0)`,
                        }}
                      >
                        <div className="grid size-16 place-items-center rounded-full bg-hs-card text-lg font-semibold text-hs-text">
                          {training.overallCompletion}%
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {training.courses.map((courseItem) => (
                      <div key={courseItem.key} className="rounded-hs border border-hs-border bg-hs-page p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-hs-text">{courseItem.title}</p>
                            <p className="text-hs-caption text-hs-muted">
                              {courseItem.category} · {courseItem.durationMinutes}m · {courseItem.dueLabel}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "inline-flex rounded-hs-pill border px-2.5 py-1 text-hs-caption font-medium",
                              statusStyles[courseItem.status],
                            )}
                          >
                            {courseItem.status}
                          </span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-hs-fill">
                          <div className="h-full rounded-full bg-hs-primary" style={{ width: `${courseItem.progress}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {expanded ? (
                    <div className="mt-4 rounded-hs border border-hs-border bg-hs-fill p-4">
                      <p className="text-sm font-medium text-hs-text">Role training notes</p>
                      <p className="mt-1 text-sm leading-6 text-hs-muted">{training.managerNote}</p>
                      <div className="mt-4 space-y-3">
                        {training.courses.map((courseItem) => (
                          <div key={`${courseItem.key}-about`} className="border-t border-hs-border pt-3">
                            <p className="text-sm font-medium text-hs-text">{courseItem.title}</p>
                            <p className="mt-1 text-sm leading-6 text-hs-muted">{courseItem.about}</p>
                            <p className="mt-1 text-hs-caption text-hs-muted">Evidence: {courseItem.evidence}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 flex justify-end">
                    <HsSecondaryButton type="button" onClick={() => setExpandedRole(expanded ? null : role)}>
                      {expanded ? "Hide about" : "Show about"}
                    </HsSecondaryButton>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-hs-card border border-hs-border bg-hs-card p-5">
          <p className="text-sm font-medium text-hs-text">Mock data note</p>
          <p className="mt-1 text-sm leading-6 text-hs-muted">
            This page is an illustrative seven-role HIPAA training dashboard for UX review. The next production step is
            connecting these cards to <code className="rounded bg-hs-fill px-1 py-0.5">training_courses</code> and{" "}
            <code className="rounded bg-hs-fill px-1 py-0.5">training_assignments</code> so real employees and evidence
            replace the mock role progress.
          </p>
        </section>
      </div>
    </div>
  );
}
