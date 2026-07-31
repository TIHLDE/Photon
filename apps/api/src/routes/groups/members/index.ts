import { route } from "~/lib/route";
import { addMemberRoute } from "./add";
import { listFormerMembersRoute } from "./history";
import { listMembersRoute } from "./list";
import { removeMemberRoute } from "./remove";
import { updateMemberRoleRoute } from "./update";

export const membersRoutes = route()
    // Registered ahead of the roster routes so "history" is never mistaken
    // for a :userId segment.
    .route("/", listFormerMembersRoute)
    .route("/", listMembersRoute)
    .route("/", addMemberRoute)
    .route("/", updateMemberRoleRoute)
    .route("/", removeMemberRoute);
