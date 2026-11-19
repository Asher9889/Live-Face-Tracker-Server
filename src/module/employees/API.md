# Employee Module - Frontend API Contract

Base URL: `/api/v1/employees`

All endpoints in this module require authentication. Send the access token either as:
- Cookie: `accessToken=<token>`, or
- Header: `Authorization: Bearer <token>`

If the token is missing or invalid the API returns `401`.

---

## Response envelope

Every success response uses this shape:

```ts
type ApiSuccess<T> = {
  success: true;
  statusCode: number;
  message: string;
  data: T;
};
```

Every error response uses this shape:

```ts
type ApiError = {
  success: false;
  statusCode: number;
  message: string;
  errors: Array<{ field?: string; message: string }>;
};
```

Validation failures return `400` with `message: "Please provide valid data"` and a per-field `errors` array.

---

## Enums

```ts
type Department =
  | "Engineering"
  | "HR"
  | "Marketing"
  | "Sales"
  | "Admin"
  | "Operations";

type Role = "Admin" | "Manager" | "Employee" | "Intern";
```

Values are case-sensitive and must match exactly.

---

## Endpoint summary

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/employees` | Create employee with face images |
| GET | `/api/v1/employees` | List employees (cursor pagination) |
| GET | `/api/v1/employees/search?name=` | Search employees by name |
| POST | `/api/v1/employees/promote` | Convert an unknown identity into an employee |
| GET | `/api/v1/employees/:employeeId` | Get employee profile |
| GET | `/api/v1/employees/embeddings` | Internal embedding export (not for UI) |

---

## POST `/api/v1/employees`

Create a new employee. `multipart/form-data` only (face images need to be uploaded).

### Form fields

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `name` | string | yes | 3-50 characters |
| `email` | string | yes | valid email, must be unique |
| `department` | string | yes | one of the `Department` enum values |
| `role` | string | yes | one of the `Role` enum values |
| `face` | file | yes | 3 to 10 images, JPG/PNG, max 5 MB each |

Notes:
- The file field name must be exactly `face` (repeat the field once per image).
- Upload between 3 and 10 images. Fewer than 3 returns `400`.
- Only `image/jpeg` and `image/png` are accepted.
- Max file size is 5 MB per image.
- Images are used to generate face embeddings; they must clearly show the face.

### Example request

```bash
curl -X POST 'http://localhost:3000/api/v1/employees' \
  -H 'Authorization: Bearer <token>' \
  -F 'name=John Doe' \
  -F 'email=john.doe@example.com' \
  -F 'department=Engineering' \
  -F 'role=Employee' \
  -F 'face=@face-frontal.jpg' \
  -F 'face=@face-left.jpg' \
  -F 'face=@face-right.jpg'
```

### Success `201`

```ts
type CreateEmployeeData = {
  id: string;                 // Mongo ObjectId string
  name: string;
  email: string;
  department: Department;
  role: Role;
  faceImages: string[];       // MinIO object keys, NOT public URLs
  embeddings: number[][];     // generated face vectors (can be large, usually ignore)
  meanEmbedding: number[];    // averaged face vector (can be large, usually ignore)
};
```

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Employee created successfully",
  "data": {
    "id": "65f1c2a9b8e4d3c1a2b3c4d5",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "department": "Engineering",
    "role": "Employee",
    "faceImages": [
      "employees/john-doe/1712345678901_face-frontal.jpg",
      "employees/john-doe/1712345678902_face-left.jpg",
      "employees/john-doe/1712345678903_face-right.jpg"
    ],
    "embeddings": [[0.0123, -0.0456, "..."], "..."],
    "meanEmbedding": [0.0101, -0.0402, "..."]
  }
}
```

The `embeddings` and `meanEmbedding` arrays are large biometric payloads. The UI does not need them; ignore these two fields.

### Errors

| Status | Message | When |
| --- | --- | --- |
| 400 | `At least three face image is required` | fewer than 3 files |
| 400 | `Employee with email already exists` | duplicate email |
| 400 | `Please provide valid data` | body validation failed (`errors[]` explains each field) |
| 400 | `File too large` / `Unexpected file field` | file size or file count/field name violation |
| 500 | `Invalid file type` | a file is not JPG/PNG (current backend behavior) |
| 400 | embedding failure message | face embedding API could not process images |
| 500 | internal error message | unexpected server/AI failure |

---

## GET `/api/v1/employees`

List employees, newest first (sorted by database id descending).

### Query parameters

| Param | Type | Required | Default | Rules |
| --- | --- | --- | --- | --- |
| `limit` | number | no | 20 | 1-100 |
| `cursor` | string | no | - | id of the last item from the previous page |

Cursor pagination:
1. First request: `GET /api/v1/employees?limit=20`
2. Response returns `cursor` and `hasMore`.
3. If `hasMore` is `true`, request the next page with `&cursor=<cursor value>`.
4. Stop when `hasMore` is `false` (or `cursor` is `null`).

Do not build page numbers from offsets; use the cursor value as-is.

### Success `200`

```ts
type EmployeeListItem = {
  id: string;
  name: string;
  email: string;
  department: Department | null;
  role: Role | null;
  avatar: string; // full URL built from the first face image
};

type EmployeeListData = {
  data: EmployeeListItem[];
  hasMore: boolean;
  cursor: string | null; // pass to next request when hasMore is true
  count: number;         // number of items in this page
};
```

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Employees fetched successfully",
  "data": {
    "data": [
      {
        "id": "65f1c2a9b8e4d3c1a2b3c4d5",
        "name": "John Doe",
        "email": "john.doe@example.com",
        "department": "Engineering",
        "role": "Employee",
        "avatar": "https://minio.mssplonline.in/facevision/employees/john-doe/1712345678901_face-frontal.jpg"
      }
    ],
    "hasMore": true,
    "cursor": "65f1c2a9b8e4d3c1a2b3c4d5",
    "count": 1
  }
}
```

The server builds `avatar` from `faceImages[0]`, so the first uploaded face image is the avatar. If an employee has no stored images, the URL may contain an `undefined` path segment; treat it as "no avatar" by checking that the path ends with an actual file name.

### Errors

| Status | Message | When |
| --- | --- | --- |
| 400 | `Query params are invalid` | `limit` outside 1-100 or invalid `cursor` |

---

## GET `/api/v1/employees/search`

Search employees by name. Case-insensitive, partial match. Returns at most all matching employees (no pagination).

### Query parameters

| Param | Type | Required | Rules |
| --- | --- | --- | --- |
| `name` | string | yes | any non-empty substring of the employee name |

### Example

```bash
GET /api/v1/employees/search?name=john
```

### Success `200`

```ts
type EmployeeSearchItem = {
  id: string;
  name: string;
  department: Department | null;
  role: Role | null;
};

type EmployeeSearchData = EmployeeSearchItem[];
```

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Search completed successfully",
  "data": [
    {
      "id": "65f1c2a9b8e4d3c1a2b3c4d5",
      "name": "John Doe",
      "department": "Engineering",
      "role": "Employee"
    }
  ]
}
```

Search results do not include `email` or `avatar`. Use `GET /api/v1/employees/:employeeId` if you need the full profile.

### Errors

| Status | Message | When |
| --- | --- | --- |
| 400 | `Query parameter 'name' is required` | `name` missing or empty |

---

## POST `/api/v1/employees/promote`

Convert a previously detected unknown identity into a registered employee.

`multipart/form-data`. All fields are form fields; the face image is optional.

### Form fields

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `name` | string | yes | min 2 characters |
| `email` | string | yes | valid email |
| `department` | string | yes | any non-empty string |
| `role` | string | yes | any non-empty string |
| `source` | string | yes | must be exactly `"unknown"` |
| `unknownId` | string | yes | id of the unknown identity to promote |
| `face` | file | no | single JPG/PNG, max 5 MB |

If no `face` file is provided, the unknown identity's stored representative image is reused.

### Example request

```bash
curl -X POST 'http://localhost:3000/api/v1/employees/promote' \
  -H 'Authorization: Bearer <token>' \
  -F 'name=John Doe' \
  -F 'email=john.doe@example.com' \
  -F 'department=Engineering' \
  -F 'role=Employee' \
  -F 'source=unknown' \
  -F 'unknownId=65f1c2a9b8e4d3c1a2b3c4d5' \
  -F 'face=@face.jpg'
```

### Success `200`

Returns the created employee document. `meanEmbedding` is copied from the unknown identity; per-image `embeddings` are not generated here.

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Unknown converted to employee successfully",
  "data": {
    "id": "65f1c2a9b8e4d3c1a2b3c4d6",
    "_id": "65f1c2a9b8e4d3c1a2b3c4d6",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "department": "Engineering",
    "role": "Employee",
    "faceImages": ["employees/john-doe/1712345678901_face.jpg"],
    "embeddings": null,
    "meanEmbedding": [0.0101, -0.0402, "..."]
  }
}
```

Note: this endpoint returns the raw Mongo document, so both `id` and `_id` are present and identical. Use either as the employee id.

### Errors

| Status | Message | When |
| --- | --- | --- |
| 400 | `Please provide valid data` | validation failed (`errors[]` explains each field) |
| 400 | `Already converted` | unknown identity was already promoted |
| 400 | `Employee with same embeddings already exists` | duplicate face matched an existing employee |
| 404 | `Unknown identity not found` | invalid `unknownId` |
| 500 | `Failed to promote unknown to employee due to AI Server error` | AI service rejected the promotion |
| 400 | `File too large` / `Unexpected file field` | file size or field name violation |
| 500 | `Invalid file type` | a file is not JPG/PNG (current backend behavior) |

---

## GET `/api/v1/employees/:employeeId`

Get the profile card for one employee.

### Path parameter

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `employeeId` | string | yes | Mongo ObjectId string |

### Success `200`

```ts
type EmployeeProfileData = {
  id: string;
  employeeCode: string;      // "EMP-" + last 4 chars of id, uppercase
  name: string;
  department: Department | null;
  role: Role | null;
  email: string;
  avatar: string | null;     // MinIO object key (not a full URL)
  joinDate: string | null;   // currently always null
  status: "ACTIVE";          // currently always ACTIVE
};
```

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Employee profile fetched successfully",
  "data": {
    "id": "65f1c2a9b8e4d3c1a2b3c4d5",
    "employeeCode": "EMP-C4D5",
    "name": "John Doe",
    "department": "Engineering",
    "role": "Employee",
    "email": "john.doe@example.com",
    "avatar": "employees/john-doe/1712345678901_face-frontal.jpg",
    "joinDate": null,
    "status": "ACTIVE"
  }
}
```

Important: in this endpoint `avatar` is a MinIO object key, unlike the list endpoint where `avatar` is a full URL. Build the URL as:

```ts
const avatarUrl = avatar
  ? `https://minio.mssplonline.in/facevision/${avatar}`
  : null;
```

(Endpoint and bucket come from server config; the values above are the current deployment defaults.)

`joinDate` and `status` are not stored yet; the server always returns `null` and `"ACTIVE"`. Do not rely on them for business logic.

### Errors

| Status | Message | When |
| --- | --- | --- |
| 400 | `Employee ID is required` | empty path param |
| 404 | `Employee not found` | no employee with that id |

---

## GET `/api/v1/employees/embeddings`

Internal endpoint that exports employee face embeddings for the AI/matching service.

- Returns `200` with an array of `{ id, name, embeddings, meanEmbedding }`.
- Not intended for UI use; payloads are large and contain biometric data.
- Frontend should not call this endpoint.

---

## Route ordering note

`GET /search` and `GET /embeddings` are declared before `GET /:employeeId`, so `search` and `embeddings` are never parsed as employee ids. No special handling is needed by the frontend.

---

## Frontend implementation checklist

- Always send `Authorization: Bearer <token>` or the `accessToken` cookie for every call.
- Use `multipart/form-data` for `POST /` and `POST /promote`; do not set `Content-Type` manually, let the browser add the boundary.
- Repeat the file field as `face` for every image (3-10 images, JPG/PNG, 5 MB max each).
- Use exact enum casing for `department` and `role`.
- Treat the list `cursor` as opaque; send it back unchanged.
- Expect `avatar` to be a full URL in the list response but a MinIO key in the profile response.
- Ignore `embeddings` and `meanEmbedding` in create responses.
- Display validation errors from `errors[].field` / `errors[].message` next to the matching form fields.
