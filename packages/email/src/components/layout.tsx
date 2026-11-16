import {
    Body,
    Button,
    Column,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Img,
    Link,
    Preview,
    Row,
    Section,
    Text,
} from "@react-email/components";
import React from "react";
import type { ReactNode } from "react";
import { colors, fontFamily } from "./theme";

/*
 * Shared building blocks for every email.
 *
 * The layout is a fluid 640px column: it fills a phone screen and stops
 * growing at a comfortable reading width on desktop. Everything is inline
 * styles and tables (via @react-email/components) because that is all email
 * clients agree on. The one <style> block only tightens padding on small
 * screens, and clients that strip it still get a usable layout.
 *
 * These live outside `src/template/` so the React Email preview does not list
 * them as emails.
 */

// Tabellen e-posten er bygget av vokser til det lengste ordet den ikke kan
// bryte, så en lang lenke i teksten gjorde hele e-posten bredere.
const breakLongWords = {
    overflowWrap: "anywhere",
    wordBreak: "break-word",
} as const;

const responsiveCss = `
@media only screen and (max-width: 600px) {
    .email-shell { padding: 16px 8px !important; }
    .email-card { padding: 28px 22px 14px !important; }
    .email-title { font-size: 22px !important; line-height: 30px !important; }
    .email-button { display: block !important; text-align: center !important; }
    .email-detail-label, .email-detail-value { display: block !important; width: 100% !important; }
    .email-detail-label { padding: 10px 0 0 !important; }
    .email-detail-value { padding: 2px 0 10px !important; }
}
`;

type EmailLayoutProps = {
    /** Inbox preview line shown after the subject. */
    preview: string;
    logoUrl: string;
    children: ReactNode;
    /** Small print under the card, e.g. why the member got this email. */
    footerNote?: ReactNode;
};

export const EmailLayout = ({
    preview,
    logoUrl,
    children,
    footerNote,
}: EmailLayoutProps): React.ReactElement => (
    <Html lang="no">
        <Head>
            <meta name="color-scheme" content="light" />
            <meta name="supported-color-schemes" content="light" />
            <style>{responsiveCss}</style>
        </Head>
        <Preview>{preview}</Preview>
        <Body style={styles.body}>
            <Section className="email-shell" style={styles.shell}>
                <Container style={styles.container}>
                    <Section style={styles.header}>
                        <Row>
                            <Column style={styles.logoCell}>
                                <Img
                                    src={logoUrl}
                                    width="40"
                                    height="40"
                                    alt="TIHLDE"
                                    style={styles.logo}
                                />
                            </Column>
                            <Column style={styles.wordmarkCell}>
                                <Text style={styles.wordmark}>TIHLDE</Text>
                            </Column>
                        </Row>
                    </Section>
                    <Section className="email-card" style={styles.card}>
                        {children}
                    </Section>
                    <Section style={styles.footer}>
                        {footerNote && (
                            <Text style={styles.footerNote}>{footerNote}</Text>
                        )}
                        <Text style={styles.footerText}>
                            Levert av Index ·{" "}
                            <Link
                                href="https://tihlde.org"
                                style={styles.footerLink}
                            >
                                tihlde.org
                            </Link>
                        </Text>
                    </Section>
                </Container>
            </Section>
        </Body>
    </Html>
);

export const Title = ({
    children,
}: {
    children: ReactNode;
}): React.ReactElement => (
    <Heading as="h1" className="email-title" style={styles.title}>
        {children}
    </Heading>
);

export const Paragraph = ({
    children,
    muted = false,
}: {
    children: ReactNode;
    muted?: boolean;
}): React.ReactElement => (
    <Text style={muted ? styles.mutedParagraph : styles.paragraph}>
        {children}
    </Text>
);

export const CtaButton = ({
    href,
    children,
}: {
    href: string;
    children: ReactNode;
}): React.ReactElement => (
    <Section style={styles.buttonRow}>
        <Button href={href} className="email-button" style={styles.button}>
            {children}
        </Button>
    </Section>
);

/** Label/value rows in a tinted panel — amounts, dates, contact details. */
export const DetailList = ({
    rows,
    title,
}: {
    rows: { label: string; value: ReactNode }[];
    title?: string;
}): React.ReactElement => (
    <Section style={{ ...styles.panel, ...styles.detailPanel }}>
        {title && <Text style={styles.panelTitle}>{title}</Text>}
        {rows.map((row, index) => (
            <Row
                key={row.label}
                style={index === 0 ? undefined : styles.detailDivider}
            >
                <Column
                    className="email-detail-label"
                    style={styles.detailLabel}
                >
                    {row.label}
                </Column>
                <Column
                    className="email-detail-value"
                    style={styles.detailValue}
                >
                    {row.value}
                </Column>
            </Row>
        ))}
    </Section>
);

/** A quoted piece of text with a label — a reason, a message from a person. */
export const Callout = ({
    label,
    children,
    tone = "neutral",
}: {
    label: string;
    children: ReactNode;
    tone?: "neutral" | "danger";
}): React.ReactElement => (
    <Section
        style={
            tone === "danger"
                ? { ...styles.panel, ...styles.dangerPanel }
                : styles.panel
        }
    >
        <Text style={styles.calloutLabel}>{label}</Text>
        <Text style={styles.calloutText}>{children}</Text>
    </Section>
);

/** One value the whole email is about: a code, a place in a queue. */
export const Highlight = ({
    label,
    value,
    monospace = false,
    size = "lg",
}: {
    label: string;
    value: ReactNode;
    monospace?: boolean;
    /** `sm` for longer values such as a date and time. */
    size?: "sm" | "lg";
}): React.ReactElement => (
    <Section style={{ ...styles.panel, ...styles.highlightPanel }}>
        <Text style={styles.highlightLabel}>{label}</Text>
        <Text
            style={{
                ...styles.highlightValue,
                ...(size === "sm" ? styles.highlightValueSmall : {}),
                ...(monospace ? styles.highlightCode : {}),
            }}
        >
            {value}
        </Text>
    </Section>
);

export const Divider = (): React.ReactElement => <Hr style={styles.hr} />;

/** Multi-line text where the line breaks matter (messages typed by people). */
export const MultilineText = ({
    text,
}: {
    text: string;
}): React.ReactElement => (
    // white-space: pre-line er ikke støttet i alle e-postklienter.
    <>
        {text.split("\n").map((line, index) => (
            <React.Fragment key={index}>
                {index > 0 && <br />}
                {line}
            </React.Fragment>
        ))}
    </>
);

const styles = {
    body: {
        backgroundColor: colors.canvas,
        fontFamily,
        margin: "0",
        padding: "0",
        WebkitTextSizeAdjust: "100%",
    },
    shell: {
        padding: "40px 16px",
    },
    container: {
        maxWidth: "640px",
        width: "100%",
        margin: "0 auto",
    },
    header: {
        padding: "0 4px 20px",
    },
    // The gap is padding, not leftover column width, and the logo size is set
    // in CSS too: Apple Mail can ignore the <img> width attribute and grow the
    // logo to fill the whole column, leaving no space before the wordmark.
    logoCell: {
        paddingRight: "12px",
        verticalAlign: "middle",
        width: "40px",
    },
    logo: {
        display: "block",
        borderRadius: "10px",
        height: "40px",
        maxWidth: "40px",
        width: "40px",
    },
    wordmarkCell: {
        verticalAlign: "middle",
    },
    wordmark: {
        color: colors.heading,
        fontSize: "18px",
        fontWeight: 700,
        letterSpacing: "0.08em",
        lineHeight: "40px",
        margin: "0",
    },
    card: {
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: "16px",
        // Bottom is shorter: the last block always brings its own margin.
        padding: "44px 48px 28px",
    },
    title: {
        color: colors.heading,
        fontSize: "28px",
        fontWeight: 700,
        letterSpacing: "-0.01em",
        lineHeight: "36px",
        margin: "0 0 16px",
        ...breakLongWords,
    },
    paragraph: {
        color: colors.text,
        fontSize: "16px",
        lineHeight: "26px",
        margin: "0 0 16px",
        ...breakLongWords,
    },
    mutedParagraph: {
        color: colors.muted,
        fontSize: "14px",
        lineHeight: "22px",
        margin: "0 0 12px",
        ...breakLongWords,
    },
    buttonRow: {
        padding: "12px 0 20px",
    },
    button: {
        backgroundColor: colors.brand,
        borderRadius: "10px",
        color: "#ffffff",
        fontSize: "16px",
        fontWeight: 600,
        lineHeight: "24px",
        padding: "14px 28px",
        textDecoration: "none",
    },
    panel: {
        backgroundColor: colors.panel,
        border: `1px solid ${colors.panelBorder}`,
        borderRadius: "12px",
        margin: "8px 0 24px",
        padding: "18px 24px",
    },
    detailPanel: {
        padding: "6px 24px",
    },
    dangerPanel: {
        backgroundColor: colors.dangerTint,
        borderColor: colors.dangerBorder,
    },
    panelTitle: {
        color: colors.heading,
        fontSize: "15px",
        fontWeight: 700,
        lineHeight: "22px",
        margin: "14px 0 4px",
    },
    detailDivider: {
        borderTop: `1px solid ${colors.panelBorder}`,
    },
    detailLabel: {
        color: colors.muted,
        fontSize: "14px",
        lineHeight: "22px",
        padding: "10px 16px 10px 0",
        verticalAlign: "top",
        width: "40%",
    },
    detailValue: {
        color: colors.heading,
        fontSize: "15px",
        fontWeight: 600,
        lineHeight: "22px",
        padding: "10px 0",
        verticalAlign: "top",
        whiteSpace: "pre-wrap" as const,
        ...breakLongWords,
    },
    calloutLabel: {
        color: colors.muted,
        fontSize: "12px",
        fontWeight: 600,
        letterSpacing: "0.06em",
        lineHeight: "18px",
        margin: "0 0 4px",
        textTransform: "uppercase" as const,
    },
    calloutText: {
        color: colors.heading,
        fontSize: "16px",
        lineHeight: "26px",
        margin: "0",
        ...breakLongWords,
    },
    highlightPanel: {
        padding: "24px",
        textAlign: "center" as const,
    },
    highlightLabel: {
        color: colors.muted,
        fontSize: "14px",
        lineHeight: "20px",
        margin: "0",
    },
    highlightValue: {
        color: colors.brand,
        fontSize: "44px",
        fontWeight: 700,
        lineHeight: "52px",
        margin: "6px 0 0",
    },
    highlightValueSmall: {
        fontSize: "24px",
        lineHeight: "32px",
    },
    highlightCode: {
        fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
        letterSpacing: "0.3em",
        // Letter-spacing pads the right side too; this keeps the code centred.
        paddingLeft: "0.3em",
    },
    hr: {
        borderColor: colors.border,
        borderTopWidth: "1px",
        margin: "24px 0",
    },
    footer: {
        padding: "24px 4px 0",
        textAlign: "center" as const,
    },
    footerNote: {
        color: colors.muted,
        fontSize: "13px",
        lineHeight: "20px",
        margin: "0 0 8px",
    },
    footerText: {
        color: colors.subtle,
        fontSize: "13px",
        lineHeight: "20px",
        margin: "0",
    },
    footerLink: {
        color: colors.subtle,
        textDecoration: "underline",
    },
};
