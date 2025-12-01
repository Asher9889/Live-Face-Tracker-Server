import { NextFunction, Request, Response } from "express"
import { ApiResponse } from "../index"

function routeNotExistsHandler(req:Request, res:Response, next:NextFunction) {
    return next(ApiResponse.error(res, "Please check your api endpoints", 404))
}

export default routeNotExistsHandler;