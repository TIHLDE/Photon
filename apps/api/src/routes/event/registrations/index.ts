import { Hono } from "hono";
import { registrationsListRouter } from "./list";
import { registerRouter } from "./register";
import { cancelRouter } from "./cancel";
import { checkinRouter } from "./checkin";
import { registrationGetRouter } from "./get";
import { registrationCreateAdminRouter } from "./create";
import { registrationRemoveAdminRouter } from "./remove";

export const registrationsRouter = new Hono();

registrationsRouter.route("/", registrationsListRouter);
registrationsRouter.route("/", registerRouter);
registrationsRouter.route("/", cancelRouter);
registrationsRouter.route("/", checkinRouter);
registrationsRouter.route("/", registrationGetRouter);
registrationsRouter.route("/", registrationCreateAdminRouter);
registrationsRouter.route("/", registrationRemoveAdminRouter);
