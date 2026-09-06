import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import { Checkbox } from "@tihlde/ui/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import { QRCode } from "@tihlde/ui/ui/qr-code";
import { Copy, Download, QrCode, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const formats = [
    { value: "text", label: "Tekst" },
    { value: "url", label: "Nettadresse" },
    { value: "email", label: "E-postadresse" },
    { value: "phone", label: "Telefonnummer" },
    { value: "sms", label: "SMS" },
] as const;

type Format = (typeof formats)[number]["value"];

function isFormat(value: string | null): value is Format {
    return formats.some((format) => format.value === value);
}

function qrValue(type: Format, value: string, message = ""): string {
    switch (type) {
        case "email":
            return `mailto:${value}`;
        case "phone":
            return `tel:${value}`;
        case "sms":
            return `SMSTO:${value}:${message}`;
        default:
            return value;
    }
}

export const Route = createFileRoute("/_app/qr-koder")({
    component: QRCodesPage,
});

function QRCodesPage() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [type, setType] = useState<Format>("url");
    const [value, setValue] = useState("https://tihlde.org");
    const [smsNumber, setSmsNumber] = useState("");
    const [smsMessage, setSmsMessage] = useState("");
    const [includeLogo, setIncludeLogo] = useState(false);
    const [shared, setShared] = useState(false);
    const [shareError, setShareError] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const parameterType = params.get("type");
        if (isFormat(parameterType)) setType(parameterType);
        setValue(params.get("value") ?? "https://tihlde.org");
        setSmsNumber(params.get("number") ?? "");
        setSmsMessage(params.get("message") ?? "");
        setIncludeLogo(params.get("logo") === "true");
    }, []);

    async function share() {
        const params = new URLSearchParams({
            type,
            value: type === "sms" ? "" : value,
            logo: String(includeLogo),
        });
        if (type === "sms") {
            params.set("number", smsNumber);
            params.set("message", smsMessage);
        }
        const url = `${window.location.origin}${window.location.pathname}?${params}`;
        setShareError(false);

        try {
            await navigator.clipboard.writeText(url);
            setShared(true);
            window.setTimeout(() => setShared(false), 2000);
        } catch {
            setShareError(true);
        }
    }

    function download() {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const link = document.createElement("a");
        link.download = `qr-kode-${type}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    }

    const inputValue = type === "sms" ? smsNumber : value;
    const content = qrValue(type, inputValue, smsMessage);

    return (
        <div className="container mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl">QR-kode</h1>
                <p className="text-muted-foreground">
                    Lag en QR-kode direkte i nettleseren.
                </p>
            </div>

            <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="flex flex-col gap-5">
                    <Field>
                        <FieldLabel htmlFor="qr-code-type">
                            Dataformat
                        </FieldLabel>
                        <select
                            id="qr-code-type"
                            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-3"
                            value={type}
                            onChange={(event) => {
                                if (isFormat(event.target.value)) {
                                    setType(event.target.value);
                                }
                            }}
                        >
                            {formats.map((format) => (
                                <option key={format.value} value={format.value}>
                                    {format.label}
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="qr-code-value">
                            {type === "sms" ? "Telefonnummer" : "Data"}
                        </FieldLabel>
                        <Input
                            id="qr-code-value"
                            type={type === "sms" ? "tel" : "text"}
                            value={type === "sms" ? smsNumber : value}
                            onChange={(event) =>
                                type === "sms"
                                    ? setSmsNumber(event.target.value)
                                    : setValue(event.target.value)
                            }
                            placeholder={
                                type === "sms"
                                    ? "+47 12345678"
                                    : "Skriv innholdet her..."
                            }
                            autoComplete="off"
                        />
                        <FieldDescription>
                            {type === "sms"
                                ? "Skriv inn telefonnummeret."
                                : "Innholdet som skal kodes i QR-koden."}
                        </FieldDescription>
                    </Field>

                    {type === "sms" ? (
                        <Field>
                            <FieldLabel htmlFor="qr-code-message">
                                Melding (valgfritt)
                            </FieldLabel>
                            <Input
                                id="qr-code-message"
                                value={smsMessage}
                                onChange={(event) =>
                                    setSmsMessage(event.target.value)
                                }
                                placeholder="Skriv meldingen her..."
                                autoComplete="off"
                            />
                        </Field>
                    ) : null}

                    <label className="flex cursor-pointer items-center gap-3 text-sm">
                        <Checkbox
                            checked={includeLogo}
                            onCheckedChange={(checked) =>
                                setIncludeLogo(checked === true)
                            }
                        />
                        <span>Legg TIHLDE-logo i midten</span>
                    </label>
                </div>

                <div className="flex flex-col items-center gap-4">
                    <div className="w-full max-w-xs">
                        {inputValue ? (
                            <QRCode
                                ref={canvasRef}
                                value={content}
                                logo={includeLogo ? "/logo512.png" : undefined}
                            />
                        ) : (
                            <div className="flex aspect-square items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground">
                                <span className="flex flex-col items-center gap-2">
                                    <QrCode className="size-8" />
                                    Skriv inn data for å lage QR-koden
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="flex w-full max-w-xs flex-col gap-2 sm:flex-row">
                        <Button
                            type="button"
                            className="flex-1"
                            disabled={!inputValue}
                            onClick={download}
                        >
                            <Download />
                            Last ned bilde
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={share}
                        >
                            {shared ? <Copy /> : <Share2 />}
                            {shared ? "Kopiert" : "Del"}
                        </Button>
                    </div>
                    {shareError ? (
                        <p className="text-sm text-destructive">
                            Kunne ikke kopiere lenken. Prøv igjen.
                        </p>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
