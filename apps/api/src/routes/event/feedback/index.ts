import { Hono } from "hono";
import { feedbackListRouter } from "./list";
import { feedbackCreateRouter } from "./create";
import { feedbackGetRouter } from "./get";
import { feedbackUpdateRouter } from "./update";
import { feedbackRemoveRouter } from "./remove";

export const feedbackRouter = new Hono();

feedbackRouter.route("/", feedbackListRouter);
feedbackRouter.route("/", feedbackCreateRouter);
feedbackRouter.route("/", feedbackGetRouter);
feedbackRouter.route("/", feedbackUpdateRouter);
feedbackRouter.route("/", feedbackRemoveRouter);
