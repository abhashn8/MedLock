import { Header } from "@/components/header"
import { HeroSection } from "@/components/hero"

export default function Home() {
  return (
    <div className="relative min-h-screen bg-hs-page">
      <Header />
      <main>
        <HeroSection />
      </main>
    </div>
  )
}
