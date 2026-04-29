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

type PolicyCategory =
  | "Privacy"
  | "Security"
  | "Administrative"
  | "Technical"
  | "Physical"
  | "Breach"
  | "Vendors"
  | "Workforce"
  | "Data Governance";

type PolicyOwner = "Privacy Officer" | "Security Officer" | "Compliance Manager" | "Admin";

type PolicySection = {
  heading: string;
  body: string;
};

type PolicyTemplate = {
  id: string;
  title: string;
  category: PolicyCategory;
  owner: PolicyOwner;
  cadence: string;
  applicability: string[];
  status: "Draft-ready" | "Acknowledgement-ready" | "Annual review";
  summary: string;
  purpose: string;
  scope: string;
  statement: string;
  procedures: string[];
  evidence: string[];
  acknowledgements: string[];
  sections: PolicySection[];
};

const categories: Array<PolicyCategory | "All"> = [
  "All",
  "Privacy",
  "Security",
  "Administrative",
  "Technical",
  "Physical",
  "Breach",
  "Vendors",
  "Workforce",
  "Data Governance",
];

const policyTemplates: PolicyTemplate[] = [
  {
    id: "hipaa-privacy-policy",
    title: "HIPAA Privacy Policy",
    category: "Privacy",
    owner: "Privacy Officer",
    cadence: "Annual + regulatory change",
    applicability: ["All workforce", "Privacy operations", "Support teams"],
    status: "Acknowledgement-ready",
    summary:
      "Master privacy policy covering PHI use, disclosure, safeguards, patient rights, and privacy officer responsibilities.",
    purpose:
      "Establish organization-wide expectations for protecting PHI in paper, oral, and electronic forms while supporting permitted operations.",
    scope:
      "Applies to all workforce members, contractors, systems, vendors, and workflows that create, receive, maintain, use, or disclose PHI.",
    statement:
      "The organization will only use or disclose PHI as permitted by HIPAA, approved policy, applicable law, or valid authorization, and will apply reasonable safeguards to prevent impermissible use or disclosure.",
    procedures: [
      "Classify data as PHI before sharing externally or using in reports.",
      "Verify identity and authority before releasing PHI.",
      "Escalate unusual disclosure requests to the Privacy Officer.",
      "Document privacy decisions that create audit or patient-rights impact.",
    ],
    evidence: ["Privacy policy version", "Workforce acknowledgements", "Disclosure review notes", "Privacy incident log"],
    acknowledgements: ["All workforce", "Support teams", "Privacy-impacting contractors"],
    sections: [
      { heading: "Permitted uses", body: "Treatment, payment, and operations must follow minimum necessary expectations where applicable." },
      { heading: "Safeguards", body: "PHI must be protected through administrative, technical, and physical controls appropriate to risk." },
      { heading: "Escalation", body: "Requests outside standard workflows must be routed to privacy leadership before disclosure." },
    ],
  },
  {
    id: "minimum-necessary-policy",
    title: "Minimum Necessary Policy",
    category: "Privacy",
    owner: "Privacy Officer",
    cadence: "Annual",
    applicability: ["All PHI workflows", "Reporting", "Support"],
    status: "Draft-ready",
    summary:
      "Defines how teams limit PHI use and disclosure to the smallest useful amount needed for the intended purpose.",
    purpose:
      "Reduce unnecessary PHI exposure by requiring workforce members to evaluate purpose, recipient, and data scope before use or disclosure.",
    scope:
      "Applies to routine reports, support workflows, operational analytics, audit exports, and vendor communications involving PHI.",
    statement:
      "Workforce members must request, access, use, and disclose only the PHI needed to accomplish the approved task.",
    procedures: [
      "Use approved role-based reports whenever possible.",
      "Remove direct identifiers when summary or de-identified data is sufficient.",
      "Use privacy review for broad exports or unusual requests.",
      "Record exceptions in audit notes or ticket evidence.",
    ],
    evidence: ["Report inventory", "Disclosure approvals", "Redaction checklist", "Access review decisions"],
    acknowledgements: ["Privacy Officer", "Compliance Manager", "Data Analyst", "Support teams"],
    sections: [
      { heading: "Routine disclosures", body: "Standardized templates should define the expected minimum PHI set." },
      { heading: "Non-routine disclosures", body: "The Privacy Officer or delegate must review scope and justification." },
      { heading: "Analytics", body: "Use de-identified or aggregated data unless PHI is required and approved." },
    ],
  },
  {
    id: "patient-rights-policy",
    title: "Patient Rights and Access Request Policy",
    category: "Privacy",
    owner: "Privacy Officer",
    cadence: "Annual",
    applicability: ["Patient access", "Front office", "Privacy operations"],
    status: "Draft-ready",
    summary:
      "Covers access, amendment, restriction, confidential communications, and accounting-related patient rights workflows.",
    purpose:
      "Ensure patient-rights requests are received, verified, routed, completed, and documented consistently.",
    scope:
      "Applies to all patient or representative requests involving access, amendment, restrictions, communication preferences, and privacy records.",
    statement:
      "The organization will honor HIPAA patient rights according to verified identity, required timelines, documented procedures, and applicable exceptions.",
    procedures: [
      "Log each request with received date, requester, request type, and responsible owner.",
      "Verify identity and authority before release.",
      "Track deadline status and escalation risks.",
      "Document approvals, denials, amendments, and communications.",
    ],
    evidence: ["Request log", "Identity verification checklist", "Response packet", "Denial review notes"],
    acknowledgements: ["Privacy Officer", "Front office", "Support teams"],
    sections: [
      { heading: "Access requests", body: "Requests should be routed quickly with format, scope, and delivery preferences captured." },
      { heading: "Amendments", body: "Amendment decisions require review, rationale, and documented communication." },
      { heading: "Confidential communications", body: "Reasonable alternative communication requests must be captured in operational systems." },
    ],
  },
  {
    id: "hipaa-security-policy",
    title: "HIPAA Security Policy",
    category: "Security",
    owner: "Security Officer",
    cadence: "Annual + major system change",
    applicability: ["ePHI systems", "Security operations", "Engineering"],
    status: "Acknowledgement-ready",
    summary:
      "Master Security Rule policy defining administrative, physical, and technical safeguards for ePHI confidentiality, integrity, and availability.",
    purpose:
      "Set the organization-wide security baseline for systems and workforce activity involving ePHI.",
    scope:
      "Applies to all systems, services, users, vendors, and infrastructure that create, receive, maintain, or transmit ePHI.",
    statement:
      "The organization will implement reasonable and appropriate safeguards to protect ePHI against unauthorized access, alteration, loss, or disclosure.",
    procedures: [
      "Maintain an ePHI system inventory and risk register.",
      "Review access privileges periodically and after role changes.",
      "Apply security controls for authentication, encryption, audit logs, and incident response.",
      "Track exceptions and remediation to closure.",
    ],
    evidence: ["Risk analysis", "Control inventory", "Access review", "Audit log review", "Exception register"],
    acknowledgements: ["Security Officer", "Admin", "Developer", "Data Analyst"],
    sections: [
      { heading: "Administrative safeguards", body: "Risk analysis, workforce security, training, and policy enforcement." },
      { heading: "Physical safeguards", body: "Facility, workstation, device, and media protection." },
      { heading: "Technical safeguards", body: "Access controls, audit controls, integrity, authentication, and transmission security." },
    ],
  },
  {
    id: "risk-analysis-management-policy",
    title: "Risk Analysis and Risk Management Policy",
    category: "Administrative",
    owner: "Security Officer",
    cadence: "Quarterly + major change",
    applicability: ["Risk assessment", "Security operations", "Compliance"],
    status: "Draft-ready",
    summary:
      "Defines the cadence, ownership, scoring, remediation, and evidence expectations for HIPAA risk analysis and risk management.",
    purpose:
      "Ensure risks to ePHI are identified, assessed, prioritized, remediated, and reviewed through a repeatable process.",
    scope:
      "Applies to technology, vendors, workforce processes, controls, incidents, integrations, and repositories that may affect ePHI.",
    statement:
      "The organization will conduct and maintain risk analysis and risk management activities that are documented, prioritized, and reviewed by accountable owners.",
    procedures: [
      "Identify assets, threats, vulnerabilities, likelihood, impact, and current controls.",
      "Assign owners and due dates to remediation tasks.",
      "Track exceptions with compensating controls.",
      "Review unresolved high risks with leadership.",
    ],
    evidence: ["Risk register", "Remediation tickets", "Leadership review notes", "Control testing results"],
    acknowledgements: ["Security Officer", "Compliance Manager", "Admin"],
    sections: [
      { heading: "Risk scoring", body: "Risk should consider likelihood, impact, PHI sensitivity, exposure, and control maturity." },
      { heading: "Remediation", body: "High-risk issues require documented owner, due date, and progress tracking." },
      { heading: "Review", body: "The risk register should be reviewed on a defined cadence and after major changes." },
    ],
  },
  {
    id: "workforce-access-rbac-policy",
    title: "Workforce Access and Role-Based Access Policy",
    category: "Administrative",
    owner: "Admin",
    cadence: "Quarterly",
    applicability: ["RBAC", "User management", "Access reviews"],
    status: "Acknowledgement-ready",
    summary:
      "Controls workforce authorization, role assignment, least privilege, suspension, removal, and periodic access certification.",
    purpose:
      "Ensure workforce members only receive access needed for their role and lose access promptly when no longer required.",
    scope:
      "Applies to application roles, privileged access, organization memberships, vendor access, and access-review campaigns.",
    statement:
      "Access to PHI and compliance systems must be authorized, role-based, time-appropriate, reviewed, and revoked when no longer needed.",
    procedures: [
      "Assign access using approved roles and documented justification.",
      "Review privileged roles and access exceptions periodically.",
      "Suspend or remove access after termination or role changes.",
      "Log all role and status changes for audit review.",
    ],
    evidence: ["Role change log", "Access review decisions", "Suspension/removal records", "Privileged role list"],
    acknowledgements: ["Admin", "Security Officer", "Compliance Manager"],
    sections: [
      { heading: "Least privilege", body: "Access should be limited to job duties and reviewed when duties change." },
      { heading: "Privileged access", body: "High-privilege access requires stronger review and monitoring." },
      { heading: "Access removal", body: "Suspension and removal actions must be auditable." },
    ],
  },
  {
    id: "technical-safeguards-policy",
    title: "Technical Safeguards Policy",
    category: "Technical",
    owner: "Security Officer",
    cadence: "Annual + system change",
    applicability: ["Engineering", "Security", "ePHI systems"],
    status: "Draft-ready",
    summary:
      "Software and infrastructure control policy for unique users, access control, audit controls, integrity, authentication, and secure transmission.",
    purpose:
      "Translate HIPAA technical safeguards into engineering and operations expectations for systems that process ePHI.",
    scope:
      "Applies to production applications, databases, storage, APIs, logging systems, integrations, and administrative tooling.",
    statement:
      "Systems that handle ePHI must enforce unique user access, appropriate authentication, audit controls, integrity protection, and secure transmission safeguards.",
    procedures: [
      "Use unique user accounts and prohibit shared production accounts.",
      "Require MFA for privileged and remote access.",
      "Capture audit events for access, changes, exports, and security-sensitive actions.",
      "Review exceptions through security risk management.",
    ],
    evidence: ["MFA configuration", "Audit log samples", "Access control matrix", "Exception register"],
    acknowledgements: ["Developer", "Security Officer", "Admin"],
    sections: [
      { heading: "Access control", body: "Use unique users, role checks, session protections, and emergency access controls." },
      { heading: "Audit controls", body: "Record meaningful events without leaking PHI into logs." },
      { heading: "Integrity and transmission", body: "Protect ePHI against unauthorized alteration and insecure transmission." },
    ],
  },
  {
    id: "encryption-transmission-policy",
    title: "Encryption and Transmission Security Policy",
    category: "Technical",
    owner: "Security Officer",
    cadence: "Annual",
    applicability: ["Engineering", "Infrastructure", "Vendors"],
    status: "Draft-ready",
    summary:
      "Defines how ePHI must be protected at rest, in transit, in backups, exports, integrations, and vendor transfers.",
    purpose:
      "Reduce the risk of unauthorized disclosure by applying encryption and secure transmission practices appropriate to ePHI workflows.",
    scope:
      "Applies to databases, file storage, API transport, backups, exports, emails, integrations, and vendor data transfer methods.",
    statement:
      "ePHI must be transmitted using approved secure channels and stored with safeguards appropriate to sensitivity, system risk, and regulatory expectations.",
    procedures: [
      "Require TLS for application and API traffic.",
      "Encrypt storage and backups according to approved cloud or platform controls.",
      "Use secure transfer methods for vendor exchanges.",
      "Document exceptions and compensating safeguards.",
    ],
    evidence: ["TLS configuration", "Storage encryption settings", "Vendor transfer records", "Exception approvals"],
    acknowledgements: ["Security Officer", "Developer", "Admin"],
    sections: [
      { heading: "In transit", body: "Use approved encrypted transport for application, API, and file-transfer workflows." },
      { heading: "At rest", body: "Protect databases, storage buckets, backups, and exports with approved safeguards." },
      { heading: "Exceptions", body: "Unencrypted workflows require risk review, user warning, and documented approval." },
    ],
  },
  {
    id: "audit-logging-monitoring-policy",
    title: "Audit Logging and Monitoring Policy",
    category: "Technical",
    owner: "Security Officer",
    cadence: "Quarterly",
    applicability: ["Audit logs", "Security monitoring", "Compliance"],
    status: "Acknowledgement-ready",
    summary:
      "Specifies audit events, review cadence, alert handling, and evidence retention for PHI and administrative activity.",
    purpose:
      "Ensure access to PHI and security-sensitive actions can be reviewed, investigated, and included in audit evidence.",
    scope:
      "Applies to application audit logs, platform logs, administrative actions, role changes, PHI access, exports, and anomaly review.",
    statement:
      "Systems must record audit events sufficient to support security investigations, privacy review, compliance reporting, and incident response.",
    procedures: [
      "Log role changes, PHI access, exports, policy actions, vendor changes, and incident actions.",
      "Avoid storing unnecessary PHI in log messages.",
      "Review high-risk events and anomalies on a defined cadence.",
      "Retain audit evidence according to retention policy.",
    ],
    evidence: ["Audit event stream", "Log review records", "Anomaly escalations", "Investigation notes"],
    acknowledgements: ["Security Officer", "Auditor", "Developer"],
    sections: [
      { heading: "Event coverage", body: "Logs should cover access, changes, exports, privileged actions, and failures." },
      { heading: "Privacy-safe logs", body: "Logs must avoid unnecessary PHI while remaining useful for investigations." },
      { heading: "Review", body: "Events should be filtered, reviewed, and escalated according to risk." },
    ],
  },
  {
    id: "physical-workstation-policy",
    title: "Physical Safeguards and Workstation Use Policy",
    category: "Physical",
    owner: "Security Officer",
    cadence: "Annual",
    applicability: ["Facilities", "Remote work", "Workstations"],
    status: "Draft-ready",
    summary:
      "Covers facility access, workstation use, screen protection, printed PHI, remote work, device handling, and disposal expectations.",
    purpose:
      "Protect PHI and ePHI from physical exposure, theft, loss, and unauthorized observation.",
    scope:
      "Applies to offices, remote workspaces, laptops, mobile devices, printed records, removable media, and shared workstations.",
    statement:
      "Workforce members must use reasonable physical safeguards to prevent unauthorized access to PHI in facilities, workstations, devices, and printed materials.",
    procedures: [
      "Lock workstations when unattended.",
      "Position screens to reduce unauthorized viewing.",
      "Secure paper PHI and dispose through approved methods.",
      "Report lost or stolen devices immediately.",
    ],
    evidence: ["Workstation checklist", "Device inventory", "Facility access logs", "Disposal records"],
    acknowledgements: ["All workforce", "Operations", "Security Officer"],
    sections: [
      { heading: "Workstation use", body: "Users must prevent casual viewing and unauthorized access." },
      { heading: "Remote work", body: "Remote environments must provide privacy, secure devices, and approved connectivity." },
      { heading: "Media and disposal", body: "PHI media must be inventoried, secured, reused safely, or destroyed appropriately." },
    ],
  },
  {
    id: "breach-incident-response-policy",
    title: "Breach Notification and Incident Response Policy",
    category: "Breach",
    owner: "Privacy Officer",
    cadence: "Annual + tabletop",
    applicability: ["Incidents", "Breach review", "Notifications"],
    status: "Acknowledgement-ready",
    summary:
      "Defines suspected breach intake, containment, risk assessment, notification decisioning, and documentation workflows.",
    purpose:
      "Ensure suspected breaches and security incidents are reported, contained, assessed, and documented promptly.",
    scope:
      "Applies to impermissible use or disclosure, suspected compromise, lost devices, misdirected messages, vendor incidents, and security events involving PHI.",
    statement:
      "Workforce members must report suspected incidents immediately, and designated privacy/security leaders must assess and document breach notification obligations.",
    procedures: [
      "Capture what happened, when discovered, systems involved, and PHI type.",
      "Preserve logs and evidence without altering records.",
      "Perform documented breach risk assessment.",
      "Coordinate notifications and remediation when required.",
    ],
    evidence: ["Incident intake", "Risk assessment", "Notification letters", "Timeline evidence", "Corrective action plan"],
    acknowledgements: ["All workforce", "Privacy Officer", "Security Officer"],
    sections: [
      { heading: "Reporting", body: "Suspected incidents must be escalated immediately through approved channels." },
      { heading: "Risk assessment", body: "Assessment should consider PHI type, recipient, acquisition/viewing, and mitigation." },
      { heading: "Notification", body: "Required notifications must follow documented timing and approval workflows." },
    ],
  },
  {
    id: "baa-vendor-policy",
    title: "Business Associate and Vendor Management Policy",
    category: "Vendors",
    owner: "Compliance Manager",
    cadence: "Annual + vendor renewal",
    applicability: ["Vendors", "BAAs", "Subcontractors"],
    status: "Draft-ready",
    summary:
      "Governs vendor due diligence, BAAs, subcontractors, risk scores, certifications, renewals, and evidence management.",
    purpose:
      "Ensure vendors with PHI access are evaluated, contracted appropriately, monitored, and documented.",
    scope:
      "Applies to business associates, subcontractors, cloud providers, email vendors, AI services, analytics vendors, and support processors.",
    statement:
      "Vendors that create, receive, maintain, transmit, or support PHI must be reviewed, tracked, and covered by appropriate agreements and safeguards.",
    procedures: [
      "Classify vendor PHI access before onboarding.",
      "Upload signed BAA/MOU evidence and track expiration.",
      "Record subcontractors and sub-BAA status.",
      "Recalculate vendor risk and remediate failures.",
    ],
    evidence: ["BAA document", "Vendor risk score", "Certification evidence", "Subcontractor register", "Renewal notes"],
    acknowledgements: ["Compliance Manager", "Privacy Officer", "Security Officer"],
    sections: [
      { heading: "Due diligence", body: "Vendors should be reviewed for PHI access, safeguards, certifications, and contractual coverage." },
      { heading: "BAA management", body: "Signed agreements must be stored, tracked, renewed, and connected to covered services." },
      { heading: "Subcontractors", body: "Subcontractor obligations and evidence must be tracked as part of vendor oversight." },
    ],
  },
  {
    id: "training-sanctions-policy",
    title: "Training and Sanctions Policy",
    category: "Workforce",
    owner: "Compliance Manager",
    cadence: "Annual",
    applicability: ["Training", "Workforce", "Sanctions"],
    status: "Draft-ready",
    summary:
      "Defines workforce HIPAA training expectations, refresher cadence, role-based modules, completion tracking, and sanction documentation.",
    purpose:
      "Ensure workforce members receive appropriate HIPAA training and that violations are handled consistently.",
    scope:
      "Applies to workforce members, contractors, privileged users, role changes, onboarding, refresher cycles, and documented violations.",
    statement:
      "The organization will train workforce members on HIPAA policies and apply sanctions for violations according to documented procedures.",
    procedures: [
      "Assign baseline HIPAA training during onboarding.",
      "Assign role-based modules for privacy, security, developer, analyst, and compliance roles.",
      "Track overdue assignments and send reminders.",
      "Document sanctions consistently and confidentially.",
    ],
    evidence: ["Training assignments", "Completion records", "Reminder logs", "Sanctions log"],
    acknowledgements: ["All workforce", "Compliance Manager", "Admin"],
    sections: [
      { heading: "Training cadence", body: "Baseline and role-based training should be refreshed on a defined schedule." },
      { heading: "Role-based modules", body: "Users with PHI or administrative access require training matched to responsibilities." },
      { heading: "Sanctions", body: "Violations should be documented and handled according to severity and policy." },
    ],
  },
  {
    id: "retention-disposal-policy",
    title: "Data Retention and Disposal Policy",
    category: "Data Governance",
    owner: "Compliance Manager",
    cadence: "Annual",
    applicability: ["Reports", "Exports", "Backups", "PHI data"],
    status: "Draft-ready",
    summary:
      "Defines how PHI, audit evidence, reports, exports, backups, and documentation are retained, archived, and disposed.",
    purpose:
      "Reduce unnecessary PHI retention while preserving compliance evidence needed for operations, audits, and legal obligations.",
    scope:
      "Applies to PHI records, generated reports, exports, audit packages, incident files, backups, temporary files, and training evidence.",
    statement:
      "PHI and compliance evidence must be retained only as required by policy, law, operational need, and approved retention schedules.",
    procedures: [
      "Classify records by retention category.",
      "Remove temporary exports when no longer needed.",
      "Use approved disposal methods for paper and electronic records.",
      "Document exceptions and legal holds.",
    ],
    evidence: ["Retention schedule", "Deletion jobs", "Disposal certificates", "Legal hold register"],
    acknowledgements: ["Compliance Manager", "Security Officer", "Data Analyst"],
    sections: [
      { heading: "Retention schedule", body: "Each record type should have owner, duration, storage location, and disposal method." },
      { heading: "Temporary files", body: "Temporary exports and scratch files should be removed promptly." },
      { heading: "Disposal evidence", body: "Destruction should be documented where audit or legal obligations require it." },
    ],
  },
  {
    id: "deidentification-analytics-policy",
    title: "De-identification and Analytics Use Policy",
    category: "Data Governance",
    owner: "Privacy Officer",
    cadence: "Annual + analytics change",
    applicability: ["Analytics", "AI workflows", "Data exports"],
    status: "Draft-ready",
    summary:
      "Controls de-identification, analytics, AI-assisted workflows, export reviews, and privacy escalation for data use.",
    purpose:
      "Permit useful analytics while reducing PHI exposure and preventing unauthorized reuse or disclosure.",
    scope:
      "Applies to analytics datasets, AI prompts, de-identification checks, reports, exports, dashboards, and external data sharing.",
    statement:
      "Analytics and AI workflows must use de-identified, aggregated, or minimum necessary data unless PHI use is approved and controlled.",
    procedures: [
      "Review datasets for direct and indirect identifiers.",
      "Use de-identification checks before external sharing.",
      "Avoid placing PHI in unsupported AI prompts or tools.",
      "Document expert review or privacy approval where needed.",
    ],
    evidence: ["De-identification report", "Export approval", "AI tool review", "Privacy escalation notes"],
    acknowledgements: ["Privacy Officer", "Data Analyst", "Developer"],
    sections: [
      { heading: "Dataset review", body: "Analytics datasets should be reviewed for identifiers and residual re-identification risk." },
      { heading: "AI use", body: "AI tools must be approved for PHI workflows before PHI is submitted." },
      { heading: "Export controls", body: "Exports should be approved, minimized, encrypted, and deleted when no longer needed." },
    ],
  },
];

const categoryStyles: Record<PolicyCategory, string> = {
  Privacy: "border-teal-200 bg-teal-50 text-teal-700",
  Security: "border-red-200 bg-red-50 text-red-700",
  Administrative: "border-blue-200 bg-blue-50 text-blue-700",
  Technical: "border-purple-200 bg-purple-50 text-purple-700",
  Physical: "border-amber-200 bg-amber-50 text-amber-700",
  Breach: "border-rose-200 bg-rose-50 text-rose-700",
  Vendors: "border-indigo-200 bg-indigo-50 text-indigo-700",
  Workforce: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Data Governance": "border-gray-200 bg-gray-50 text-gray-700",
};

export default function PolicyLibraryPage() {
  const rbac = useDashboardRbac();
  const canWrite = rbac.canWritePage("policy_library");
  const readOnly = rbac.permissionFor("policy_library") === "read_only";
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<PolicyCategory | "All">("All");
  const [activeOwner, setActiveOwner] = useState<PolicyOwner | "All">("All");
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyTemplate | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const owners = useMemo(() => {
    const list = Array.from(new Set(policyTemplates.map((policy) => policy.owner)));
    return ["All", ...list] as Array<PolicyOwner | "All">;
  }, []);

  const filteredPolicies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return policyTemplates.filter((policy) => {
      const matchesCategory = activeCategory === "All" || policy.category === activeCategory;
      const matchesOwner = activeOwner === "All" || policy.owner === activeOwner;
      const haystack = [
        policy.title,
        policy.category,
        policy.owner,
        policy.summary,
        policy.purpose,
        policy.scope,
        policy.statement,
        policy.applicability.join(" "),
        policy.procedures.join(" "),
        policy.evidence.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return matchesCategory && matchesOwner && (!q || haystack.includes(q));
    });
  }, [activeCategory, activeOwner, search]);

  const stats = useMemo(() => {
    const procedures = policyTemplates.reduce((sum, policy) => sum + policy.procedures.length, 0);
    return {
      templates: policyTemplates.length,
      categories: categories.length - 1,
      procedures,
      acknowledgementReady: policyTemplates.filter((policy) => policy.status === "Acknowledgement-ready").length,
    };
  }, []);

  function showPlaceholder(action: string) {
    setNotice(`${action} is ready as a UI action. Real publishing can be wired to policies and policy_versions next.`);
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
              <p className="text-hs-caption font-semibold uppercase tracking-[0.1em] text-hs-primary">
                Risk & Compliance
              </p>
              <h1 className="mt-2 text-hs-title font-semibold text-hs-text">Policy Library</h1>
              <p className="mt-2 text-hs-body text-hs-muted">
                A HIPAA policy binder with draft-ready templates for privacy, security, breach notification,
                safeguards, vendors, workforce training, retention, and de-identification.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-hs-pill border border-hs-border bg-hs-fill px-3 py-1 text-hs-caption font-medium text-hs-muted">
                  Privacy Officer
                </span>
                <span className="rounded-hs-pill border border-hs-border bg-hs-fill px-3 py-1 text-hs-caption font-medium text-hs-muted">
                  Compliance Manager
                </span>
                <span className="rounded-hs-pill border border-hs-border bg-hs-fill px-3 py-1 text-hs-caption font-medium text-hs-muted">
                  Security Officer
                </span>
                <Link
                  href="/dashboard/training-course-library"
                  className="rounded-hs-pill border border-hs-border bg-hs-card px-3 py-1 text-hs-caption font-medium text-hs-primary underline"
                >
                  Training Course Library
                </Link>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {canWrite ? (
                <>
                  <HsSecondaryButton type="button" onClick={() => showPlaceholder("Request acknowledgement")}>
                    Request acknowledgement
                  </HsSecondaryButton>
                  <HsSecondaryButton type="button" onClick={() => showPlaceholder("Publish version")}>
                    Publish version
                  </HsSecondaryButton>
                  <HsPrimaryButton type="button" onClick={() => showPlaceholder("Create policy")}>
                    Create policy
                  </HsPrimaryButton>
                </>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <article className="rounded-hs-card border border-hs-border bg-hs-card p-5 shadow-sm">
            <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Policy templates</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-hs-text">{stats.templates}</p>
            <p className="mt-1 text-sm text-hs-muted">Draft-ready HIPAA binder</p>
          </article>
          <article className="rounded-hs-card border border-hs-border bg-hs-card p-5 shadow-sm">
            <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Categories</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-hs-text">{stats.categories}</p>
            <p className="mt-1 text-sm text-hs-muted">Privacy, security, safeguards, breach</p>
          </article>
          <article className="rounded-hs-card border border-hs-border bg-hs-card p-5 shadow-sm">
            <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Procedures</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-hs-text">{stats.procedures}</p>
            <p className="mt-1 text-sm text-hs-muted">Operational policy steps</p>
          </article>
          <article className="rounded-hs-card border border-hs-border bg-hs-card p-5 shadow-sm">
            <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Ack-ready</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-hs-text">{stats.acknowledgementReady}</p>
            <p className="mt-1 text-sm text-hs-muted">Can be assigned for sign-off</p>
          </article>
        </section>

        <section className="rounded-hs-card border border-hs-border bg-hs-card p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <HsTextInput
              label="Search policies"
              placeholder="Search breach, access, BAA, audit logs, safeguards…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-hs-secondary font-medium text-hs-text">Owner</span>
              <select
                value={activeOwner}
                onChange={(event) => setActiveOwner(event.target.value as PolicyOwner | "All")}
                className="h-10 rounded-hs border border-hs-border bg-hs-card px-3 text-hs-body text-hs-text focus:outline-none focus:shadow-hs-focus"
              >
                {owners.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner === "All" ? "All owners" : owner}
                  </option>
                ))}
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
          {filteredPolicies.map((policy) => (
            <article
              key={policy.id}
              className="flex min-h-[360px] flex-col rounded-hs-card border border-hs-border bg-hs-card p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    "rounded-hs-pill border px-2.5 py-1 text-hs-caption font-medium",
                    categoryStyles[policy.category],
                  )}
                >
                  {policy.category}
                </span>
                <span className="rounded-hs-pill bg-hs-fill px-2.5 py-1 text-hs-caption font-medium text-hs-muted">
                  {policy.status}
                </span>
              </div>
              <h2 className="mt-4 text-lg font-semibold leading-snug text-hs-text">{policy.title}</h2>
              <p className="mt-2 line-clamp-4 text-sm leading-6 text-hs-muted">{policy.summary}</p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-hs bg-hs-page px-3 py-2">
                  <p className="text-hs-caption text-hs-muted">Owner</p>
                  <p className="text-sm font-semibold text-hs-text">{policy.owner}</p>
                </div>
                <div className="rounded-hs bg-hs-page px-3 py-2">
                  <p className="text-hs-caption text-hs-muted">Review</p>
                  <p className="text-sm font-semibold text-hs-text">{policy.cadence}</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Applicability</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {policy.applicability.slice(0, 3).map((item) => (
                    <span key={item} className="rounded-hs-pill bg-hs-fill px-2.5 py-1 text-hs-caption font-medium text-hs-muted">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-auto pt-5">
                <HsSecondaryButton type="button" className="w-full" onClick={() => setSelectedPolicy(policy)}>
                  Open policy template
                </HsSecondaryButton>
              </div>
            </article>
          ))}
        </section>

        {filteredPolicies.length === 0 ? (
          <section className="rounded-hs-card border border-hs-border bg-hs-card p-8 text-center">
            <h2 className="text-hs-section font-semibold text-hs-text">No policies found</h2>
            <p className="mt-2 text-hs-body text-hs-muted">Try a broader search or choose “All” categories.</p>
          </section>
        ) : null}
      </div>

      <HsModal
        open={Boolean(selectedPolicy)}
        onClose={() => setSelectedPolicy(null)}
        title={selectedPolicy?.title ?? "Policy template"}
        className="max-w-[820px]"
        footer={
          <>
            <HsSecondaryButton type="button" onClick={() => setSelectedPolicy(null)}>
              Close
            </HsSecondaryButton>
            {canWrite ? (
              <HsPrimaryButton type="button" onClick={() => showPlaceholder("Create policy from template")}>
                Use template
              </HsPrimaryButton>
            ) : null}
          </>
        }
      >
        {selectedPolicy ? (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <span
                className={cn(
                  "rounded-hs-pill border px-2.5 py-1 text-hs-caption font-medium",
                  categoryStyles[selectedPolicy.category],
                )}
              >
                {selectedPolicy.category}
              </span>
              <span className="rounded-hs-pill bg-hs-fill px-2.5 py-1 text-hs-caption font-medium text-hs-muted">
                {selectedPolicy.owner}
              </span>
              <span className="rounded-hs-pill bg-hs-fill px-2.5 py-1 text-hs-caption font-medium text-hs-muted">
                Review: {selectedPolicy.cadence}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-hs border border-hs-border bg-hs-page p-4">
                <h3 className="text-sm font-semibold text-hs-text">Purpose</h3>
                <p className="mt-2 text-sm leading-6 text-hs-muted">{selectedPolicy.purpose}</p>
              </div>
              <div className="rounded-hs border border-hs-border bg-hs-page p-4">
                <h3 className="text-sm font-semibold text-hs-text">Scope</h3>
                <p className="mt-2 text-sm leading-6 text-hs-muted">{selectedPolicy.scope}</p>
              </div>
            </div>

            <div className="rounded-hs border border-hs-border bg-hs-card p-4">
              <h3 className="text-sm font-semibold text-hs-text">Policy statement</h3>
              <p className="mt-2 text-sm leading-6 text-hs-muted">{selectedPolicy.statement}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-hs border border-hs-border bg-hs-card p-4">
                <h3 className="text-sm font-semibold text-hs-text">Required procedures</h3>
                <ul className="mt-2 space-y-2 text-sm text-hs-muted">
                  {selectedPolicy.procedures.map((procedure) => (
                    <li key={procedure} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-hs-primary" aria-hidden />
                      <span>{procedure}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-hs border border-hs-border bg-hs-card p-4">
                <h3 className="text-sm font-semibold text-hs-text">Evidence / audit artifacts</h3>
                <ul className="mt-2 space-y-2 text-sm text-hs-muted">
                  {selectedPolicy.evidence.map((artifact) => (
                    <li key={artifact} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-hs-primary" aria-hidden />
                      <span>{artifact}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-hs-text">Template sections</h3>
              <div className="mt-3 space-y-3">
                {selectedPolicy.sections.map((section) => (
                  <div key={section.heading} className="rounded-hs border border-hs-border bg-hs-page p-3">
                    <p className="text-sm font-medium text-hs-text">{section.heading}</p>
                    <p className="mt-1 text-sm leading-6 text-hs-muted">{section.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-hs border border-hs-border bg-hs-fill p-4">
              <h3 className="text-sm font-semibold text-hs-text">Recommended acknowledgements</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedPolicy.acknowledgements.map((ack) => (
                  <span key={ack} className="rounded-hs-pill bg-hs-card px-2.5 py-1 text-hs-caption font-medium text-hs-muted">
                    {ack}
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
