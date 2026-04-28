import { route } from "~/lib/route";
import { activateContractRoute } from "./activate";
import { createContractRoute } from "./create";
import { getActiveContractRoute } from "./get-active";
import { groupSignaturesRoute } from "./group-signatures";
import { listContractsRoute } from "./list";
import { mySignatureRoute } from "./my-signature";
import { revokeSignatureRoute } from "./revoke-signature";
import { signContractRoute } from "./sign";

export const contractsRoutes = route()
    .route("/", getActiveContractRoute)
    .route("/", mySignatureRoute)
    .route("/", signContractRoute)
    .route("/", listContractsRoute)
    .route("/", createContractRoute)
    .route("/", activateContractRoute)
    .route("/", groupSignaturesRoute)
    .route("/", revokeSignatureRoute);
