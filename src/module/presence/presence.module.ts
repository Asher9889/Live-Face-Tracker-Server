import PresenceLogService from "./logs/presence-log.service";
import PresenceController from "./presence.controller";
import PresenceService from "./presence.service";

const presenceLogService = new PresenceLogService();
const presenceService = new PresenceService(presenceLogService);
const presenceController = new PresenceController(presenceService);

export { presenceController, presenceService };