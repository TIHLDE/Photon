import { route } from "~/lib/route";
import { addMemberRoute } from "./add";
import { listMembersRoute } from "./list";
import { removeMemberRoute } from "./remove";
import { updateMemberRoleRoute } from "./update";

export const membersRoutes = route()
    .route("/", listMembersRoute)
    .route("/", addMemberRoute)
    .route("/", updateMemberRoleRoute)
    .route("/", removeMemberRoute);
