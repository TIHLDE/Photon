"use client"

import Image from "next/image"
import Navbar from "./components/navigation/TopBar"
import Footer from "./components/navigation/Footer"
import { MegaphoneIcon } from "@heroicons/react/24/outline"
import BottomBar from "./components/navigation/BottomBar"

export default function Home() {
  return (
    <>
      {/* Hero-seksjon */}
      <Navbar />
      <section className="relative flex min-h-[60vh] items-center justify-center bg-black">
        {/* Bakgrunnsbilde hvis ønskelig */}
        <div className="absolute inset-0 -z-10">
          {/* Eksempel på bakgrunnsbilde */}
        </div>
        <div className="mx-auto max-w-4xl text-center px-4 py-32">
          <p className="text-[hsl(230,100%,79%)] mb-2">Møt morgendagens IT-talenter!</p>
          <h1 className="mb-4 text-5xl font-extrabold md:text-7xl bg-gradient-to-r from-white/50 via-white to-white/50 bg-clip-text text-transparent">
            Samarbeid med TIHLDE
          </h1>

          <p className="mb-8 text-lg text-gray-400">
            Vi tilbyr unike muligheter for bedrifter til å knytte seg til en ny generasjon IT-eksperter. Utforsk våre tilbud og bli en del av nettverket som inspirerer, engasjerer og rekrutterer!
          </p>
          <a
            href="#tilbud"
            className="inline-flex items-center gap-2 rounded bg-[hsl(220,62%,41%)] px-6 py-3 font-semibold text-white hover:bg-gray-200"
          >
            Meld interesse
            <MegaphoneIcon className="h-6 w-6 text-white" />
          </a>

        </div>
      </section>

      {/* Om TIHLDE */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="grid gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <h2 className="mb-6 text-4xl font-bold">Om TIHLDE</h2>
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

      {/* Bedriftspresentasjoner */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="grid gap-8 md:grid-cols-5">
          <div className="flex items-center justify-center col-span-3">
            {/* Eksempelbilde eller annet innhold */}
            <div className="relative h-64 w-full bg-gray-800">
              <p className="absolute inset-0 flex items-center justify-center text-gray-600">
                Bilde
              </p>
            </div>
          </div>
          <div className="col-span-2">
            <h2 className="mb-6 text-4xl font-bold">Bedriftspresentasjoner</h2>
            <p className="mb-4 text-gray-300 text-lg leading-relaxed">
              En bedriftspresentasjon lar dere introdusere organisasjonen for TIHLDE-studentene, vise hva dere tilbyr og hvordan dere jobber. Etter presentasjonen følger middag og mingling med bedriftsrepresentanter.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="grid gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <h2 className="mb-6 text-4xl font-bold">Stillingannonser</h2>
            <p className="mb-4 text-gray-300 text-lg leading-relaxed">
              Publiser relevante stillinger, internships eller trainee-programmer direkte til våre medlemmer. Sikre deg de beste kandidatene!
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

      {/* Linjene */}
      <section id="linjene" className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="mb-6 text-3xl font-bold">Linjene</h2>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded border border-gray-800 p-4">

            <h3 className="mb-2 text-xl font-semibold">
              Digital forretningsutvikling
            </h3>
            <p className="text-gray-300">
              Fokus på hvordan digital teknologi kan skape nye muligheter,
              effektivisere prosesser og utvikle forretningsmodeller.
            </p>
          </div>
          <div className="rounded border border-gray-800 p-4">
            <h3 className="mb-2 text-xl font-semibold">Datateknologi</h3>
            <p className="text-gray-300">
              Omhandler grunnleggende prinsipper i informatikk, programmering og
              algoritmer.
            </p>
          </div>
          <div className="rounded border border-gray-800 p-4">
            <h3 className="mb-2 text-xl font-semibold">
              Digital infrastruktur og cybersikkerhet
            </h3>
            <p className="text-gray-300">
              Lærer hvordan man drifter og sikrer IT-infrastruktur i en verden
              der cybertrusler stadig øker.
            </p>
          </div>
          <div className="rounded border border-gray-800 p-4">
            <h3 className="mb-2 text-xl font-semibold">
              Digital transformasjon
            </h3>
            <p className="text-gray-300">
              Forståelse for hvordan bedrifter og organisasjoner kan utnytte
              teknologi for å forbedre og fornye seg.
            </p>
          </div>
        </div>
      </section>

      <BottomBar />
      <Footer />
    </>
  )
}
