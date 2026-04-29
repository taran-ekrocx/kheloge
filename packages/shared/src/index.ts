// Shared types, constants, and utilities for Kheloge monorepo

// ─────────────────────────────────────────────
// Auth types
// ─────────────────────────────────────────────

export interface JwtPayload {
  sub: string;       // userId
  orgId: string;     // organizationId
  role: string;      // UserRole
  name?: string;     // display name
  venueId?: string;  // scoped venue
  cityId?: string;   // scoped city
  iat?: number;
  exp?: number;
}

export interface OtpRequestDto {
  phone: string;
}

export interface OtpVerifyDto {
  phone: string;
  otp: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ─────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─────────────────────────────────────────────
// Common response
// ─────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

export const INDIA_TIMEZONE = 'Asia/Kolkata';
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const OTP_EXPIRY_MINUTES = 10;
export const ACCESS_TOKEN_EXPIRY = '15m';
export const REFRESH_TOKEN_EXPIRY = '30d';
