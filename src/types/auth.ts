export type AppRole = 'member' | 'admin';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
};

export type SessionPayload = SessionUser & {
  exp: number;
};

export type MemberOfficeData = {
  user: SessionUser;
  wallet: {
    availableBalance: string;
    pendingBalance: string;
    payoutSchedule: string;
  };
  profile: {
    packageTier: string;
    referralCode: string;
    sponsorCode: string;
    accountStatus: string;
  };
  actions: string[];
  alerts: string[];
};

export type AdminOfficeData = {
  user: SessionUser;
  metrics: Array<{
    label: string;
    value: string;
  }>;
  queues: string[];
  controls: string[];
  notices: string[];
};
