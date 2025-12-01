import express from "express";
const router = express.Router();  
import { employeesRoutes } from "../../module/employees";  


router.use("/employees", employeesRoutes)

router.get("/test", (req, res) => {
    res.send("Hello World!");
});




export default router;