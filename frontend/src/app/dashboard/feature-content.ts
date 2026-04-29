export type FeatureStatus = "PASS" | "FAIL" | "WARNING" | "PENDING"

export type FeatureMetric = {
  label: string
  value: string
  context: string
  trendPercent: number
  trendPositive?: boolean
}

export type FeatureTable = {
  headers: string[]
  rows: string[][]
}

export type FeatureSpec = {
  href: string
  section: string
  title: string
  purpose: string
  roles: string[]
  primaryAction: string
  secondaryAction: string
  metrics: FeatureMetric[]
  workflow: string[]
  table: FeatureTable
  status: FeatureStatus
  statusLabel: string
  emptyState: {
    title: string
    description: string
  }
}

export const featureSpecs: FeatureSpec[] = [
  {
    href: "/dashboard/compliance-score-trend",
    section: "Overview",
    title: "Compliance Score Trend",
    purpose:
      "Explain how the compliance score changed across 30, 60, and 90 day windows with annotations for the events that moved it.",
    roles: ["Compliance Manager", "Security Officer", "Executive"],
    primaryAction: "Export trend",
    secondaryAction: "Compare periods",
    status: "PASS",
    statusLabel: "Tracking",
    metrics: [
      { label: "Current score", value: "88", context: "Stable this week", trendPercent: 4 },
      { label: "30-day delta", value: "+6", context: "Three remediations closed", trendPercent: 6 },
      { label: "Annotated events", value: "9", context: "Score-affecting changes", trendPercent: 3 },
    ],
    workflow: [
      "Select a 30, 60, or 90 day range.",
      "Review score dips and improvements with event annotations.",
      "Open the related finding, incident, control, or training record.",
    ],
    table: {
      headers: ["Date", "Score", "Event", "Impact"],
      rows: [
        ["Apr 26", "88", "Remediated 3 PHI scanner findings", "+4"],
        ["Apr 22", "84", "New vendor BAA expiration warning", "-2"],
        ["Apr 18", "86", "Training campaign reached 94%", "+3"],
      ],
    },
    emptyState: {
      title: "No score history yet",
      description: "Run scans and start tracking controls to build compliance trend history.",
    },
  },
  {
    href: "/dashboard/phi-leakage-scanner",
    section: "PHI Protection",
    title: "PHI Leakage Scanner",
    purpose:
      "Run and schedule scans across repositories, databases, object storage, and email to detect PHI exposure and false positives.",
    roles: ["Developer", "Security Officer", "Compliance Manager"],
    primaryAction: "Run scan",
    secondaryAction: "Schedule scan",
    status: "WARNING",
    statusLabel: "3 open risks",
    metrics: [
      { label: "Open scan risks", value: "3", context: "Needs review", trendPercent: 12, trendPositive: false },
      { label: "Sources covered", value: "14", context: "Repos and stores", trendPercent: 5 },
      { label: "False positives", value: "2", context: "Reviewed this month", trendPercent: 8 },
    ],
    workflow: [
      "Choose source and scope.",
      "Run or schedule the scan.",
      "Review severity, PHI type, location, and evidence.",
      "Assign owner or mark false positive with reason.",
    ],
    table: {
      headers: ["Source", "PHI Type", "Severity", "Owner"],
      rows: [
        ["patient-api", "DOB", "High", "Engineering"],
        ["billing-worker", "SSN", "Critical", "Security"],
        ["analytics-export", "MRN", "Medium", "Data Platform"],
      ],
    },
    emptyState: {
      title: "No PHI scans yet",
      description: "Connect a source and run the first scan to identify PHI exposure.",
    },
  },
  {
    href: "/dashboard/phi-inventory",
    section: "PHI Protection",
    title: "PHI Inventory",
    purpose:
      "Maintain the catalog of systems containing PHI, including data type, classification, owner, and retention policy.",
    roles: ["Privacy Officer", "Compliance Manager", "Security Officer"],
    primaryAction: "Add system",
    secondaryAction: "Start review",
    status: "WARNING",
    statusLabel: "Review needed",
    metrics: [
      { label: "PHI systems", value: "22", context: "Cataloged", trendPercent: 10 },
      { label: "Missing owners", value: "3", context: "Requires assignment", trendPercent: 6, trendPositive: false },
      { label: "Retention gaps", value: "4", context: "Policy missing", trendPercent: 2, trendPositive: false },
    ],
    workflow: [
      "Add or import a system.",
      "Classify PHI types and sensitivity.",
      "Assign business and technical owners.",
      "Set retention policy and review cadence.",
    ],
    table: {
      headers: ["System", "PHI Type", "Classification", "Owner"],
      rows: [
        ["EHR warehouse", "MRN, diagnosis", "Clinical PHI", "Privacy Office"],
        ["Billing DB", "SSN, insurance ID", "Direct identifier", "Revenue Cycle"],
        ["Support inbox", "Patient email", "Contact PHI", "Support Ops"],
      ],
    },
    emptyState: {
      title: "No PHI systems cataloged",
      description: "Add systems that store, process, or transmit PHI.",
    },
  },
  {
    href: "/dashboard/de-identification-checker",
    section: "PHI Protection",
    title: "De-identification Checker",
    purpose:
      "Upload or paste sample data and evaluate whether it meets Safe Harbor or Expert Determination standards.",
    roles: ["Privacy Officer", "Developer", "Data Analyst"],
    primaryAction: "Check data",
    secondaryAction: "Export assessment",
    status: "PENDING",
    statusLabel: "Ready",
    metrics: [
      { label: "Checks this month", value: "18", context: "Privacy reviews", trendPercent: 9 },
      { label: "Passed checks", value: "12", context: "No identifiers found", trendPercent: 5 },
      { label: "Needs redaction", value: "6", context: "Identifiers remain", trendPercent: 3, trendPositive: false },
    ],
    workflow: [
      "Select Safe Harbor or Expert Determination.",
      "Paste or upload a sample.",
      "Review identifier findings and remediation guidance.",
      "Export assessment evidence without retaining raw data by default.",
    ],
    table: {
      headers: ["Dataset", "Standard", "Result", "Identifiers"],
      rows: [
        ["Research extract A", "Safe Harbor", "Pass", "None"],
        ["Claims sample", "Safe Harbor", "Fail", "ZIP, dates"],
        ["Analytics cohort", "Expert Determination", "Pending", "Reviewer assigned"],
      ],
    },
    emptyState: {
      title: "No de-identification checks",
      description: "Paste a sample or upload a dataset to begin review.",
    },
  },
  {
    href: "/dashboard/access-control-settings",
    section: "Access & Identity",
    title: "Access Control Settings",
    purpose:
      "Configure minimum necessary access policies, MFA enforcement, password policy, and session timeout rules.",
    roles: ["Security Officer", "Compliance Manager", "Admin"],
    primaryAction: "Edit policy",
    secondaryAction: "Export evidence",
    status: "PASS",
    statusLabel: "Enforced",
    metrics: [
      { label: "MFA coverage", value: "98%", context: "All active users", trendPercent: 2 },
      { label: "Session timeout", value: "15m", context: "PHI apps", trendPercent: 1 },
      { label: "Exceptions", value: "2", context: "Require review", trendPercent: 4, trendPositive: false },
    ],
    workflow: [
      "Set MFA and session requirements.",
      "Define minimum necessary access rules.",
      "Review exceptions with business justification.",
      "Export policy evidence for audits.",
    ],
    table: {
      headers: ["Policy", "State", "Scope", "Review"],
      rows: [
        ["MFA enforcement", "Enabled", "All users", "Quarterly"],
        ["Session timeout", "15 minutes", "PHI systems", "Annual"],
        ["Password policy", "Strong", "All users", "Annual"],
      ],
    },
    emptyState: {
      title: "No access policies configured",
      description: "Define MFA, session, and minimum necessary controls.",
    },
  },
  {
    href: "/dashboard/role-management",
    section: "Access & Identity",
    title: "Role Management",
    purpose:
      "Manage RBAC roles tied to HIPAA job functions and review permissions attached to each role.",
    roles: ["Security Officer", "Admin"],
    primaryAction: "Create role",
    secondaryAction: "Review matrix",
    status: "PASS",
    statusLabel: "Configured",
    metrics: [
      { label: "Roles", value: "9", context: "Active job functions", trendPercent: 1 },
      { label: "Privileged roles", value: "3", context: "PHI admin access", trendPercent: 2, trendPositive: false },
      { label: "Users assigned", value: "74", context: "Across all roles", trendPercent: 5 },
    ],
    workflow: [
      "Create role from HIPAA job function.",
      "Assign permissions and PHI access level.",
      "Review sensitive permissions.",
      "Track assignments and changes.",
    ],
    table: {
      headers: ["Role", "Users", "PHI Access", "Review"],
      rows: [
        ["Privacy Officer", "4", "High", "Quarterly"],
        ["Developer", "18", "Limited", "Quarterly"],
        ["Auditor", "3", "Read-only", "Per audit"],
      ],
    },
    emptyState: {
      title: "No roles defined",
      description: "Create RBAC roles for HIPAA job functions.",
    },
  },
  {
    href: "/dashboard/user-access-review",
    section: "Access & Identity",
    title: "User Access Review",
    purpose:
      "Run periodic access certification so managers confirm each user still needs access.",
    roles: ["Manager", "Compliance Manager", "Security Officer"],
    primaryAction: "Start campaign",
    secondaryAction: "Send reminders",
    status: "WARNING",
    statusLabel: "12 pending",
    metrics: [
      { label: "Pending approvals", value: "12", context: "Manager decisions", trendPercent: 7, trendPositive: false },
      { label: "Certified users", value: "62", context: "Current campaign", trendPercent: 18 },
      { label: "Revocations", value: "4", context: "Access removal tasks", trendPercent: 3 },
    ],
    workflow: [
      "Launch review campaign.",
      "Managers approve, revoke, or request more info.",
      "Revocations create access removal tasks.",
      "Campaign evidence is archived.",
    ],
    table: {
      headers: ["User", "System", "Manager", "Decision"],
      rows: [
        ["A. Patel", "EHR warehouse", "M. Chen", "Pending"],
        ["R. Singh", "Billing DB", "M. Chen", "Approve"],
        ["L. Nguyen", "Support Inbox", "S. Roy", "Revoke"],
      ],
    },
    emptyState: {
      title: "No access review campaign",
      description: "Start a certification campaign to collect manager decisions.",
    },
  },
]

const moreSpecs: FeatureSpec[] = [
  {
    href: "/dashboard/audit-log-viewer",
    section: "Security Controls",
    title: "Audit Log Viewer",
    purpose:
      "Search PHI access, modification, deletion, and failed authorization events.",
    roles: ["Security Officer", "Privacy Officer", "Auditor"],
    primaryAction: "Search logs",
    secondaryAction: "Save query",
    status: "PASS",
    statusLabel: "Streaming",
    metrics: [
      { label: "Events indexed", value: "1.2M", context: "Last 30 days", trendPercent: 11 },
      { label: "Saved queries", value: "7", context: "Audit workflows", trendPercent: 2 },
      { label: "Export jobs", value: "4", context: "This month", trendPercent: 5 },
    ],
    workflow: ["Search by actor/resource/action.", "Open event detail.", "Export results.", "Create anomaly or incident."],
    table: {
      headers: ["Time", "Actor", "Action", "Resource"],
      rows: [
        ["09:14", "a.patel", "View", "Patient 4821"],
        ["09:26", "billing-api", "Export", "Claims batch"],
        ["10:02", "r.singh", "Delete failed", "Document 991"],
      ],
    },
    emptyState: { title: "No audit events", description: "Connect an audit source to search PHI access history." },
  },
  {
    href: "/dashboard/anomaly-alerts",
    section: "Security Controls",
    title: "Anomaly Alerts",
    purpose:
      "Detect behavioral signals such as off-hours access, bulk downloads, and repeated failed logins.",
    roles: ["Security Officer"],
    primaryAction: "Investigate",
    secondaryAction: "Tune rules",
    status: "WARNING",
    statusLabel: "Critical alert",
    metrics: [
      { label: "Open alerts", value: "4", context: "Needs triage", trendPercent: 13, trendPositive: false },
      { label: "Bulk events", value: "1", context: "High risk", trendPercent: 1, trendPositive: false },
      { label: "Dismissed", value: "18", context: "With reasons", trendPercent: 8 },
    ],
    workflow: ["Review alert evidence.", "Investigate user/session behavior.", "Dismiss with reason or convert to incident.", "Tune detection rule."],
    table: {
      headers: ["Alert", "Actor", "Severity", "State"],
      rows: [
        ["Off-hours access", "nurse-admin", "High", "Open"],
        ["Bulk download", "billing-api", "Critical", "Investigating"],
        ["Failed login burst", "unknown", "Medium", "Open"],
      ],
    },
    emptyState: { title: "No anomaly alerts", description: "Behavioral alerts will appear here after integrations are connected." },
  },
  {
    href: "/dashboard/network-transmission-security",
    section: "Security Controls",
    title: "Network & Transmission Security",
    purpose:
      "Monitor firewall, VPN, TLS certificates, and secure transmission policy coverage.",
    roles: ["Security Officer", "Developer"],
    primaryAction: "Upload evidence",
    secondaryAction: "Create finding",
    status: "WARNING",
    statusLabel: "2 expiring certs",
    metrics: [
      { label: "TLS certs", value: "31", context: "Tracked endpoints", trendPercent: 3 },
      { label: "Expiring soon", value: "2", context: "Within 30 days", trendPercent: 2, trendPositive: false },
      { label: "VPN checks", value: "Pass", context: "Remote access", trendPercent: 1 },
    ],
    workflow: ["Inventory endpoints.", "Check TLS and VPN posture.", "Attach evidence.", "Create findings for gaps."],
    table: {
      headers: ["Control", "System", "Evidence", "Status"],
      rows: [
        ["TLS 1.2+", "api.hospital.org", "Cert scan", "Pass"],
        ["Certificate expiry", "portal.example", "30-day alert", "Warning"],
        ["VPN required", "Admin console", "Config export", "Pass"],
      ],
    },
    emptyState: { title: "No network controls", description: "Add transmission controls and certificate evidence." },
  },
]

const finalSpecs: FeatureSpec[] = [
  {
    href: "/dashboard/risk-assessment",
    section: "Risk & Compliance",
    title: "Risk Assessment",
    purpose: "Perform HIPAA-required annual risk analysis using threats, vulnerabilities, likelihood, and impact.",
    roles: ["Compliance Manager", "Security Officer", "Privacy Officer"],
    primaryAction: "Start assessment",
    secondaryAction: "Export assessment",
    status: "PENDING",
    statusLabel: "Annual cycle",
    metrics: [
      { label: "Open threats", value: "16", context: "Under analysis", trendPercent: 4, trendPositive: false },
      { label: "High risks", value: "5", context: "Need treatment", trendPercent: 2, trendPositive: false },
      { label: "Approved", value: "71%", context: "Assessment progress", trendPercent: 11 },
    ],
    workflow: ["Start assessment.", "Score likelihood and impact.", "Assign treatment owners.", "Approve and archive evidence."],
    table: { headers: ["Threat", "Likelihood", "Impact", "Treatment"], rows: [["Unauthorized PHI access", "Medium", "High", "Access review"], ["Vendor breach", "Low", "High", "BAA review"], ["Lost device", "Medium", "Medium", "Encryption control"]] },
    emptyState: { title: "No risk assessment", description: "Start the annual HIPAA risk analysis." },
  },
  {
    href: "/dashboard/policy-library",
    section: "Risk & Compliance",
    title: "Policy Library",
    purpose: "Manage HIPAA policies with version history, publishing, and acknowledgement requests.",
    roles: ["Privacy Officer", "Compliance Manager"],
    primaryAction: "Upload policy",
    secondaryAction: "Request acknowledgement",
    status: "PASS",
    statusLabel: "Current",
    metrics: [
      { label: "Policies", value: "11", context: "Published", trendPercent: 2 },
      { label: "Pending ack", value: "23", context: "Staff sign-off", trendPercent: 5, trendPositive: false },
      { label: "Draft updates", value: "2", context: "In review", trendPercent: 1 },
    ],
    workflow: ["Upload draft.", "Review changes.", "Publish version.", "Request staff acknowledgement."],
    table: { headers: ["Policy", "Version", "Owner", "State"], rows: [["Privacy Rule", "v3.1", "Privacy", "Published"], ["Security Rule", "v2.4", "Security", "Published"], ["Breach Notification", "v1.8", "Privacy", "Draft"]] },
    emptyState: { title: "No policies uploaded", description: "Upload HIPAA policies to manage versions and acknowledgements." },
  },
  {
    href: "/dashboard/baa-tracker",
    section: "Vendors & Partners",
    title: "BAA Tracker",
    purpose: "Track Business Associate Agreements, expirations, signed dates, and covered services.",
    roles: ["Privacy Officer", "Compliance Manager"],
    primaryAction: "Upload BAA",
    secondaryAction: "Set reminder",
    status: "WARNING",
    statusLabel: "2 expiring",
    metrics: [
      { label: "Active BAAs", value: "18", context: "Vendor coverage", trendPercent: 3 },
      { label: "Expiring soon", value: "2", context: "Next 60 days", trendPercent: 2, trendPositive: false },
      { label: "Missing BAAs", value: "1", context: "Needs action", trendPercent: 1, trendPositive: false },
    ],
    workflow: ["Add vendor.", "Upload BAA.", "Track expiration.", "Renew and archive evidence."],
    table: { headers: ["Vendor", "Signed", "Expiration", "Services"], rows: [["Cloud Storage Co", "Jan 12", "May 28", "Object storage"], ["Analytics BA", "Feb 09", "Jun 03", "Data analytics"], ["Billing Partner", "Mar 18", "Active", "Claims processing"]] },
    emptyState: { title: "No BAAs tracked", description: "Upload vendor BAAs to manage renewals and evidence." },
  },
  {
    href: "/dashboard/vendor-risk-scores",
    section: "Vendors & Partners",
    title: "Vendor Risk Scores",
    purpose: "Assess vendor due diligence with questionnaires, certifications, and risk drivers.",
    roles: ["Security Officer", "Compliance Manager"],
    primaryAction: "Send questionnaire",
    secondaryAction: "Upload certification",
    status: "PENDING",
    statusLabel: "Review cycle",
    metrics: [
      { label: "Average score", value: "82", context: "Vendor portfolio", trendPercent: 4 },
      { label: "Questionnaires due", value: "6", context: "Awaiting vendors", trendPercent: 6, trendPositive: false },
      { label: "Certified vendors", value: "12", context: "SOC 2 / HITRUST", trendPercent: 5 },
    ],
    workflow: ["Send questionnaire.", "Collect SOC 2/HITRUST evidence.", "Review risk drivers.", "Approve or reject vendor."],
    table: { headers: ["Vendor", "Score", "Evidence", "Decision"], rows: [["Cloud Storage Co", "88", "SOC 2", "Approved"], ["Analytics BA", "72", "Questionnaire", "Review"], ["Messaging Tool", "61", "Missing", "Hold"]] },
    emptyState: { title: "No vendor scores", description: "Send questionnaires or upload certifications to score vendors." },
  },
  {
    href: "/dashboard/subcontractor-register",
    section: "Vendors & Partners",
    title: "Subcontractor Register",
    purpose: "Track business associate subcontractors and sub-BAA status.",
    roles: ["Privacy Officer", "Compliance Manager"],
    primaryAction: "Add subcontractor",
    secondaryAction: "Request evidence",
    status: "WARNING",
    statusLabel: "Coverage gaps",
    metrics: [
      { label: "Sub-BAs", value: "9", context: "Registered", trendPercent: 2 },
      { label: "Missing evidence", value: "2", context: "Need sub-BAA", trendPercent: 2, trendPositive: false },
      { label: "Reviewed", value: "7", context: "This quarter", trendPercent: 5 },
    ],
    workflow: ["Add subcontractor.", "Link parent BA.", "Request BAA evidence.", "Flag missing coverage."],
    table: { headers: ["Subcontractor", "Parent BA", "Service", "BAA"], rows: [["Email Processor", "Messaging Tool", "Notifications", "Missing"], ["Data Warehouse", "Analytics BA", "Storage", "Uploaded"], ["Support Desk", "Billing Partner", "Support", "Uploaded"]] },
    emptyState: { title: "No subcontractors", description: "Register subcontractors used by your business associates." },
  },
  {
    href: "/dashboard/training-tracker",
    section: "Workforce",
    title: "Training Tracker",
    purpose: "Monitor HIPAA training completion by employee, department, manager, and due date.",
    roles: ["Compliance Manager", "HR/Admin"],
    primaryAction: "Assign course",
    secondaryAction: "Send reminders",
    status: "WARNING",
    statusLabel: "5 overdue",
    metrics: [
      { label: "Completion", value: "94%", context: "All workforce", trendPercent: 7 },
      { label: "Overdue", value: "5", context: "Needs reminder", trendPercent: 5, trendPositive: false },
      { label: "Due soon", value: "11", context: "Next 14 days", trendPercent: 3, trendPositive: false },
    ],
    workflow: ["Assign course.", "Track completion.", "Send reminders.", "Export evidence."],
    table: { headers: ["Employee", "Course", "Due", "Status"], rows: [["A. Patel", "HIPAA Privacy", "Apr 29", "Overdue"], ["R. Singh", "Security Awareness", "May 02", "Pending"], ["L. Nguyen", "Breach Awareness", "Complete", "Pass"]] },
    emptyState: { title: "No training assignments", description: "Assign courses to begin tracking workforce readiness." },
  },
  {
    href: "/dashboard/training-course-library",
    section: "Workforce",
    title: "Training Course Library",
    purpose: "Manage HIPAA training courses and assignment tools.",
    roles: ["Compliance Manager"],
    primaryAction: "Add course",
    secondaryAction: "Assign course",
    status: "PASS",
    statusLabel: "Available",
    metrics: [
      { label: "Courses", value: "8", context: "Active library", trendPercent: 2 },
      { label: "Assigned", value: "124", context: "Open assignments", trendPercent: 8 },
      { label: "Retired", value: "2", context: "Archived courses", trendPercent: 1, trendPositive: false },
    ],
    workflow: ["Create course.", "Define audience.", "Assign due date.", "Track completion."],
    table: { headers: ["Course", "Audience", "Duration", "State"], rows: [["HIPAA Privacy", "All staff", "30 min", "Active"], ["Security Awareness", "All staff", "25 min", "Active"], ["Breach Awareness", "Managers", "20 min", "Active"]] },
    emptyState: { title: "No training courses", description: "Add courses to create workforce assignments." },
  },
]

const incidentAndReportSpecs: FeatureSpec[] = [
  {
    href: "/dashboard/active-incidents",
    section: "Incidents & Breach",
    title: "Active Incidents",
    purpose: "Manage in-progress investigations with timeline, severity, investigator, and breach determination.",
    roles: ["Security Officer", "Privacy Officer"],
    primaryAction: "Add timeline event",
    secondaryAction: "Escalate severity",
    status: "WARNING",
    statusLabel: "Active cases",
    metrics: [
      { label: "Open incidents", value: "4", context: "In investigation", trendPercent: 4, trendPositive: false },
      { label: "Critical", value: "1", context: "Leadership aware", trendPercent: 1, trendPositive: false },
      { label: "Awaiting privacy", value: "2", context: "Breach decision", trendPercent: 2, trendPositive: false },
    ],
    workflow: ["Triage event.", "Assign investigator.", "Build timeline.", "Determine breach.", "Close with postmortem."],
    table: { headers: ["Incident", "Severity", "Investigator", "State"], rows: [["INC-104", "High", "Security Lead", "Investigating"], ["INC-105", "Medium", "Privacy Officer", "PHI review"], ["INC-106", "Critical", "CISO", "Escalated"]] },
    emptyState: { title: "No active incidents", description: "Submitted incidents requiring investigation will appear here." },
  },
  {
    href: "/dashboard/breach-notification-center",
    section: "Incidents & Breach",
    title: "Breach Notification Center",
    purpose: "Manage confirmed breach obligations including the 60-day HHS clock and notification drafting.",
    roles: ["Privacy Officer", "Compliance Manager", "Legal"],
    primaryAction: "Generate letter",
    secondaryAction: "Upload proof",
    status: "WARNING",
    statusLabel: "60-day clock",
    metrics: [
      { label: "Confirmed breaches", value: "1", context: "Notification active", trendPercent: 1, trendPositive: false },
      { label: "Days remaining", value: "42", context: "HHS notification", trendPercent: 4, trendPositive: false },
      { label: "Affected count", value: "183", context: "Individuals", trendPercent: 8, trendPositive: false },
    ],
    workflow: ["Confirm breach.", "Start notification clock.", "Draft letters.", "Mark HHS and individual notification complete."],
    table: { headers: ["Breach", "Affected", "Deadline", "Status"], rows: [["BR-001", "183", "Jun 08", "Drafting"], ["BR-000", "24", "Complete", "Archived"], ["BR-TEST", "0", "N/A", "Training"]] },
    emptyState: { title: "No confirmed breaches", description: "Confirmed breach workflows will appear here." },
  },
  {
    href: "/dashboard/incident-history",
    section: "Incidents & Breach",
    title: "Incident History",
    purpose: "Archive closed incidents with outcomes, postmortems, lessons learned, and related findings.",
    roles: ["Security Officer", "Privacy Officer", "Auditor"],
    primaryAction: "Export record",
    secondaryAction: "Reopen with reason",
    status: "PASS",
    statusLabel: "Archived",
    metrics: [
      { label: "Closed incidents", value: "17", context: "This year", trendPercent: 6 },
      { label: "Postmortems", value: "15", context: "Completed", trendPercent: 5 },
      { label: "Reopened", value: "1", context: "This quarter", trendPercent: 1, trendPositive: false },
    ],
    workflow: ["Review closed case.", "Read outcome and root cause.", "Export evidence.", "Reopen only with reason."],
    table: { headers: ["Incident", "Outcome", "Root cause", "Closed"], rows: [["INC-099", "No breach", "Misrouted email", "Apr 12"], ["INC-087", "Breach", "Access error", "Mar 29"], ["INC-081", "No breach", "False alarm", "Mar 04"]] },
    emptyState: { title: "No incident history", description: "Closed investigations will be archived here." },
  },
  {
    href: "/dashboard/report-generator",
    section: "Reports & Audit",
    title: "Report Generator",
    purpose: "Build on-demand reports by domain, date range, framework, or evidence type.",
    roles: ["Compliance Manager", "Auditor"],
    primaryAction: "Generate report",
    secondaryAction: "Save template",
    status: "PASS",
    statusLabel: "Ready",
    metrics: [
      { label: "Templates", value: "9", context: "Reusable reports", trendPercent: 2 },
      { label: "Generated", value: "14", context: "This month", trendPercent: 7 },
      { label: "Domains", value: "8", context: "Reportable areas", trendPercent: 1 },
    ],
    workflow: ["Select report type.", "Choose domain and date range.", "Preview evidence.", "Export PDF or CSV."],
    table: { headers: ["Report", "Domain", "Format", "Use"], rows: [["Executive summary", "All", "PDF", "Leadership"], ["Findings export", "Risk", "CSV", "Remediation"], ["Training evidence", "Workforce", "PDF", "Audit"]] },
    emptyState: { title: "No reports generated", description: "Create a report from compliance and evidence data." },
  },
  {
    href: "/dashboard/audit-packages",
    section: "Reports & Audit",
    title: "Audit Packages",
    purpose: "Create pre-built evidence bundles for OCR audits or internal reviews.",
    roles: ["Compliance Manager", "Auditor"],
    primaryAction: "Build package",
    secondaryAction: "Add evidence",
    status: "WARNING",
    statusLabel: "Evidence gaps",
    metrics: [
      { label: "Packages", value: "5", context: "Available templates", trendPercent: 1 },
      { label: "Evidence gaps", value: "7", context: "Before export", trendPercent: 3, trendPositive: false },
      { label: "Exports", value: "4", context: "This quarter", trendPercent: 4 },
    ],
    workflow: ["Select package type.", "Review collected evidence.", "Resolve missing items.", "Export and archive."],
    table: { headers: ["Package", "Evidence", "Gaps", "Owner"], rows: [["OCR Audit", "82%", "7", "Compliance"], ["Security Rule", "91%", "3", "Security"], ["Training Evidence", "96%", "1", "HR"]] },
    emptyState: { title: "No audit packages", description: "Build a package from controls, policies, incidents, vendors, and training evidence." },
  },
  {
    href: "/dashboard/previous-reports-archive",
    section: "Reports & Audit",
    title: "Previous Reports Archive",
    purpose: "Store generated reports and packages with retention metadata.",
    roles: ["Compliance Manager", "Auditor"],
    primaryAction: "Download report",
    secondaryAction: "Re-run report",
    status: "PASS",
    statusLabel: "Archived",
    metrics: [
      { label: "Archived reports", value: "42", context: "Retained evidence", trendPercent: 8 },
      { label: "Retention alerts", value: "0", context: "No action", trendPercent: 1 },
      { label: "Downloads", value: "11", context: "Last 30 days", trendPercent: 6 },
    ],
    workflow: ["Find report.", "Review generation metadata.", "Download or re-run.", "Respect retention policy."],
    table: { headers: ["Report", "Generated by", "Date", "Format"], rows: [["Q1 audit package", "Compliance", "Apr 01", "ZIP"], ["Training export", "HR", "Mar 28", "CSV"], ["Risk summary", "Security", "Mar 18", "PDF"]] },
    emptyState: { title: "No archived reports", description: "Generated reports will be retained here." },
  },
]

const settingsSpecs: FeatureSpec[] = [
  {
    href: "/dashboard/organization-profile",
    section: "Settings",
    title: "Organization Profile",
    purpose: "Manage organization identity, logo, contacts, and HIPAA classification.",
    roles: ["Admin", "Compliance Manager"],
    primaryAction: "Edit profile",
    secondaryAction: "Upload logo",
    status: "PASS",
    statusLabel: "Complete",
    metrics: [
      { label: "Contacts", value: "3", context: "Security, privacy, billing", trendPercent: 1 },
      { label: "Profile fields", value: "100%", context: "Complete", trendPercent: 4 },
      { label: "Last reviewed", value: "12d", context: "Ago", trendPercent: 1 },
    ],
    workflow: ["Update organization details.", "Set contacts.", "Set covered entity/BA classification.", "Audit profile changes."],
    table: { headers: ["Field", "Value", "Owner", "Status"], rows: [["Security contact", "security@example.com", "Admin", "Set"], ["Privacy contact", "privacy@example.com", "Privacy", "Set"], ["Classification", "Business Associate", "Compliance", "Set"]] },
    emptyState: { title: "Organization profile incomplete", description: "Add contacts and classification to complete setup." },
  },
  {
    href: "/dashboard/integrations",
    section: "Settings",
    title: "Integrations",
    purpose: "Connect SSO, SIEM, EHR, cloud providers, Slack alerts, and APIs.",
    roles: ["Admin", "Security Officer", "Developer"],
    primaryAction: "Connect integration",
    secondaryAction: "View API keys",
    status: "WARNING",
    statusLabel: "2 errors",
    metrics: [
      { label: "Connected", value: "6", context: "Active integrations", trendPercent: 3 },
      { label: "Sync errors", value: "2", context: "Needs repair", trendPercent: 2, trendPositive: false },
      { label: "Last sync", value: "8m", context: "Ago", trendPercent: 1 },
    ],
    workflow: ["Choose integration.", "Authorize connection.", "Validate sync.", "Monitor health and errors."],
    table: { headers: ["Integration", "Type", "Last sync", "State"], rows: [["Supabase", "Auth/Data", "8m ago", "Connected"], ["Slack", "Alerts", "1h ago", "Connected"], ["SIEM", "Logs", "Failed", "Error"]] },
    emptyState: { title: "No integrations connected", description: "Connect systems to power scans, alerts, audit logs, and reports." },
  },
  {
    href: "/dashboard/notification-preferences",
    section: "Settings",
    title: "Notification Preferences",
    purpose: "Define who gets alerted for what severity, module, channel, and escalation path.",
    roles: ["Admin", "Compliance Manager"],
    primaryAction: "Edit routing",
    secondaryAction: "Test alert",
    status: "PASS",
    statusLabel: "Routed",
    metrics: [
      { label: "Rules", value: "18", context: "Alert routes", trendPercent: 2 },
      { label: "Critical routes", value: "5", context: "Leadership escalation", trendPercent: 1 },
      { label: "Muted rules", value: "1", context: "Review monthly", trendPercent: 1, trendPositive: false },
    ],
    workflow: ["Choose event type.", "Set severity threshold.", "Select recipients/channels.", "Define escalation."],
    table: { headers: ["Event", "Severity", "Recipients", "Channel"], rows: [["Critical findings", "Critical", "Security + Compliance", "Slack/Email"], ["BAA expiry", "Warning", "Privacy", "Email"], ["Training overdue", "Warning", "HR", "Email"]] },
    emptyState: { title: "No notification rules", description: "Create routing rules for compliance events and deadlines." },
  },
  {
    href: "/dashboard/user-management",
    section: "Settings",
    title: "User Management",
    purpose: "Invite, remove, deactivate, and assign application users to roles.",
    roles: ["Admin"],
    primaryAction: "Invite user",
    secondaryAction: "Manage roles",
    status: "PASS",
    statusLabel: "74 users",
    metrics: [
      { label: "Users", value: "74", context: "Active", trendPercent: 6 },
      { label: "Pending invites", value: "4", context: "Awaiting signup", trendPercent: 2, trendPositive: false },
      { label: "Admins", value: "3", context: "Privileged", trendPercent: 1, trendPositive: false },
    ],
    workflow: ["Invite user.", "Assign role.", "Review access.", "Deactivate when needed."],
    table: { headers: ["User", "Role", "Status", "Last active"], rows: [["A. Patel", "Privacy Officer", "Active", "Today"], ["R. Singh", "Developer", "Active", "Yesterday"], ["L. Nguyen", "Auditor", "Invited", "Pending"]] },
    emptyState: { title: "No users", description: "Invite users to begin assigning responsibilities." },
  },
]

export const allFeatureSpecs = [
  ...featureSpecs,
  ...moreSpecs,
  ...finalSpecs,
  ...incidentAndReportSpecs,
  ...settingsSpecs,
]

export function getFeatureSpecByHref(href: string): FeatureSpec | undefined {
  return allFeatureSpecs.find((feature) => feature.href === href)
}
