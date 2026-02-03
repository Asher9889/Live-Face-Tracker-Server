import { NextFunction, Request, Response } from "express";
import { CreateUnknownDTO } from "./unknown.types";
import { unknownService } from "./unknown.module";

class UnknownController {
    constructor(){}
    async createUnknownEvent(req: Request, res: Response, next: NextFunction){
        try {
            console.log("createUnknownEvent", req.body);
            console.log("createUnknownEvent", req.files);
            const { camera_code, pid, reason, tid, timestamp } = req.body as CreateUnknownDTO;
            const faces = req.files;
            await unknownService.createUnknownEvent();
            
        } catch (error) {
            return next(error);
        }
    }
}
    
export default UnknownController;