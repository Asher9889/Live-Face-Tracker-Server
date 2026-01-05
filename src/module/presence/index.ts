import PresenceLogService from "./logs/presence-log.service";
import PresenceService from "./presence.service";

const presenceService = new PresenceService(new PresenceLogService);

export { presenceService };