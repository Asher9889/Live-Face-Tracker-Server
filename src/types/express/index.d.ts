declare global {
  namespace Express {
    export interface Request {
      validatedQuery?: unknown;
      validatedBody?: unknown;
      validatedParams?: unknown;
    }
    // You can also extend the Response interface here if needed
    // export interface Response {
    //   sendError(statusCode: number, errorMessage: string): void;
    // }
  }
}