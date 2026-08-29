import { Router } from "express";
import { env } from "../config/env";
import { createServiceProxy } from "../services/proxy.service";

export const usersRoutes = Router();
usersRoutes.use("/", createServiceProxy(env.usersServiceUrl));
