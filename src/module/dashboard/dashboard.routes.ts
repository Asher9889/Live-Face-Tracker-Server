import express from "express";
import { validateQuery } from "../../middlewares";
import DashboardController from "./dashboard.controller";
import DashboardService from "./dashboard.service";
import DashboadRepositor from "./dashboard.repository";
import { dashboardAttendanceSummaryQuerySchema } from "./dashboard.validation";

const router = express.Router();

const dashboardController = new DashboardController(new DashboardService(new DashboadRepositor()));

router.get("/attendance-summary", validateQuery(dashboardAttendanceSummaryQuerySchema), dashboardController.getAttendanceSummary);

export default router;