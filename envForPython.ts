import jwt from "jsonwebtoken";

const token = jwt.sign(
  {
    type: "service",
    service: "face-tracker-python",
    role: "internal",
  },
  "IAmPythonSecret", // IAmPythonSecret
  { expiresIn: "365d" }
);

console.log(token);
