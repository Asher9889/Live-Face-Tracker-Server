import express from "express";
import { presenceController } from "./presence.module";

const router = express.Router();
router.get("/", presenceController.getAll);



export default router;