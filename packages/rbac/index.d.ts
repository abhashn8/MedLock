export declare const ROLES: readonly [
  "admin",
  "privacy_officer",
  "security_officer",
  "compliance_manager",
  "auditor",
  "data_analyst",
  "developer",
];

export type Role = (typeof ROLES)[number];
export type Permission = "full" | "read_only" | "none";

export type NavPage =
  | "dashboard"
  | "compliance_score_trend"
  | "phi_leakage_scanner"
  | "phi_inventory"
  | "de_identification_checker"
  | "access_control_settings"
  | "role_management"
  | "user_access_review"
  | "emergency_access_log"
  | "encryption_inventory"
  | "audit_log_viewer"
  | "anomaly_alerts"
  | "network_transmission_security"
  | "risk_assessment"
  | "findings_remediation"
  | "policy_library"
  | "controls_checklist"
  | "baa_tracker"
  | "vendor_risk_scores"
  | "subcontractor_register"
  | "training_tracker"
  | "training_course_library"
  | "policy_acknowledgements"
  | "sanctions_log"
  | "incident_intake"
  | "active_incidents"
  | "breach_notification_center"
  | "incident_history"
  | "report_generator"
  | "scheduled_reports"
  | "audit_packages"
  | "previous_reports_archive"
  | "organization_profile"
  | "integrations"
  | "notification_preferences"
  | "user_management"
  | "billing_plan";

export type RoleColor = "purple" | "teal" | "red" | "blue" | "amber" | "gray" | "pink";

export declare const ROLE_DETAILS: Record<Role, {
  label: string;
  color: RoleColor;
  description: string;
}>;

export declare const NAV_PAGES: readonly NavPage[];
export declare const PERMISSIONS: Record<NavPage, Record<Role, Permission>>;
export declare const PAGE_LABELS: Record<NavPage, string>;
export declare const ROUTE_TO_PAGE: Record<string, NavPage>;

export declare function isRole(role: unknown): role is Role;
export declare function pageForRoute(route: string): NavPage | null;
export declare function can(role: Role | string | null | undefined, page: NavPage): Permission;
export declare function canAccess(role: Role | string | null | undefined, page: NavPage): boolean;
export declare function canWrite(role: Role | string | null | undefined, page: NavPage): boolean;
export declare function permissionMeets(actual: Permission, required: Permission): boolean;
