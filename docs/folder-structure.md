Recommended folder structure (Auth module)

Here’s what I’d actually ship to production 👇

```
src/
 └── modules/
     └── auth/
         ├── auth.routes.ts
         ├── auth.controller.ts
         ├── auth.service.ts
         ├── auth.validation.ts
         ├── auth.middleware.ts
         ├── auth.constants.ts
         ├── auth.types.ts
         ├── auth.repository.ts
         └── index.ts
```

Now let’s justify every folder/file — no cargo culting.

1️⃣ auth.routes.ts (MANDATORY)

Responsibility

Define routes only

Attach middleware

Map route → controller method

Should NOT contain

Business logic

Validation logic

DB calls

router.post(
  "/login",
  validate(loginSchema),
  authController.login
);


✔ Keeps HTTP wiring separate
✔ Easy to scan API surface

2️⃣ auth.controller.ts (THIN ONLY)

Responsibility

Extract request data

Call service

Return response

Red flags

No DB queries

No JWT logic

No password hashing

async login(req: Request, res: Response) {
  const result = await authService.login(req.body);
  res.json(result);
}


If your controller grows beyond ~100 lines → architecture problem 🚨

3️⃣ auth.service.ts (MOST IMPORTANT)

This is where real work happens.

Responsibility

Authentication logic

Token generation

Password verification

User state rules

async login(dto: LoginDTO) {
  const user = await authRepo.findByEmail(dto.email);
  if (!user) throw new UnauthorizedError();

  const valid = await compare(dto.password, user.password);
  if (!valid) throw new UnauthorizedError();

  return this.issueTokens(user);
}


✔ Testable
✔ Reusable
✔ Framework-agnostic

4️⃣ auth.validation.ts (YES, YOU NEED THIS)

Do NOT validate inside controllers

Use:

zod (recommended)

or joi

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});


Validation is input boundary logic, not business logic.

5️⃣ auth.middleware.ts (CRITICAL)

Used for:

JWT verification

Role checks

Refresh token guards

export const requireAuth = (req, res, next) => {
  // verify JWT
};


Why separate?

Middleware is cross-cutting

Shared across modules

6️⃣ auth.repository.ts (VERY IMPORTANT – MOST PEOPLE SKIP THIS)

This is your data access layer.

Responsibility

DB queries only

No business logic

No HTTP logic

findByEmail(email: string) {
  return UserModel.findOne({ email });
}

Why this matters

You can swap Mongo → Postgres later

You can mock repositories in tests

Your service layer stays clean

7️⃣ auth.types.ts (OPTIONAL BUT STRONGLY RECOMMENDED)

Use this for:

DTOs

Response shapes

Token payloads

export interface LoginDTO {
  email: string;
  password: string;
}


Keeps TypeScript intentional, not accidental.

8️⃣ auth.constants.ts (OPTIONAL)

Only if you have:

Token expiry times

Cookie names

Role names

export const ACCESS_TOKEN_TTL = "15m";


If it’s used in more than one file → move here.

9️⃣ index.ts (QUALITY OF LIFE)

Re-export everything:

export * from "./auth.routes";


Makes imports clean and avoids deep paths.