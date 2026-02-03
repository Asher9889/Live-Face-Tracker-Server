export type AccessTokenPayload = {
  id: string;
  role: "admin" | "guard" | "viewer";
};

export type ServiceTokenPayload = {
  type: "service";
  service: string;
  role: "internal";
}

export type RefreshTokenPayload = {
  id: string;
  role: "admin" | "guard" | "viewer";
}

export interface ITokens {
  accessToken: string;
  refreshToken: string;
}