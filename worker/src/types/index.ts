export interface Env {
  SESSIONS: KVNamespace;
  METRICS: KVNamespace;
  RATE_LIMITS: KVNamespace;
  USERS: KVNamespace;
  AUTH_EVENTS?: any;
  JWT_SECRET: string;
  TURNSTILE_SECRET: string;
  ALERT_WEBHOOK: string;
  ENVIRONMENT: string;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: number;
  lastLogin?: number;
  reputation: number;
  sessions: string[];
  apiKeys: string[];
  settings: UserSettings;
}

export interface UserSettings {
  require2FA: boolean;
  geoRestrictions: string[];
  allowedDevices: string[];
  notificationEmail: string;
}

export interface Session {
  id: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  ipAddress: string;
  userAgent: string;
  location?: Location;
  deviceFingerprint: string;
}

export interface APIKey {
  key: string;
  userId: string;
  name: string;
  createdAt: number;
  lastUsed?: number;
  rateLimit: number;
  scopes: string[];
}

export interface Location {
  country: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface LoginAttempt {
  timestamp: number;
  ipAddress: string;
  success: boolean;
  username?: string;
  userId?: string;
  userAgent: string;
  location?: Location;
  deviceFingerprint: string;
  authMethod: 'form' | 'api_key' | 'session';
}

export interface RiskFactors {
  bruteForce: number;
  credentialStuffing: number;
  geoVelocity: number;
  anomaly: number;
  deviceReputation: number;
  composite: number;
  level: RiskLevel;
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AuthRequest {
  email?: string;
  password?: string;
  apiKey?: string;
  turnstileToken?: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  message: string;
  requireChallenge?: boolean;
  challengeType?: 'turnstile' | 'managed';
  riskScore?: number;
  session?: Session;
}

export interface ChallengeRequest {
  sessionId: string;
  turnstileToken?: string;
  managedChallengeResponse?: string;
}

export interface Metrics {
  totalAttempts: number;
  successfulLogins: number;
  failedLogins: number;
  blockedAttempts: number;
  challengesIssued: number;
  challengeCompletions: number;
  riskScoreDistribution: Record<RiskLevel, number>;
  attackTypes: Record<string, number>;
  topRiskIPs: Array<{ ip: string; score: number; attempts: number }>;
  hourlyAttempts: Array<{ hour: number; attempts: number; blocked: number }>;
}

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  timestamp: number;
  message: string;
  details: Record<string, any>;
  resolved: boolean;
}