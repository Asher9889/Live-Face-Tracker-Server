import express from "express";
const router = express.Router();  
import { employeesRoutes } from "../../module/employees";  
import camerasRoutes from "../../module/cameras";
import { authRoutes } from "../../module/auth";
import presenceRoutes from "../../module/presence";
import dashboardRoutes from "../../module/dashboard";
import { attendanceRoutes } from "../../module/attendance";
import { isAuthenticated } from "../../middlewares";
import { unknownRoutes } from "../../module/unknown";

router.use("/auth", authRoutes);
router.use("/employees", isAuthenticated,  employeesRoutes);
router.use("/presence", isAuthenticated, presenceRoutes);
router.use("/cameras", camerasRoutes);
router.use("/dashboard", isAuthenticated, dashboardRoutes);
router.use("/attendance", isAuthenticated, attendanceRoutes);

router.use("/unknown", unknownRoutes);

router.get("/ping", (req, res) => {
    res.send("pong");
});




export default router;