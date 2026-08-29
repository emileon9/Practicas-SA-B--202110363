import { Router } from "express";
import { healthCheck } from "../controllers/products.controller";

export const healthRouter = Router();
healthRouter.get("/health", healthCheck);
