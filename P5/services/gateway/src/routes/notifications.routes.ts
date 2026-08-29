import { Router } from "express";
import { env } from "../config/env";
import { createServiceProxy } from "../services/proxy.service";

export const notificationsRoutes = Router();
notificationsRoutes.use("/", createServiceProxy(env.notificationsServiceUrl));
