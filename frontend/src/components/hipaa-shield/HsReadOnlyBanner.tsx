import { HsAlertBanner } from "@/components/hipaa-shield/HsAlertBanner";

export function HsReadOnlyBanner() {
  return (
    <HsAlertBanner variant="INFO">
      <span className="font-medium">Read-only access:</span>{" "}
      <span>You can view this page, but create, edit, and delete actions are disabled.</span>
    </HsAlertBanner>
  );
}
