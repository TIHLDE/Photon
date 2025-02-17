// app/page.tsx
"use client"

import Image from "next/image"
import Navbar from "./components/Navbar"

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
        <div className="mx-auto max-w-4xl text-center px-4">
          <p className="text-[hsl(230,100%,79%)]">Møt morgendagens IT-talenter!</p>
          <h1 className="mb-4 text-4xl font-extrabold md:text-7xl bg-gradient-to-r from-white/50 via-white to-white/50 bg-clip-text text-transparent">
    Samarbeid med TIHLDE
</h1>

          <p className="mb-8 text-lg text-gray-300">
          Som linjeforening for datastudenter tilbyr vi unike muligheter for bedrifter til å knytte seg til en ny generasjon IT-eksperter. Utforsk våre tilbud og bli en del av nettverket som inspirerer, engasjerer og rekrutterer!
          </p>
          <a
            href="#tilbud"
            className="inline-block rounded bg-[hsl(220,62%,41%)] px-6 py-3 font-semibold text-white hover:bg-gray-200"
          >
            Se hva vi kan tilby
          </a>
        </div>
      </section>

      {/* Om TIHLDE */}
      <section id="tilbud" className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="mb-6 text-3xl font-bold">Om TIHLDE</h2>
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <p className="mb-4 text-gray-300">
              TIHLDE er en linjeforening for studenter ved ulike IT-relaterte
              studier. Vårt mål er å knytte næringsliv og studenter sammen
              gjennom ulike arrangementer, bedriftsbesøk og faglige initiativ.
            </p>
            <p className="text-gray-300">
              Vi tilbyr bedrifter en unik mulighet til å presentere seg for
              kommende arbeidstakere, og studentene får verdifull innsikt i
              bransjen.
            </p>
          </div>
          <div className="flex items-center justify-center">
            {/* Eksempelbilde eller annet innhold */}
            <div className="relative h-64 w-full bg-gray-800">
              <p className="absolute inset-0 flex items-center justify-center text-gray-600">
                Bilde / galleri
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bedriftspresentasjoner */}
      <section
        id="bedriftspresentasjoner"
        className="mx-auto max-w-5xl px-4 py-16"
      >
        <h2 className="mb-6 text-3xl font-bold">Bedriftspresentasjoner</h2>
        <p className="mb-4 text-gray-300">
          Vi arrangerer jevnlig bedrifts­presentasjoner hvor bedrifter kan møte
          studentene ansikt til ansikt og vise frem sine prosjekter,
          karrieremuligheter og arbeidsmiljø.
        </p>
        <a
          href="#kontakt"
          className="inline-block rounded bg-white px-6 py-3 font-semibold text-black hover:bg-gray-200"
        >
          Kontakt oss for mer info
        </a>
      </section>

      {/* Stillingannonser */}
      <section id="stillinger" className="bg-gray-900 py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="mb-6 text-3xl font-bold">Stillingannonser</h2>
          <p className="mb-4 text-gray-300">
            Ønsker du å rekruttere studenter? Vi tilbyr en plattform for å legge
            ut relevante stillinger rettet mot IT-studenter.
          </p>
          <div className="mt-8">
            {/* Eksempel på stillingskort */}
            <div className="mb-4 rounded border border-gray-700 p-4">
              <h3 className="text-xl font-semibold">Sommerjobb i XYZ AS</h3>
              <p className="text-gray-400">
                Bli med på et spennende prosjekt innen webutvikling.
              </p>
            </div>
            <div className="mb-4 rounded border border-gray-700 p-4">
              <h3 className="text-xl font-semibold">Deltidsjobb hos ABC</h3>
              <p className="text-gray-400">
                Perfekt for studenter som ønsker relevant erfaring ved siden av
                studiet.
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

      {/* Kontakt */}
      <section id="kontakt" className="bg-gray-900 py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="mb-6 text-3xl font-bold">Kontakt oss</h2>
          <p className="mb-4 text-gray-300">
            Ta gjerne kontakt for mer informasjon om samarbeid, arrangementer
            eller andre spørsmål.
          </p>
          <a
            href="mailto:post@tihlde.org"
            className="inline-block rounded bg-white px-6 py-3 font-semibold text-black hover:bg-gray-200"
          >
            Send e-post
          </a>
        </div>
      </section>
    </>
  )
}
