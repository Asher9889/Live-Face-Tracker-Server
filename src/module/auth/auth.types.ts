export type AccessTokenPayload = {
  id: string;
  role: "admin" | "guard" | "viewer";
};

export type RefreshTokenPayload = {
    id: string;
    role: "admin" | "guard" | "viewer";
}

export interface ITokens {
    accessToken: string;
    refreshToken: string;
}