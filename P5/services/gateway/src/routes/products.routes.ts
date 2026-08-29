import { Router } from "express";
import { env } from "../config/env";
import { createServiceProxy } from "../services/proxy.service";

export const productsRoutes = Router();
productsRoutes.use("/", createServiceProxy(env.productsServiceUrl));
