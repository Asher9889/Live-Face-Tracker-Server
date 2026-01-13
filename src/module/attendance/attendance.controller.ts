import { Request, Response } from "express";
import { DateTime } from "luxon";
import { AttendenceFilterDTO, AttendenceQueryDTO } from "./attendance.types";


export default class AttendanceController {


    getAllAttendenceEvents = (req:Request, res:Response) => {
        try {
            let filter:AttendenceFilterDTO = {};
            const today = DateTime.now().setZone("Asia/Kolkata").toISODate();
            if(!today) throw new Error("Invalid Today Date");
            const { limit = 20, from = today, to = today} = req.query as AttendenceQueryDTO;
            
            let type: string[] = [];
            if(req.query.type){
                type = (req.query.type as string).split(",").map((type) => type.trim().toUpperCase()).filter((type) => type === "EXIT" || type === "ENTRY");
            }
            filter = {
                lastChangedAt: { $gte: from, $lte: to }
            }
            if(type.length > 0){
                filter["lastGate"] = { $in: type }; 
            }
            console.log("filter is", filter)
        } catch (error) {

        }
    }

}