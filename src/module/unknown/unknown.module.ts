import UnknownController from "./unknown.controller";
import UnknownService from "./unknown.service";

const unknownController = new UnknownController();
const unknownService = new UnknownService();

(async () => await unknownService.init())(); // for cache first time load.

export { unknownController, unknownService };