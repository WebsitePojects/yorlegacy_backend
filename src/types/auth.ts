export type AppRole = 'member' | 'admin' | 'cashier' | 'bod' | 'superadmin';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
};

export type SessionPayload = SessionUser & {
  exp: number;
};

export type OperationalMetric = {
  label: string;
  value: string;
  detail?: string;
  tone?: 'neutral' | 'good' | 'warning' | 'danger';
};

export type ReportColumn = {
  key: string;
  label: string;
};

export type ReportRow = Record<string, string | number>;

export type ReportTable = {
  title: string;
  columns: ReportColumn[];
  rows: ReportRow[];
};

export type GatedAction = {
  label: string;
  reason: string;
  requiredEvidence: string;
};

export type OperationalModule = {
  id: string;
  label: string;
  path: string;
  group: string;
  description: string;
  status: 'live-report' | 'read-only' | 'sandbox-write' | 'playground-write';
  legacyReference: string;
  permissions: AppRole[];
  metrics: OperationalMetric[];
  table: ReportTable;
  gatedActions: GatedAction[];
};

export type OperationalQueue = {
  label: string;
  count: number;
  status: 'clear' | 'watch' | 'attention';
};

export type AuditEvent = {
  actor: string;
  action: string;
  target: string;
  occurredAt: string;
};

export type MemberOfficeData = {
  user: SessionUser;
  profile: {
    packageTier: string;
    referralCode: string;
    sponsorCode: string;
    accountStatus: string;
    username: string;
    fullName: string;
    payoutMethod: string;
  };
  wallet: {
    availableBalance: string;
    pendingBalance: string;
    payoutSchedule: string;
  };
  metrics: OperationalMetric[];
  modules: OperationalModule[];
  gatedActions: GatedAction[];
  alerts: string[];
};

export type AdminOfficeData = {
  user: SessionUser;
  profile: {
    accessScope: string;
    officeTitle: string;
  };
  metrics: OperationalMetric[];
  modules: OperationalModule[];
  queues: OperationalQueue[];
  auditEvents: AuditEvent[];
  gatedActions: GatedAction[];
  notices: string[];
};
