import { Router } from "express";
import { healthCheck } from "../controllers/users.controller";

export const healthRouter = Router();
healthRouter.get("/health", healthCheck);
