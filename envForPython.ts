import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const token = jwt.sign(
  {
    type: "service",
    service: "face-tracker-python",
    role: "internal",
  },
  process.env.PYTHON_JWT_SECRET!,
  { expiresIn: "365d" }
);

console.log(token);
