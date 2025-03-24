"use client";

import Navbar from "@/components/navigation/TopBar";
import BottomBar from "@/components/navigation/BottomBar";
import Footer from "@/components/navigation/Footer";
import Image from "next/image";
import ContactForm from "@/app/kontakt/_components/ContactForm";

export default function Kontakt() {
    return (
        <div className="flex flex-col items-center justify-center">
            <Navbar />
            {/* Om TIHLDE */}
            <section className="space-y-20 max-w-5xl px-4 py-32">
                <div className="flex flex-col gap-x-16 md:flex-row">
                    <div className="pr-4 pt-20 pb-10">
                        <h2 className="mb-6 text-4xl font-bold">Kontakt</h2>
                        <p className="mb-6 text-gray-300 text-lg leading-relaxed">
                            Vi er linjeforeningen for datastudenter, og vårt mål
                            er å knytte tettere bånd mellom studenter og
                            næringslivet. Gjennom våre aktiviteter får bedrifter
                            muligheten til å nå motiverte studenter som søker
                            utfordringer og nye muligheter.
                        </p>
                    </div>
                    <Image
                        src="/kontakt-oss-bilde.png"
                        alt="Kontakt"
                        className="rounded-lg shadow-lg"
                        width={300}
                        height={300}
                    />
                </div>

                <ContactForm />
            </section>

            <BottomBar />
            <Footer />
        </div>
    );
}
