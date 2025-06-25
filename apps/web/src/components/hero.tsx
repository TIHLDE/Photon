import { MegaphoneIcon } from "@heroicons/react/24/outline"
import Link from "next/link"

export default function Hero() {
    return (
        <>
            <section className="relative flex min-h-[60vh] items-center justify-center w-full max-w-5xl md:max-w-7xl">
                {/* Bakgrunnsbilde hvis ønskelig */}
                <div className="absolute inset-0 -z-10">
                    {/* Eksempel på bakgrunnsbilde */}
                </div>
                <div className="mx-auto max-w-4xl text-center px-4 pt-44 pb-28 flex items-center justify-center flex-col text-white">
                    <p className="text-[hsl(230,100%,79%)] mb-2">Møt morgendagens IT-talenter!</p>
                    <h1 className="mb-4 text-5xl font-extrabold md:text-7xl">
                        Samarbeid med TIHLDE
                    </h1>

                    <p className="mb-8 text-lg text-gray-400">
                        Vi tilbyr unike muligheter for bedrifter til å knytte seg til en ny generasjon IT-eksperter. Utforsk våre tilbud og bli en del av nettverket som inspirerer, engasjerer og rekrutterer!
                    </p>
                    <Link
                        href="/kontakt"
                        className="inline-flex items-center gap-2 rounded bg-primary px-6 py-3 font-semibold transition-opacity text-white hover:opacity-70"
                    >
                        Meld interesse
                        <MegaphoneIcon className="h-6 w-6" />
                    </Link>

                </div>
            </section>
        </>
    )
}