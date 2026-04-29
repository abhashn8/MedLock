export const ROLES = [
  "admin",
  "privacy_officer",
  "security_officer",
  "compliance_manager",
  "auditor",
  "data_analyst",
  "developer",
];

export const ROLE_DETAILS = {
  admin: {
    label: "Admin",
    color: "purple",
    description: "Full access including billing and role management",
  },
  privacy_officer: {
    label: "Privacy Officer",
    color: "teal",
    description: "PHI governance, policies, breach notification",
  },
  security_officer: {
    label: "Security Officer",
    color: "red",
    description: "Technical controls, encryption, access management",
  },
  compliance_manager: {
    label: "Compliance Manager",
    color: "blue",
    description: "Risk, findings, vendors, workforce, reports",
  },
  auditor: {
    label: "Auditor",
    color: "amber",
    description: "Read-only across all compliance areas",
  },
  data_analyst: {
    label: "Data Analyst",
    color: "gray",
    description: "De-identification tools and PHI scanner",
  },
  developer: {
    label: "Developer",
    color: "pink",
    description: "Technical security pages and integrations",
  },
};

export const NAV_PAGES = [
  "dashboard",
  "compliance_score_trend",
  "phi_leakage_scanner",
  "phi_inventory",
  "de_identification_checker",
  "access_control_settings",
  "role_management",
  "user_access_review",
  "audit_log_viewer",
  "anomaly_alerts",
  "network_transmission_security",
  "risk_assessment",
  "policy_library",
  "baa_tracker",
  "vendor_risk_scores",
  "subcontractor_register",
  "training_tracker",
  "training_course_library",
  "active_incidents",
  "breach_notification_center",
  "incident_history",
  "report_generator",
  "audit_packages",
  "previous_reports_archive",
  "organization_profile",
  "integrations",
  "notification_preferences",
  "user_management",
];

export const PERMISSIONS = {
  dashboard: { admin: "full", privacy_officer: "full", security_officer: "full", compliance_manager: "full", auditor: "read_only", data_analyst: "read_only", developer: "read_only" },
  compliance_score_trend: { admin: "full", privacy_officer: "full", security_officer: "full", compliance_manager: "full", auditor: "read_only", data_analyst: "none", developer: "none" },
  phi_leakage_scanner: { admin: "full", privacy_officer: "full", security_officer: "full", compliance_manager: "read_only", auditor: "read_only", data_analyst: "none", developer: "full" },
  phi_inventory: { admin: "full", privacy_officer: "full", security_officer: "read_only", compliance_manager: "full", auditor: "read_only", data_analyst: "none", developer: "none" },
  de_identification_checker: { admin: "full", privacy_officer: "full", security_officer: "none", compliance_manager: "read_only", auditor: "read_only", data_analyst: "full", developer: "full" },
  access_control_settings: { admin: "full", privacy_officer: "none", security_officer: "full", compliance_manager: "read_only", auditor: "read_only", data_analyst: "none", developer: "none" },
  role_management: { admin: "full", privacy_officer: "none", security_officer: "none", compliance_manager: "none", auditor: "none", data_analyst: "none", developer: "none" },
  user_access_review: { admin: "full", privacy_officer: "none", security_officer: "full", compliance_manager: "full", auditor: "read_only", data_analyst: "none", developer: "none" },
  audit_log_viewer: { admin: "full", privacy_officer: "full", security_officer: "full", compliance_manager: "full", auditor: "read_only", data_analyst: "none", developer: "none" },
  anomaly_alerts: { admin: "full", privacy_officer: "none", security_officer: "full", compliance_manager: "read_only", auditor: "read_only", data_analyst: "none", developer: "full" },
  network_transmission_security: { admin: "full", privacy_officer: "none", security_officer: "full", compliance_manager: "read_only", auditor: "read_only", data_analyst: "none", developer: "full" },
  risk_assessment: { admin: "full", privacy_officer: "full", security_officer: "full", compliance_manager: "full", auditor: "read_only", data_analyst: "none", developer: "none" },
  policy_library: { admin: "full", privacy_officer: "full", security_officer: "read_only", compliance_manager: "full", auditor: "read_only", data_analyst: "none", developer: "none" },
  baa_tracker: { admin: "full", privacy_officer: "full", security_officer: "read_only", compliance_manager: "full", auditor: "read_only", data_analyst: "none", developer: "none" },
  vendor_risk_scores: { admin: "full", privacy_officer: "read_only", security_officer: "full", compliance_manager: "full", auditor: "read_only", data_analyst: "none", developer: "none" },
  subcontractor_register: { admin: "full", privacy_officer: "read_only", security_officer: "full", compliance_manager: "full", auditor: "read_only", data_analyst: "none", developer: "none" },
  training_tracker: { admin: "full", privacy_officer: "full", security_officer: "read_only", compliance_manager: "full", auditor: "read_only", data_analyst: "none", developer: "none" },
  training_course_library: { admin: "full", privacy_officer: "full", security_officer: "read_only", compliance_manager: "full", auditor: "read_only", data_analyst: "none", developer: "none" },
  active_incidents: { admin: "full", privacy_officer: "full", security_officer: "full", compliance_manager: "full", auditor: "read_only", data_analyst: "none", developer: "none" },
  breach_notification_center: { admin: "full", privacy_officer: "full", security_officer: "read_only", compliance_manager: "full", auditor: "read_only", data_analyst: "none", developer: "none" },
  incident_history: { admin: "full", privacy_officer: "full", security_officer: "full", compliance_manager: "full", auditor: "read_only", data_analyst: "none", developer: "none" },
  report_generator: { admin: "full", privacy_officer: "full", security_officer: "full", compliance_manager: "full", auditor: "read_only", data_analyst: "none", developer: "none" },
  audit_packages: { admin: "full", privacy_officer: "full", security_officer: "read_only", compliance_manager: "full", auditor: "read_only", data_analyst: "none", developer: "none" },
  previous_reports_archive: { admin: "full", privacy_officer: "full", security_officer: "read_only", compliance_manager: "full", auditor: "read_only", data_analyst: "none", developer: "none" },
  organization_profile: { admin: "full", privacy_officer: "read_only", security_officer: "read_only", compliance_manager: "read_only", auditor: "none", data_analyst: "none", developer: "none" },
  integrations: { admin: "full", privacy_officer: "none", security_officer: "full", compliance_manager: "none", auditor: "none", data_analyst: "none", developer: "full" },
  notification_preferences: { admin: "full", privacy_officer: "full", security_officer: "full", compliance_manager: "full", auditor: "full", data_analyst: "full", developer: "full" },
  user_management: { admin: "full", privacy_officer: "none", security_officer: "none", compliance_manager: "none", auditor: "none", data_analyst: "none", developer: "none" },
};

export const PAGE_LABELS = {
  dashboard: "Dashboard",
  compliance_score_trend: "Compliance score trend",
  phi_leakage_scanner: "PHI leakage scanner",
  phi_inventory: "PHI inventory",
  de_identification_checker: "De-identification checker",
  access_control_settings: "Access control settings",
  role_management: "Role management",
  user_access_review: "User access review",
  audit_log_viewer: "Audit log viewer",
  anomaly_alerts: "Anomaly alerts",
  network_transmission_security: "Network & transmission security",
  risk_assessment: "Risk assessment",
  policy_library: "Policy library",
  baa_tracker: "BAA tracker",
  vendor_risk_scores: "Vendor risk scores",
  subcontractor_register: "Subcontractor register",
  training_tracker: "Training tracker",
  training_course_library: "Training course library",
  active_incidents: "Active incidents",
  breach_notification_center: "Breach notification center",
  incident_history: "Incident history",
  report_generator: "Report generator",
  audit_packages: "Audit packages",
  previous_reports_archive: "Previous reports archive",
  organization_profile: "Organization profile",
  integrations: "Integrations",
  notification_preferences: "Notification preferences",
  user_management: "User management",
};

export const ROUTE_TO_PAGE = {
  "/dashboard": "dashboard",
  "/dashboard/compliance-score-trend": "compliance_score_trend",
  "/dashboard/phi-leakage-scanner": "phi_leakage_scanner",
  "/dashboard/phi-inventory": "phi_inventory",
  "/dashboard/de-identification-checker": "de_identification_checker",
  "/dashboard/access-control-settings": "access_control_settings",
  "/dashboard/role-management": "role_management",
  "/dashboard/user-access-review": "user_access_review",
  "/dashboard/audit-log-viewer": "audit_log_viewer",
  "/dashboard/anomaly-alerts": "anomaly_alerts",
  "/dashboard/network-transmission-security": "network_transmission_security",
  "/dashboard/risk-assessment": "risk_assessment",
  "/dashboard/policy-library": "policy_library",
  "/dashboard/baa-tracker": "baa_tracker",
  "/dashboard/vendor-risk-scores": "vendor_risk_scores",
  "/dashboard/subcontractor-register": "subcontractor_register",
  "/dashboard/training-tracker": "training_tracker",
  "/dashboard/training-course-library": "training_course_library",
  "/dashboard/active-incidents": "active_incidents",
  "/dashboard/breach-notification-center": "breach_notification_center",
  "/dashboard/incident-history": "incident_history",
  "/dashboard/report-generator": "report_generator",
  "/dashboard/audit-packages": "audit_packages",
  "/dashboard/previous-reports-archive": "previous_reports_archive",
  "/dashboard/organization-profile": "organization_profile",
  "/dashboard/integrations": "integrations",
  "/dashboard/notification-preferences": "notification_preferences",
  "/dashboard/user-management": "user_management",
};

export function isRole(role) {
  return ROLES.includes(role);
}

export function pageForRoute(route) {
  return ROUTE_TO_PAGE[route] ?? null;
}

export function can(role, page) {
  if (!isRole(role) || !PERMISSIONS[page]) return "none";
  return PERMISSIONS[page][role] ?? "none";
}

export function canAccess(role, page) {
  return can(role, page) !== "none";
}

export function canWrite(role, page) {
  return can(role, page) === "full";
}

export function permissionMeets(actual, required) {
  const levels = { none: 0, read_only: 1, full: 2 };
  return levels[actual] >= levels[required];
}
