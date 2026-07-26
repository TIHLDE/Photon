import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import React from "react";
import { pdfStyles as styles } from "./styles";

export type ExpensePdfProps = {
    name: string;
    email: string;
    /** Preformatted, e.g. "1 250 kr". */
    amount: string;
    /** Preformatted, e.g. "25.07.2026". */
    date: string;
    description: string;
    accountNumber: string;
    groupName: string;
    budgetType: string;
    signature: string;
    /** Receipts as `data:` URIs. */
    receipts: string[];
};

/** Utlegg. Ported from Utlegg/app/template/pdf.tsx. */
export function ExpensePdf({
    name,
    email,
    amount,
    date,
    description,
    accountNumber,
    groupName,
    budgetType,
    signature,
    receipts,
}: ExpensePdfProps) {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Text style={styles.logo}>TIHLDE</Text>
                <Text style={styles.date}>{date}</Text>
                <Text style={styles.title}>Utlegg</Text>

                <View style={styles.row}>
                    <View style={styles.column}>
                        <Text style={styles.header}>Fullt navn:</Text>
                        <Text style={styles.text}>{name}</Text>
                    </View>
                    <View style={styles.column}>
                        <Text style={styles.header}>E-post:</Text>
                        <Text style={styles.text}>{email}</Text>
                    </View>
                </View>

                <View style={styles.row}>
                    <View style={styles.column}>
                        <Text style={styles.header}>Kontonummer:</Text>
                        <Text style={styles.text}>{accountNumber}</Text>
                    </View>
                    <View style={styles.column}>
                        <Text style={styles.header}>Beløp:</Text>
                        <Text style={styles.text}>{amount}</Text>
                    </View>
                </View>

                <View style={styles.row}>
                    <View style={styles.column}>
                        <Text style={styles.header}>Gruppe:</Text>
                        <Text style={styles.text}>{groupName}</Text>
                    </View>
                    <View style={styles.column}>
                        <Text style={styles.header}>Budsjetttype:</Text>
                        <Text style={styles.text}>{budgetType}</Text>
                    </View>
                </View>

                <View style={styles.column}>
                    <Text style={styles.header}>Hva utlegget er for:</Text>
                    <Text style={styles.text}>{description}</Text>
                </View>

                {receipts.length > 0 && (
                    <View style={styles.column}>
                        <Text style={styles.header}>Kvitteringer:</Text>
                        {receipts.map((receipt, index) => (
                            <View
                                key={index}
                                style={styles.attachmentContainer}
                            >
                                <Text style={styles.text}>
                                    Kvittering {index + 1}:
                                </Text>
                                <Image
                                    src={receipt}
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
