import { Request, Response } from "express";
import PresenceService from "./presence.service";


export default class PresenceController {
    constructor(private readonly presenceService: PresenceService){}
    // recoverFromDBOnStartup = async () => {
    //     return this.presenceService.recoverFromDBOnStartup();
    // }
    getAll = (req:Request, res:Response) => {
        // const allPresence = this.presenceService.getAllPresence();
        // console.log("All presence", allPresence);
        // return ApiResponse.success(res, "All presence fetched successfully", allPresence, StatusCodes.OK)
    }
}
