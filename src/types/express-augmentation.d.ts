import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    validatedQuery?: unknown;
    validatedBody?: unknown;
    validatedParams?: unknown;
  }
}
