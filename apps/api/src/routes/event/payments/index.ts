import { Hono } from "hono";
import { paymentsListRouter } from "./list";
import { paymentsCreateRouter } from "./create";
import { paymentsGetRouter } from "./get";
import { paymentsUpdateRouter } from "./update";
import { paymentsRemoveRouter } from "./remove";

export const paymentsRouter = new Hono();
paymentsRouter.route("/", paymentsListRouter);
paymentsRouter.route("/", paymentsCreateRouter);
paymentsRouter.route("/", paymentsGetRouter);
paymentsRouter.route("/", paymentsUpdateRouter);
paymentsRouter.route("/", paymentsRemoveRouter);
