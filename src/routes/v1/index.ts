import express from "express";
const router = express.Router();  
import { employeesRoutes } from "../../module/employees";  
import camerasRoutes from "../../module/cameras";
import { authRoutes } from "../../module/auth";


router.use("/auth", authRoutes);

router.use("/employees", employeesRoutes)

router.use("/cameras", camerasRoutes)

router.get("/test", (req, res) => {
    res.send("Hello World!");
});




export default router;