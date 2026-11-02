import { route } from "~/lib/route";
import {
    createCommentRoute,
    deleteCommentRoute,
    listCommentsRoute,
} from "./comments";
import { createRoute } from "./create";
import { deleteRoute } from "./delete";
import { getRoute } from "./get";
import { listRoute } from "./list";
import { updateRoute } from "./update";
import { deleteVoteRoute, voteRoute } from "./vote";

export const feedbackRoutes = route()
    .route("/", listRoute)
    .route("/", createRoute)
    .route("/", updateRoute)
    .route("/", deleteRoute)
    .route("/", voteRoute)
    .route("/", deleteVoteRoute)
    .route("/", getRoute)
    .route("/", listCommentsRoute)
    .route("/", createCommentRoute)
    .route("/", deleteCommentRoute);
