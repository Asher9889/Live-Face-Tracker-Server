import { Request, Response } from "express";
import { ApiResponse } from "../../utils";
import { StatusCodes } from "http-status-codes";
import PresenceService from "./presence.service";


export default class PresenceController {
    constructor(private readonly presenceService: PresenceService){}
    recoverFromDBOnStartup(){
        return this.presenceService.recoverFromDBOnStartup();
    }
    getAll(req:Request, res:Response){
        const allPresence = this.presenceService.getAllPresence();
        return ApiResponse.success(res, "All presence fetched successfully", allPresence, StatusCodes.OK)
    }
}
