"use client";

import Navbar from "@/components/navigation/TopBar";
import BottomBar from "@/components/navigation/BottomBar";
import Footer from "@/components/navigation/Footer";
import Image from "next/image";

export default function Kontakt() {
    return (
        <div className="flex flex-col items-center justify-center">
            <Navbar />
            {/* Om TIHLDE */}
            <section className="max-w-5xl px-4 py-32">
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
                <div className="grid gap-8 md:grid-cols-3">
                    <div className="col-span-2">
                        <h2 className="mb-6 text-4xl font-bold pt-20">
                            Fyll ut kontaktaktskjema
                        </h2>
                        <div className="flex flex-col gap-2">
                            <span className="text-gray-300">Kontaktinfo:</span>
                            <input
                                type="text"
                                placeholder="Firmanavn"
                                className="p-4 text-lg bg-gray-800 text-white rounded-lg flex gap-4 flex-1"
                            />
                            <input
                                type="text"
                                placeholder="Kontaktperson"
                                className="p-4 text-lg bg-gray-800 text-white rounded-lg flex gap-4 flex-1"
                            />
                            <input
                                type="text"
                                placeholder="E-post"
                                className="p-4 text-lg bg-gray-800 text-white rounded-lg flex gap-4 flex-1"
                            />
                        </div>

                        <div className="flex flex-col gap-4 mt-4">
                            <span className="text-gray-300">
                                Velg semester:
                            </span>
                            <div className="flex flex-col gap-2">
                                {[
                                    "Vår 2025",
                                    "Høst 2025",
                                    "Vår 2026",
                                    "Høst 2026",
                                ].map((semester) => (
                                    <label
                                        key={semester}
                                        className="flex items-center text-gray-300 cursor-pointer"
                                    >
                                        <input
                                            type="radio"
                                            name="semester"
                                            className="hidden peer"
                                        />
                                        <div className="w-5 h-5 border-2 border-gray-500 rounded-full flex items-center justify-center peer-checked:border-blue-500 peer-checked:bg-blue-500 transition-all">
                                            <div className="w-3 h-3 bg-transparent rounded-full peer-checked:bg-white transition-all" />
                                        </div>
                                        <span className="ml-3">{semester}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-4 mt-4">
                            <textarea
                                placeholder="Legg til kommentar"
                                className="p-4 text-lg bg-gray-800 text-white rounded-lg h-60 w-full resize-none"
                            />
                        </div>

                        <div className="flex gap-4 mt-4">
                            <button
                                type="button"
                                className="p-4 text-lg bg-[hsl(220,62%,41%)] text-white rounded-lg hover:bg-blue-700 transition-all"
                            >
                                Send inn kontaktaktskjema
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <BottomBar />
            <Footer />
        </div>
    );
}
