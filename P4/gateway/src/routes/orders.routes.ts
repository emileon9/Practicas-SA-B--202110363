import { Router } from "express";
import { env } from "../config/env";
import { createServiceProxy } from "../services/proxy.service";

export const ordersRoutes = Router();
ordersRoutes.use("/", createServiceProxy(env.ordersServiceUrl));
