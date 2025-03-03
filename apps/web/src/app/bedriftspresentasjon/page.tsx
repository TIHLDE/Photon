"use client"

import Navbar from "@/components/navigation/TopBar"
import BottomBar from "@/components/navigation/BottomBar"
import Footer from "@/components/navigation/Footer"

export default function Bedriftspresentasjon() {
    return (
        <div className="flex flex-col items-center justify-center">
            <Navbar />
            {/* Om TIHLDE */}
            <section className="max-w-5xl px-4 py-16">
                <div className="grid gap-8 md:grid-cols-5">
                    <div className="col-span-2">
                        <h2 className="mb-6 text-4xl font-bold">Kontakt</h2>
                        <p className="mb-4 text-gray-300 text-lg leading-relaxed">
                            Vi er linjeforeningen for datastudenter, og vårt mål er å knytte tettere bånd mellom studenter og næringslivet. Gjennom våre aktiviteter får bedrifter muligheten til å nå motiverte studenter som søker utfordringer og nye muligheter.
                        </p>
                    </div>
                    <div className="flex items-center justify-center col-span-3">
                        {/* Eksempelbilde eller annet innhold */}
                        <div className="relative h-64 w-full bg-gray-800">
                            <p className="absolute inset-0 flex items-center justify-center text-gray-600">
                                Bilde
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <BottomBar />
            <Footer />
        </div>
    )
}
