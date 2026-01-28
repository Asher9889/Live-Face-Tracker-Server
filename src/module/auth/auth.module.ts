import AuthService from "./auth.service";
import AuthController from "./auth.controller";

const authService = new AuthService();
const authController = new AuthController();

export { authService, authController, type AuthController, type AuthService };