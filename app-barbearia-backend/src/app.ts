import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { routes } from "./routes";

export const app = express();

app.use(helmet());
app.use(cors({
  origin: env.corsOrigins.length ? env.corsOrigins : true
}));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ data: { status: "ok" }, message: "API online" });
});

app.use("/api/v1", routes);
app.use(errorHandler);
