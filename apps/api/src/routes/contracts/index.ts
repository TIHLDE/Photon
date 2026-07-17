import { route } from "~/lib/route";
import { activateContractRoute } from "./activate";
import { createContractRoute } from "./create";
import { getActiveContractRoute } from "./get-active";
import { groupSignaturesRoute } from "./group-signatures";
import { listContractsRoute } from "./list";
import { mySignatureRoute } from "./my-signature";
import { revokeSignatureRoute } from "./revoke-signature";
import { signContractRoute } from "./sign";
import { getMySignedPdfRoute, getUserSignedPdfRoute } from "./signed-pdf";

export const contractsRoutes = route()
    .route("/", getActiveContractRoute)
    .route("/", mySignatureRoute)
    .route("/", signContractRoute)
    // Registered before the :userId variant so "/signed-pdf" is not swallowed.
    .route("/", getMySignedPdfRoute)
    .route("/", getUserSignedPdfRoute)
    .route("/", listContractsRoute)
    .route("/", createContractRoute)
    .route("/", activateContractRoute)
    .route("/", groupSignaturesRoute)
    .route("/", revokeSignatureRoute);
