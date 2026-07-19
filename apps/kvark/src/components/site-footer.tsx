import { Link } from "@tanstack/react-router";
import { Separator } from "@tihlde/ui/ui/separator";
import { Facebook, Instagram, Linkedin } from "lucide-react";

export function SiteFooter() {
    return (
        <footer className="w-full">
            <Separator />
            <div className="container mx-auto grid gap-8 px-4 py-10 md:grid-cols-3">
                <div className="flex flex-col gap-2">
                    <h3 className="font-heading text-sm font-semibold">
                        Kontakt
                    </h3>
                    <p>
                        E-post: <a href="mailto:hs@tihlde.org">hs@tihlde.org</a>
                    </p>
                    <p>Lokasjon: c/o IDI, NTNU</p>
                    <p>Org.nr: 998 952 183</p>
                </div>

                <div className="flex flex-col items-center gap-3">
                    <h3 className="font-heading text-sm font-semibold">
                        Hovedsamarbeidspartner
                    </h3>
                    <a
                        href="https://www.dnv.no/"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="DNV"
                        className="rounded-lg bg-white p-4"
                    >
                        <img
                            src="https://cdn.onedesign.dnv.com/onedesigncdn/3.7.0/images/DNV_logo_RGB.svg"
                            alt="DNV"
                            loading="lazy"
                            className="w-48"
                        />
                    </a>
                    <div className="flex items-center gap-3">
                        <a
                            href="https://www.facebook.com/tihlde"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Facebook"
                        >
                            <Facebook className="size-5" />
                        </a>
                        <a
                            href="https://www.instagram.com/tihlde"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Instagram"
                        >
                            <Instagram className="size-5" />
                        </a>
                        <a
                            href="https://www.linkedin.com/company/tihlde"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="LinkedIn"
                        >
                            <Linkedin className="size-5" />
                        </a>
                    </div>
                </div>

                <div className="flex flex-col gap-3 md:items-end">
                    <h3 className="font-heading text-sm font-semibold">
                        Samarbeid
                    </h3>
                    <a
                        href="https://www.nito.no/"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="NITO"
                    >
                        <img
                            src="data:image/svg+xml,%3csvg%20width='2100'%20height='484'%20viewBox='0%200%202100%20484'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M471%20473H11V13H471V473ZM89%20395H300L89%2090V395ZM183%2090L394%20395V90H183Z'%20fill='%232EC78F'/%3e%3cpath%20d='M626%20473H704V154L947%20473H1015V12H937V332L694%2012H626V473Z'%20fill='%232EC78F'/%3e%3cpath%20d='M1115%20472V12L1193%2012.1054V472H1115Z'%20fill='%232EC78F'/%3e%3cpath%20d='M1393%2086V473H1471V86H1617V12H1251V86H1393Z'%20fill='%232EC78F'/%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M1855%205C1985.89%205%202092%20111.109%202092%20242C2092%20372.891%201985.89%20479%201855%20479C1724.11%20479%201618%20372.891%201618%20242C1618%20111.109%201724.11%205%201855%205ZM1855.5%2087C1769.62%2087%201700%20156.62%201700%20242.5C1700%20328.38%201769.62%20398%201855.5%20398C1941.38%20398%202011%20328.38%202011%20242.5C2011%20156.62%201941.38%2087%201855.5%2087Z'%20fill='%232EC78F'/%3e%3c/svg%3e"
                            alt="NITO"
                            loading="lazy"
                            className="w-28"
                        />
                    </a>
                </div>
            </div>
            <Separator />
            <div className="container mx-auto flex flex-col items-center justify-between gap-2 px-4 py-6 md:flex-row">
                <p>© {new Date().getFullYear()} TIHLDE</p>
                <Link to="/personvern">Personvernerklæring</Link>
            </div>
        </footer>
    );
}
