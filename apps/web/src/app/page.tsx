"use client"

import Navbar from "@/components/navigation/TopBar"
import Footer from "@/components/navigation/Footer"
import BottomBar from "@/components/navigation/BottomBar"
import Hero from "@/components/hero"

export default function Hjem() {
  return (
    <div className="flex flex-col items-center justify-center">
      <Navbar />
      <Hero />
      {/* Om TIHLDE */}
      <section className="max-w-5xl px-4 py-16">
        <div className="grid gap-8 md:grid-cols-5">
          <div className="md:col-span-2">
            <h2 className="mb-6 text-3xl font-bold">Om TIHLDE</h2>
            <p className="mb-4 text-gray-300 text-lg leading-relaxed">
              Vi er linjeforeningen for datastudenter, og vårt mål er å knytte tettere bånd mellom studenter og næringslivet. Gjennom våre aktiviteter får bedrifter muligheten til å nå motiverte studenter som søker utfordringer og nye muligheter.
            </p>
          </div>
          <div className="flex items-center justify-center md:col-span-3">
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
      <section className="max-w-5xl px-4 py-16">
        <div className="grid gap-8 md:grid-cols-5">
          <div className="md:col-span-2">
            <h2 className="mb-6 text-3xl font-bold">Bedriftspresentasjoner</h2>
            <p className="mb-4 text-gray-300 text-lg leading-relaxed">
              En bedriftspresentasjon lar dere introdusere organisasjonen for TIHLDE-studentene, vise hva dere tilbyr og hvordan dere jobber. Etter presentasjonen følger middag og mingling med bedriftsrepresentanter.
            </p>
          </div>
          <div className="flex items-center justify-center md:col-span-3 md:order-first">
            {/* Eksempelbilde eller annet innhold */}
            <div className="relative h-64 w-full bg-gray-800">
              <p className="absolute inset-0 flex items-center justify-center text-gray-600">
                Bilde
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-5xl px-4 py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-5">
          <div className="md:md:col-span-2">
            <h2 className="mb-6 text-3xl font-bold">Stillingannonser</h2>
            <p className="mb-4 text-gray-300 text-lg leading-relaxed">
              Publiser relevante stillinger, internships eller trainee-programmer direkte til våre medlemmer. Sikre deg de beste kandidatene!
            </p>
          </div>
          <div className="flex items-center justify-center md:col-span-3">
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
      <section id="linjene" className="max-w-5xl px-4 py-16">
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
    </div>
  )
}
