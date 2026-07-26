import { Document, Image, Link, Page, Text, View } from "@react-pdf/renderer";
import React from "react";
import { pdfStyles as styles } from "./styles";

export type SupportPdfProps = {
    /** "Søknad om støtte" or "Søknad om støtte til idrettslag". */
    title: string;
    name: string;
    email: string;
    groupName: string;
    purpose: string;
    eventDescription: string;
    justification: string;
    /** Preformatted, e.g. "12 000 kr". */
    totalAmount: string;
    budgetLink?: string | null;
    summary?: string | null;
    signature: string;
    /** Budget documentation as `data:` URIs. */
    budgetImages: string[];
};

/**
 * Søknad om støtte. Used for both `support` and `sports_support` — the two
 * only differ in the title and in who receives them.
 *
 * Ported from Utlegg/app/template/support-pdf.tsx.
 */
export function SupportPdf({
    title,
    name,
    email,
    groupName,
    purpose,
    eventDescription,
    justification,
    totalAmount,
    budgetLink,
    summary,
    signature,
    budgetImages,
}: SupportPdfProps) {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Text style={styles.logo}>TIHLDE</Text>
                <Text style={styles.title}>{title}</Text>

                <View style={styles.row}>
                    <View style={styles.column}>
                        <Text style={styles.header}>Navn:</Text>
                        <Text style={styles.text}>{name}</Text>
                    </View>
                    <View style={styles.column}>
                        <Text style={styles.header}>E-post:</Text>
                        <Text style={styles.text}>{email}</Text>
                    </View>
                </View>

                <View style={styles.column}>
                    <Text style={styles.header}>Navn på gruppe:</Text>
                    <Text style={styles.text}>{groupName}</Text>
                </View>

                <View style={styles.column}>
                    <Text style={styles.header}>Totalt søknadsbeløp:</Text>
                    <Text style={styles.text}>{totalAmount}</Text>
                </View>

                <View style={styles.column}>
                    <Text style={styles.header}>Formål med søknad:</Text>
                    <Text style={styles.text}>{purpose}</Text>
                </View>

                <View style={styles.column}>
                    <Text style={styles.header}>
                        Beskrivelse av arrangement/produkt:
                    </Text>
                    <Text style={styles.text}>{eventDescription}</Text>
                </View>

                <View style={styles.column}>
                    <Text style={styles.header}>Begrunnelse for støtte:</Text>
                    <Text style={styles.text}>{justification}</Text>
                </View>

                {budgetLink && (
                    <View style={styles.column}>
                        <Text style={styles.header}>Lenke til budsjett:</Text>
                        <Link src={budgetLink} style={styles.link}>
                            {budgetLink}
                        </Link>
                    </View>
                )}

                {summary && (
                    <View style={styles.column}>
                        <Text style={styles.header}>Oppsummering:</Text>
                        <Text style={styles.text}>{summary}</Text>
                    </View>
                )}

                {budgetImages.length > 0 && (
                    <View style={styles.column}>
                        <Text style={styles.header}>Budsjett:</Text>
                        {budgetImages.map((image, index) => (
                            <View
                                key={index}
                                style={styles.attachmentContainer}
                            >
                                <Text style={styles.text}>
                                    Budsjettbilde {index + 1}:
                                </Text>
                                <Image
                                    src={image}
                                    style={styles.attachmentImage}
                                />
                            </View>
                        ))}
                    </View>
                )}

                <View style={styles.signatureBox}>
                    <Text>Signatur:</Text>
                    <Text>{signature}</Text>
                </View>
            </Page>
        </Document>
    );
}
