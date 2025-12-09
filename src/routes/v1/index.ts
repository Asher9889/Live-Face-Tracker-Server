import express from "express";
const router = express.Router();  
import { employeesRoutes } from "../../module/employees";  
import camerasRoutes from "../../module/cameras";


router.use("/employees", employeesRoutes)

router.use("/cameras", camerasRoutes)

router.get("/test", (req, res) => {
    res.send("Hello World!");
});




export default router;