"use client"

import Navbar from "@/components/navigation/TopBar"
import Footer from "@/components/navigation/Footer"
import BottomBar from "@/components/navigation/BottomBar"
import Hero from "@/components/hero"
import Image from "next/image"
import TihldeLogo from "@/components/miscellaneous/TihldeLogo"

export default function Hjem() {
  return (
    <div className="relative flex flex-col items-center justify-center">
      <Navbar />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-140 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
      >
        <div
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-cyan-500 to-indigo-700 opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
        />
      </div>
      <Hero />
      {/* Om TIHLDE */}
      <section className="max-w-5xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-5 items-center">
          <div className="md:col-span-2">
            <h2 className="mb-6 text-3xl font-bold">Om TIHLDE</h2>
            <p className="mb-4 text-gray-300 text-lg leading-relaxed">
              Vi er linjeforeningen for datastudenter, og vårt mål er å knytte tettere bånd mellom studenter og næringslivet. Gjennom våre aktiviteter får bedrifter muligheten til å nå motiverte studenter som søker utfordringer og nye muligheter.
            </p>
          </div>
          <div className="flex items-center justify-center md:col-span-3">
            <TihldeLogo size="large" className="w-full" />
          </div>
        </div>
      </section>
      <div
        aria-hidden="true"
        className="absolute right-0 top-140 -z-10 transform-gpu overflow-hidden blur-3xl sm:top-96"
      >
        <div
          style={{
            clipPath:
              "polygon(100% 61.6%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] rotate-[-30deg] bg-gradient-to-tr from-cyan-500 to-indigo-700 opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
        />
      </div>

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
            <h2 className="mb-6 text-3xl font-bold">Kurs og workshops</h2>
            <p className="mb-4 text-gray-300 text-lg leading-relaxed">
              Et kurs introduserer studentene for relevante faglige erfaringer til arbeidslivet. Det kan starte med en kort presentasjon av bedriften. Vi legger til rette for matservering på skolen eller restaurantbesøk etter kurset.
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

      <section className="max-w-5xl px-4 py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-5">
          <div className="md:md:col-span-2">
            <h2 className="mb-6 text-3xl font-bold">Bedriftsbesøk</h2>
            <p className="mb-4 text-gray-300 text-lg leading-relaxed">
              Under et bedriftsbesøk besøker studentene deres lokaler for et valgfritt arrangement. Dette gir dere en mulighet til å vise frem arbeidsplassen og bli bedre kjent med dem.
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
            <h2 className="mb-6 text-3xl font-bold">Bedriftsekskursjon</h2>
            <p className="mb-4 text-gray-300 text-lg leading-relaxed">
              Hver høst arrangerer TIHLDE en bedriftsekskursjon til Oslo med 60 studenter. Dette gir bedrifter en god mulighet til å vise frem sine lokaler og bli bedre kjent med studentene. Etter besøket legger vi til rette for bespisning og mingling.
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

      <section className="max-w-5xl px-4 py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-5">
          <div className="md:md:col-span-2">
            <h2 className="mb-6 text-3xl font-bold">Stillingannonser</h2>
            <p className="mb-4 text-gray-300 text-lg leading-relaxed">
              Publiser relevante stillinger, internships eller trainee-programmer direkte til våre medlemmer. Sikre deg de beste kandidatene!
            </p>
          </div>
          <div className="flex items-center justify-center md:col-span-3 md:order-first">
            <Image src="/stillingsannonser.png" alt="Stillingsannonser" width={603} height={273} className="h-auto" />
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
