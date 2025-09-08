import Navbar from "@/components/navigation/TopBar"
import Footer from "@/components/navigation/Footer"
import BottomBar from "@/components/navigation/BottomBar"
import Hero from "@/components/hero"
import Image from "next/image"
import TihldeLogo from "@/components/miscellaneous/TihldeLogo"
import {getJobPosts} from "@/services/getJobPosts";
import JobPostListItem, {JobPostListItemLoading} from "@/components/JobPostListItem";
import {Suspense} from "react";

async function JobPostList() {
    const post = await getJobPosts();

    console.log(post);

    if (!post || !post.results || post.length === 0) {
        return <p className="text-black">No posts found!</p>;
    }

    return (
        <div className="flex flex-col gap-4">
            {post.results.map((post) => (
                <JobPostListItem jobPost={post} />
            ))}
        </div>
    )
}


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
      <section className="max-w-5xl px-4 py-16 h-auto justify-center">
        <div className="grid md:gap-8 md:grid-cols-5 place-items-center">
          <div className="md:col-span-2">
            <h2 className="mb-2 text-3xl font-bold">Om TIHLDE</h2>
            <p className="mb-4 text-gray-300 text-lg leading-relaxed">
              Vi er linjeforeningen for datastudenter, og vårt mål er å knytte tettere bånd mellom studenter og næringslivet. Gjennom våre aktiviteter får bedrifter muligheten til å nå motiverte studenter som søker utfordringer og nye muligheter.
            </p>
          </div>
          <div className="flex items-center justify-center md:col-span-3">
            {/* Eksempelbilde eller annet innhold */}
            <div className="relative w-full py-4">
              <TihldeLogo size="large" className="w-full h-auto" />
            </div>
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
      <section className="max-w-5xl px-4 py-16 h-auto justify-center">
        <div className="grid gap-8 md:grid-cols-5 place-items-center">
          <div className="md:col-span-2">
            <h2 className="mb-2 text-3xl font-bold">Bedriftspresentasjoner</h2>
            <p className="mb-4 text-gray-300 text-lg leading-relaxed">
              En bedriftspresentasjon lar dere introdusere organisasjonen for TIHLDE-studentene, vise hva dere tilbyr og hvordan dere jobber. Etter presentasjonen følger middag og mingling med bedriftsrepresentanter.
            </p>
          </div>
          <div className="flex items-center justify-center md:col-span-3 md:order-first">
            {/* Eksempelbilde eller annet innhold */}
            <div className="relative w-full">
              <Image src="/bedpres.jpeg" alt="Bedriftspresentasjoner" width={603} height={398} className="h-auto  rounded-lg" />
            </div>
          </div>
        </div>
      </section>

      <div
        aria-hidden="true"
        className="absolute right-0 top-128 -z-10 transform-gpu overflow-hidden blur-3xl"
      >
        <div
          style={{
            clipPath:
              "polygon(100% 61.6%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%)",
          }}
          className="relative left-[calc(10%-16rem)] aspect-[1155/678] w-[26.125rem] rotate-[10deg] bg-gradient-to-tr from-cyan-500 to-indigo-700 opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
        />
      </div>

      <section className="max-w-5xl px-4 py-16 h-auto justify-center">
        <div className="grid gap-8 md:grid-cols-5 place-items-center">
          <div className="md:col-span-2">
            <h2 className="mb-2 text-3xl font-bold">Kurs og workshops</h2>
            <p className="mb-4 text-gray-300 text-lg leading-relaxed">
              Et kurs introduserer studentene for relevante faglige erfaringer til arbeidslivet. Det kan starte med en kort presentasjon av bedriften. Vi legger til rette for matservering på skolen eller restaurantbesøk etter kurset.
            </p>
          </div>
          <div className="flex items-center justify-center md:col-span-3">
            {/* Eksempelbilde eller annet innhold */}
            <div className="relative w-full">
              <Image src="/kurs-workshop.jpeg" alt="Kurs og workshops" width={603} height={398} className="h-auto  rounded-lg" />
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-5xl px-4 py-16 h-auto justify-center">
        <div className="grid gap-8 md:grid-cols-5 place-items-center">
          <div className="md:col-span-2">
            <h2 className="mb-2 text-3xl font-bold">Bedriftsbesøk</h2>
            <p className="mb-4 text-gray-300 text-lg leading-relaxed">
              Under et bedriftsbesøk besøker studentene deres lokaler for et valgfritt arrangement. Dette gir dere en mulighet til å vise frem arbeidsplassen og bli bedre kjent med dem.
            </p>
          </div>
          <div className="flex items-center justify-center md:col-span-3 md:order-first">
            {/* Eksempelbilde eller annet innhold */}
            <div className="relative w-full">
              <Image src="/bedriftsbesøk.jpeg" alt="Bedriftsbesøk" width={603} height={398} className="h-auto rounded-lg" />
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-5xl px-4 py-16 h-auto justify-center">
        <div className="grid gap-8 md:grid-cols-5 place-items-center">
          <div className="md:col-span-2">
            <h2 className="mb-2 text-3xl font-bold">Bedriftsekskursjon</h2>
            <p className="mb-4 text-gray-300 text-lg leading-relaxed">
              Hver høst arrangerer TIHLDE en bedriftsekskursjon til Oslo med 60 studenter. Dette gir bedrifter en god mulighet til å vise frem sine lokaler og bli bedre kjent med studentene. Etter besøket legger vi til rette for bespisning og mingling.
            </p>
          </div>
          <div className="flex items-center justify-center md:col-span-3">
            {/* Eksempelbilde eller annet innhold */}
            <div className="relative w-full">
              <Image src="/bedpres.jpeg" alt="Bedriftsekskursjon" width={603} height={398} className="h-auto  rounded-lg" />
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-5xl px-4 py-16 h-auto justify-center">
        <div className="">
          <div className="md:col-span-2">
            <h2 className="mb-2 text-3xl font-bold">Stillingannonser</h2>
            <p className="mb-4 text-gray-300 text-lg leading-relaxed">
              Publiser relevante stillinger, internships eller trainee-programmer direkte til våre medlemmer. Sikre deg de beste kandidatene!
            </p>
          </div>
          <Suspense fallback={<div>JobPostListItemLoading</div>}>
              <JobPostList />
          </Suspense>
        </div>
      </section >

      <div
        aria-hidden="true"
        className="absolute right-0 top-2/3 -z-10 transform-gpu overflow-hidden blur-3xl"
      >
        <div
          style={{
            clipPath:
              "polygon(100% 61.6%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%)",
          }}
          className="relative -left-[calc(20%-16rem)] aspect-[1155/678] w-[36.125rem] rotate-[30deg] bg-gradient-to-tr from-cyan-500 to-indigo-700 opacity-30 sm:left-[calc(20%-30rem)] sm:w-[72.1875rem]"
        />
      </div>

      {/* Linjene */}
      < section id="linjene" className="max-w-5xl px-4 py-16" >
        <h2 className="mb-2 text-3xl font-bold">Linjene</h2>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded  -gray-800 p-4">

            <h3 className="mb-2 text-xl font-semibold">
              Digital forretningsutvikling
            </h3>
            <p className="text-gray-300">
              I krysningen mellom informatikk, økonomi, marked, organisasjon og ledelse møter du de som studerer digital forretningsutvikling.
            </p>
          </div>
          <div className="rounded  -gray-800 p-4">

            <h3 className="mb-2 text-xl font-semibold">
              Dataingeniør
            </h3>
            <p className="text-gray-300">
              Studiet gir et solid grunnlag for systemutvikling av digitale løsninger, med fokus på funksjonalitet, sikkerhet og brukertilpasning.
            </p>
          </div>
          <div className="p-4">
            <h3 className="mb-2 text-xl font-semibold">Digital infrastruktur og cybersikkerhet</h3>
            <p className="text-gray-300">
              Studiet kombinerer informatikk med praktiske ferdigheter innen digital infrastruktur og sikkerhet.
            </p>
          </div>
          <div className="p-4">
            <h3 className="mb-2 text-xl font-semibold">
              Digital transformasjon
            </h3>
            <p className="text-gray-300">
              Studiet gir avansert kompetanse i digital transformasjon, med fokus på hvordan virksomheter kan utnytte digitale teknologier for strategisk utvikling og effektivisering.
            </p>
          </div>
        </div>
      </section >

      <BottomBar />
      <Footer />
    </div >
  )
}
