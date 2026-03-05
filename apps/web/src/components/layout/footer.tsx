import { Separator } from "~/components/ui/separator";

export function Footer() {
    return (
        <footer className="border-t border-border bg-card">
            <div className="mx-auto max-w-7xl px-6 py-12">
                <div className="grid gap-8 md:grid-cols-3">
                    <div className="space-y-3">
                        <h3 className="font-display text-lg font-bold uppercase tracking-wider">
                            TIHLDE
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Trondheim IngeniørHøgskoles Linjeforening for
                            Databehandling/E-business
                        </p>
                        <p className="text-sm text-muted-foreground">
                            c/o IDI, NTNU Gløshaugen
                        </p>
                        <a
                            href="mailto:hs@tihlde.org"
                            className="text-sm text-primary hover:underline"
                        >
                            hs@tihlde.org
                        </a>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold">Lenker</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>
                                <a
                                    href="/ny-student"
                                    className="hover:text-foreground"
                                >
                                    Ny student
                                </a>
                            </li>
                            <li>
                                <a
                                    href="/bedrifter"
                                    className="hover:text-foreground"
                                >
                                    For bedrifter
                                </a>
                            </li>
                            <li>
                                <a
                                    href="/toddel"
                                    className="hover:text-foreground"
                                >
                                    TIHLDE-toddel
                                </a>
                            </li>
                            <li>
                                <a
                                    href="/endringslogg"
                                    className="hover:text-foreground"
                                >
                                    Endringslogg
                                </a>
                            </li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold">
                            Sosiale medier
                        </h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>
                                <a
                                    href="https://facebook.com/tihlde"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-foreground"
                                >
                                    Facebook
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://instagram.com/tihlde"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-foreground"
                                >
                                    Instagram
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://github.com/TIHLDE"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-foreground"
                                >
                                    GitHub
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://discord.gg/tihlde"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-foreground"
                                >
                                    Discord
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <Separator className="my-8" />

                <p className="text-center text-xs text-muted-foreground">
                    &copy; {new Date().getFullYear()} TIHLDE. Alle rettigheter
                    forbeholdt.
                </p>
            </div>
        </footer>
    );
}
