"use client"

import Navbar from "@/components/navigation/TopBar"
import BottomBar from "@/components/navigation/BottomBar"
import Footer from "@/components/navigation/Footer"

const linjer = [
  {
    title: "Digital forretningsutvikling",
    description:
      "I krysningen mellom informatikk, økonomi, marked, organisasjon og ledelse møter du de som studerer digital forretningsutvikling.",
  },
  {
    title: "Dataingeniør",
    description:
      "Studiet gir et solid grunnlag for systemutvikling av digitale løsninger, med fokus på funksjonalitet, sikkerhet og brukertilpasning.",
  },
  {
    title: "Digital infrastruktur og cybersikkerhet",
    description:
      "Studiet kombinerer informatikk med praktiske ferdigheter innen digital infrastruktur og sikkerhet.",
  },
  {
    title: "Digital transformasjon",
    description:
      "Studiet gir avansert kompetanse i digital transformasjon, med fokus på hvordan virksomheter kan utnytte digitale teknologier for strategisk utvikling og effektivisering.",
  },
];

export default function Linjene() {
  return (
    <div className="flex flex-col items-center justify-center">
      <Navbar />
      {/* Om TIHLDE Linjene */}
      <section id="linjene" className="max-w-5xl px-4 py-16 mt-32">
        <h1 className="mb-4 text-5xl font-bold md:text-6xl">Linjene</h1>
        <div className="flex flex-col gap-8 mt-8">
          {linjer.map((linje) => (
            <div
              key={linje.title}
              className="p-6"
            >
              <h3 className="mb-2 text-xl font-semibold">{linje.title}</h3>
              <p className="text-gray-300 leading-relaxed">
                {linje.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <BottomBar />
      <Footer />
    </div>
  )
}
