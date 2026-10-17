import express from "express";
import cors from "cors";
import { createHandler } from "graphql-http/lib/use/express";
import { healthRouter } from "./routes/health.routes";
import { schema } from "./graphql/schema";
import { root } from "./graphql/resolvers";
import { errorHandler } from "./middleware/errorHandler.middleware";
import { metricsMiddleware, registry } from "./observability/metrics";
import { requestLoggingMiddleware } from "./observability/logger";

const app = express();

app.use(cors());
app.use(metricsMiddleware);
app.use(requestLoggingMiddleware);
app.use(express.json());
app.use(healthRouter);
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", registry.contentType);
  res.end(await registry.metrics());
});
app.all("/graphql", createHandler({ schema, rootValue: root }));

app.use(errorHandler);

export default app;
