import express from "express";
import cors from "cors";
import { createHandler } from "graphql-http/lib/use/express";
import { healthRouter } from "./routes/health.routes";
import { schema } from "./graphql/schema";
import { root } from "./graphql/resolvers";
import { errorHandler } from "./middleware/errorHandler.middleware";

const app = express();

app.use(cors());
app.use(express.json());
app.use(healthRouter);
app.all("/graphql", createHandler({ schema, rootValue: root }));

app.use(errorHandler);

export default app;
