import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import React from "react";
import { pdfStyles as styles } from "./styles";

export type HsCasePdfProps = {
    contactName: string;
    contactEmail: string;
    caseName: string;
    caseType: string;
    background: string;
    assessment: string;
    recommendation?: string | null;
    /** Attachments as `data:` URIs. */
    images: string[];
};

/** Sak til HS. Ported from Utlegg/app/template/hs-case-pdf.tsx. */
export function HsCasePdf({
    contactName,
    contactEmail,
    caseName,
    caseType,
    background,
    assessment,
    recommendation,
    images,
}: HsCasePdfProps) {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Text style={styles.logo}>TIHLDE</Text>
                <Text style={styles.title}>Innmeldt sak til HS</Text>

                <View style={styles.row}>
                    <View style={styles.column}>
                        <Text style={styles.header}>Navn på saken:</Text>
                        <Text style={styles.text}>{caseName}</Text>
                    </View>
                    <View style={styles.column}>
                        <Text style={styles.header}>Type sak:</Text>
                        <Text style={styles.text}>{caseType}</Text>
                    </View>
                </View>

                <View style={styles.column}>
                    <Text style={styles.header}>
                        Kort beskrivelse / bakgrunn:
                    </Text>
                    <Text style={styles.text}>{background}</Text>
                </View>

                <View style={styles.column}>
                    <Text style={styles.header}>Saksbehandlers vurdering:</Text>
                    <Text style={styles.text}>{assessment}</Text>
                </View>

                {recommendation && (
                    <View style={styles.column}>
                        <Text style={styles.header}>
                            Saksbehandlers innstilling:
                        </Text>
                        <Text style={styles.text}>{recommendation}</Text>
                    </View>
                )}

                {images.length > 0 && (
                    <View style={styles.column}>
                        <Text style={styles.header}>Vedlegg:</Text>
                        {images.map((image, index) => (
                            <View
                                key={index}
                                style={styles.attachmentContainer}
                            >
                                <Text style={styles.text}>
                                    Vedlegg {index + 1}:
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
                    <Text>Saksbehandler:</Text>
                    <Text>{contactName}</Text>
                    <Text>E-post:</Text>
                    <Text>{contactEmail}</Text>
                </View>
            </Page>
        </Document>
    );
}
