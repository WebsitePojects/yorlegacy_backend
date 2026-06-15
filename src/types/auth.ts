export type AppRole = 'member' | 'admin' | 'cashier' | 'bod' | 'superadmin';
export type MoneyMode = 'playground' | 'sandbox' | 'production';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
};

export type SessionPayload = SessionUser & {
  exp: number;
  iat: number; // issued-at, for revocation checking
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

export type MemberAccountStatus = 'active' | 'pending' | 'frozen' | 'suspended';

export type AdminMemberDirectoryRow = {
  username: string;
  fullName: string;
  packageTier: string;
  accountStatus: MemberAccountStatus;
  stockist: boolean;
  sponsorCode: string;
  directReferrals: number;
  walletAvailable: string;
  cdBalance: string;
  lastActivity: string;
  actions: string[];
};

export type AdminMemberProfile = {
  username: string;
  fullName: string;
  firstName: string;
  lastName: string;
  middleName: string;
  packageTier: string;
  accountStatus: MemberAccountStatus;
  stockist: boolean;
  referralCode: string;
  sponsorCode: string;
  email: string;
  phone: string;
  address: string;
  payoutOption: string;
  payoutDetails: string;
  directReferrals: number;
  walletAvailable: string;
  walletPending: string;
  cdBalance: string;
  lastActivity: string;
  actions: string[];
};

export type AdminMemberManagementCenter = {
  moneyMode: MoneyMode;
  query: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  rows: AdminMemberDirectoryRow[];
  selectedMember: AdminMemberProfile | null;
  actionNotes: string[];
};

export type ShadowAccountCenter = {
  moneyMode: MoneyMode;
  owner: string;
  accounts: Array<{
    id: string;
    owner: string;
    state: string;
    placement: 'left' | 'right';
    walletEnabled: boolean;
    unilevelEnabled: boolean;
    binaryCycleEnabled: boolean;
    note: string;
  }>;
};
