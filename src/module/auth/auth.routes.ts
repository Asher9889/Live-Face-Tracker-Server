import express from "express";
import { authController } from "./auth.module";
import { validate } from "../../middlewares";
import loginSchema from "./auth.validation";

const router = express.Router();

router.post("/login", validate(loginSchema), authController.login);
router.post("/refresh", authController.refresh);

// router.post("/signup", authController.signup);

export default router;
