import { StyleSheet } from "@react-pdf/renderer";

/**
 * Shared styles for the søknad PDFs, ported from the three near-identical
 * inline stylesheets in the old utlegg.tihlde.org templates.
 *
 * No fonts are registered — the standard-14 Helvetica handles æøå through
 * WinAnsi encoding, which is what the old portal relied on too.
 */
export const pdfStyles = StyleSheet.create({
    page: {
        backgroundColor: "#fff",
        padding: 40,
        position: "relative",
    },
    column: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        width: "100%",
        margin: 10,
        border: "1px solid #000",
    },
    row: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        margin: 10,
    },
    text: {
        margin: 10,
        fontSize: 12,
    },
    link: {
        margin: 10,
        fontSize: 12,
        color: "#0066cc",
        textDecoration: "underline",
    },
    header: {
        fontSize: 16,
        padding: 10,
        textAlign: "center",
        fontWeight: "bold",
    },
    logo: {
        fontSize: 18,
        position: "absolute",
        top: 20,
        left: 20,
        fontWeight: "extrabold",
    },
    date: {
        position: "absolute",
        top: 20,
        right: 20,
        fontSize: 12,
    },
    title: {
        fontSize: 20,
        textAlign: "center",
        marginTop: 20,
        marginBottom: 20,
        fontWeight: "bold",
    },
    /**
     * The signature box. The old templates pinned this absolutely to the
     * bottom-left of page 1, which made it overlap the content whenever a
     * submission had more than a couple of attachments. Kept in normal flow
     * instead so it always lands after the content.
     */
    signatureBox: {
        margin: 10,
        padding: 10,
        border: "1px solid #000",
        fontSize: 12,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
    },
    attachmentImage: {
        width: "100%",
        maxHeight: 300,
        objectFit: "contain",
        marginVertical: 5,
    },
    attachmentContainer: {
        width: "100%",
        padding: 10,
        marginVertical: 5,
    },
});
