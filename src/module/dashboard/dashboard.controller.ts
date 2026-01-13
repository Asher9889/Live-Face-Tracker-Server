import { Request, Response } from "express"
import DashboardService from "./dashboard.service"

export default class DashboardController {
    constructor(private readonly dashboardService: DashboardService){}
    getAllDashboardPersons = (req:Request, res:Response) => {
        // this.dashboardService.getAllDashboardPersons()
    }
}