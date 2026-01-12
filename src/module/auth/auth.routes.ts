import express from "express";

const router = express.Router();

router.post("/login", (req, res) => {
    console.log("Login route hit");
    res.json({ message: "Login route hit" });
});

router.post("/signup", (req, res) => {
    console.log("Signup route hit");
    res.json({ message: "Signup route hit" });
});

export default router;
