"use client";
import { useState } from "react";

type Section = "quickstart" | "core" | "music" | "artists" | "growing" | "advanced" | "faq";

const SECTIONS: { id: Section; title: string }[] = [
  { id: "quickstart", title: "Quick Start" },
  { id: "core", title: "Core Systems" },
  { id: "music", title: "Releasing Music" },
  { id: "artists", title: "Managing Artists" },
  { id: "growing", title: "Growing the Label" },
  { id: "advanced", title: "Advanced Strategy" },
  { id: "faq", title: "FAQ & Tips" },
];

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-gray-900 font-bold text-sm mt-4 mb-1">{children}</h3>;
}

function Sub({ children }: { children: React.ReactNode }) {
  return <h4 className="text-gray-700 font-semibold text-xs mt-3 mb-0.5">{children}</h4>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-gray-600 text-xs leading-relaxed mb-1.5">{children}</p>;
}

function Li({ children }: { children: React.ReactNode }) {
  return <li className="text-gray-600 text-xs leading-relaxed ml-3">{children}</li>;
}

function QuickStart() {
  return (
    <div>
      <Heading>Quick Start Guide</Heading>
      <P>You just founded a record label. You start with no signed artists, $100K in the bank, and a small reputation. Your goal: build the most dominant label in the industry.</P>

      <Sub>First Turns (Weeks 1-4)</Sub>
      <ol className="list-decimal space-y-1 ml-4">
        <Li>Go to <strong>Scouting</strong> and scout available free agents. Look for artists with decent overall ratings and genres you want to focus on.</Li>
        <Li>Sign 1-2 artists to contracts. Pay attention to their attributes, genre, and potential.</Li>
        <Li>Head to <strong>Studio</strong> and start recording songs. Pick a producer whose genre matches your artist for the best results.</Li>
        <Li>Release your best singles to start generating streams and chart positions.</Li>
        <Li>Hit <strong>Next Turn</strong> to advance the week and see your results.</Li>
      </ol>

      <Sub>What Success Looks Like Early On</Sub>
      <ul className="list-disc space-y-0.5 ml-4">
        <Li>Songs charting in the top 40</Li>
        <Li>Steady streaming revenue each week</Li>
        <Li>Reputation climbing above 30</Li>
        <Li>Enough cash to sign more artists and record more music</Li>
      </ul>
    </div>
  );
}

function CoreSystems() {
  return (
    <div>
      <Heading>Core Systems</Heading>

      <Sub>Weekly Turns</Sub>
      <P>Each turn represents one week. Revenue is calculated weekly from streams, tours, merch, and brand deals. Overhead costs (salaries, maintenance) are also deducted weekly.</P>

      <Sub>Money</Sub>
      <P>Cash is your lifeline. You need it to sign artists, pay producers, book tours, and upgrade your label. Going into severe debt ($-50K) triggers a game over.</P>

      <Sub>Reputation (0-100)</Sub>
      <P>Reputation reflects your label&apos;s standing in the industry. Higher rep unlocks better signing opportunities, brand deals (at 50+), and industry respect. Reputation gains diminish as you get higher - going from 80 to 90 is much harder than 20 to 30. Dropping to 0 ends the game.</P>

      <Sub>Fanbase</Sub>
      <P>Your cumulative listener base. Fans drive streaming revenue and merch sales. Fanbase grows through releases, tours, and viral moments.</P>

      <Sub>Studio Level (0-10)</Sub>
      <P>Upgrade your studio to unlock higher-tier producers. Underground producers are available from the start. Mid-tier unlock at level 4+, high-tier at 7+, and elite at 9+.</P>

      <Sub>Scouting Level (0-10)</Sub>
      <P>Higher scouting reveals more of the free agent pool and gives more detailed information about prospects.</P>
    </div>
  );
}

function ReleasingMusic() {
  return (
    <div>
      <Heading>Releasing Music</Heading>

      <Sub>Recording</Sub>
      <P>Select an artist and producer to record a song. The song&apos;s quality depends on the artist&apos;s attributes, the producer&apos;s quality/hitmaking stats, and genre compatibility. Artists have weekly recording limits based on their work ethic.</P>

      <Sub>Producer Selection</Sub>
      <P>Producers specialize in genres. Using a producer whose specialty matches your artist&apos;s genre gives a significant quality boost. The genre filter auto-defaults to your selected artist&apos;s genre. Look for the fit indicators:</P>
      <ul className="list-disc space-y-0.5 ml-4">
        <Li><strong>Strong Fit</strong> (green) - Same genre, maximum quality bonus</Li>
        <Li><strong>Good Fit</strong> (blue) - Related genre, modest bonus</Li>
        <Li><strong>Neutral</strong> (gray) - No bonus or penalty</Li>
        <Li><strong>Poor Fit</strong> (red) - Mismatched genres, quality penalty</Li>
      </ul>

      <Sub>Singles vs Albums</Sub>
      <P>Songs can be released as standalone singles or collected into albums. Singles are faster to release and test the waters. Albums require {">"}6 tracks and generate more revenue, reputation, and awards potential. You can add previously released singles to an album if they&apos;re marked as album-eligible.</P>

      <Sub>Album Strategy</Sub>
      <P>Start an album project for an artist, then record songs into it. The album&apos;s quality score is the average of its tracks. Higher marketing budgets boost initial streams. Artists have album cooldowns after releasing one.</P>

      <Sub>Features</Sub>
      <P>Add feature artists to songs for a collaboration boost. Features from bigger artists cost more but can dramatically increase a song&apos;s reach. Chemistry between artists affects the final quality.</P>
    </div>
  );
}

function ManagingArtists() {
  return (
    <div>
      <Heading>Managing Artists</Heading>

      <Sub>Artist Attributes</Sub>
      <P>Each artist has 15 skill attributes across three categories: Lyricism (lyricism, wordplay, storytelling, creativity, originality), Flow (flow, delivery, technique, mic presence, versatility), and Songwriting (songwriting, hookability, beat selection, hitmaking, charisma). The overall rating is their average.</P>

      <Sub>Contracts</Sub>
      <P>When signing an artist, you choose a 1, 2, or 3-album deal. After they fulfill their album commitments, you&apos;ll need to renegotiate. Better artists in demand will cost more to re-sign. If negotiations fail, they may leave.</P>

      <Sub>Fatigue & Morale</Sub>
      <P>Recording and touring increase fatigue. High fatigue lowers song quality and increases injury risk. Use the Rest action to recover. Morale affects willingness to re-sign and overall productivity. Chart success and fan growth boost morale.</P>

      <Sub>Touring</Sub>
      <P>Tours generate revenue and reputation but take the artist off the studio for several weeks. Tour sizes range from club tours (cheap, short) to world tours (expensive, long, massive revenue). Artists need cooldown periods between tours, especially major ones.</P>

      <Sub>Artist Development</Sub>
      <P>Young artists improve over time, especially with good management. Their attributes grow toward their potential ceiling. Artists peak at their peak age (26-32) and may decline after. Archetypes like &quot;raw young prospect&quot; can evolve into &quot;buzzing underground&quot; or higher.</P>

      <Sub>Legal Troubles</Sub>
      <P>Artists with high controversy risk may get into legal trouble. This progresses through stages: incident, charges filed, court case, and potentially jail time. Jailed artists can&apos;t record or tour. After release, they get a &quot;first day out&quot; comeback bonus on their next release.</P>
    </div>
  );
}

function GrowingLabel() {
  return (
    <div>
      <Heading>Growing the Label</Heading>

      <Sub>Upgrades</Sub>
      <P>Seven department upgrades (0-10 each) improve different aspects of your label:</P>
      <ul className="list-disc space-y-0.5 ml-4">
        <Li><strong>Studio</strong> - Unlocks better producers</Li>
        <Li><strong>Scouting</strong> - Reveals more free agents and details</Li>
        <Li><strong>Artist Development</strong> - Faster attribute growth</Li>
        <Li><strong>Touring</strong> - Better tour revenue and options</Li>
        <Li><strong>Marketing</strong> - Stronger release impact</Li>
        <Li><strong>PR</strong> - Mitigates scandal damage</Li>
        <Li><strong>Merch</strong> - Increases merch revenue</Li>
      </ul>

      <Sub>Revenue Streams</Sub>
      <P><strong>Streaming</strong> is the primary revenue source. Each stream earns $0.007. Songs on the chart earn more. <strong>Touring</strong> generates lump-sum payouts. <strong>Merch</strong> scales with fanbase and popularity. <strong>Brand deals</strong> unlock at reputation 50+ and scale with rep and fanbase.</P>

      <Sub>Charts & Competition</Sub>
      <P>Your songs compete with rival label releases for chart positions. Chart position is driven by quality, artist popularity, momentum, buzz, and fanbase. Staying on the chart longer earns more streams and reputation.</P>

      <Sub>Rival Labels</Sub>
      <P>Several AI-controlled labels compete against you, signing artists, releasing music, and climbing rankings. Their roster scales with prestige. You can even switch to managing a rival label if you want a fresh challenge.</P>

      <Sub>Awards</Sub>
      <P>Annual award ceremonies recognize the best songs, albums, artists, and labels. Winning awards brings cash bonuses, reputation, and bragging rights. Build a portfolio of quality releases throughout the year.</P>
    </div>
  );
}

function AdvancedStrategy() {
  return (
    <div>
      <Heading>Advanced Strategy</Heading>

      <Sub>Genre Specialization vs Diversity</Sub>
      <P>Focusing on one genre lets you maximize producer-artist fit and build a cohesive brand. But diversifying protects against market shifts and opens more signing opportunities. Most successful labels lean toward 1-2 primary genres.</P>

      <Sub>When to Release Albums vs Singles</Sub>
      <P>Singles are great for testing artists and building buzz quickly. Albums are better for established artists who can fill 6+ tracks with quality. Release a few singles to build hype, then drop the album. Pre-release singles add to album hype score.</P>

      <Sub>Tour Timing</Sub>
      <P>Don&apos;t tour an artist right after a release - let the streams build first. Tour after momentum is established to maximize both revenue and reputation gains. Avoid back-to-back major tours; use the cooldown for recording.</P>

      <Sub>Roster Management</Sub>
      <P>Quality over quantity. A roster of 3-4 strong artists beats 8 mediocre ones. Drop underperformers to free up budget. Sign artists with high potential even if their current rating is modest - they&apos;ll grow.</P>

      <Sub>Economy Tips</Sub>
      <P>Early game: keep costs low with underground producers. Mid game: invest in studio upgrades to unlock mid-tier producers. Late game: elite producers are expensive but produce hits that pay for themselves many times over.</P>

      <Sub>The Mall</Sub>
      <P>The Mall is purely cosmetic - jewelry, cars, homes, and more. It&apos;s a fun money sink once you&apos;re profitable, but don&apos;t go broke buying a Bugatti.</P>
    </div>
  );
}

function FAQ() {
  return (
    <div>
      <Heading>FAQ & Common Mistakes</Heading>

      <Sub>Why are my songs flopping?</Sub>
      <P>Check producer-artist genre match (use the fit indicators). Make sure artist fatigue isn&apos;t too high. Higher quality producers make a big difference. Don&apos;t release every song - scrap the weak ones.</P>

      <Sub>How do I make more money?</Sub>
      <P>Focus on getting songs to chart. Charting songs earn dramatically more streams. Tour your popular artists. Upgrade merch department for passive income. At rep 50+, brand deals start flowing.</P>

      <Sub>My artist wants to leave - what do I do?</Sub>
      <P>Renegotiate their contract before it expires. If you can&apos;t afford the fee, try the risk-retain option (success depends on loyalty and morale). Keep morale high with chart success and reasonable workloads.</P>

      <Sub>When should I upgrade departments?</Sub>
      <P>Studio first (unlocks better producers = better songs = more revenue). Scouting second (find better artists). Then touring and marketing. PR is important if your artists are controversy-prone.</P>

      <Sub>How does reputation work at high levels?</Sub>
      <P>Reputation gains have aggressive diminishing returns above 50. At 90+ rep, gains are reduced to 15% of their normal value. This means maintaining elite status requires consistent excellence.</P>

      <Sub>What happens if I go bankrupt?</Sub>
      <P>If your cash drops below -$50K, it&apos;s game over. Similarly, if reputation hits 0, the label closes. Keep an eye on weekly overhead costs and don&apos;t overextend on expensive signings or tours.</P>

      <Sub>Can I save my progress?</Sub>
      <P>The game autosaves to your active slot every few seconds. You have 4 save slots. Create an account to sync saves across devices, or play as a guest with local storage.</P>
    </div>
  );
}

export default function HelpPanel() {
  const [section, setSection] = useState<Section>("quickstart");

  return (
    <div className="p-2 max-w-2xl mx-auto">
      <h2 className="text-gray-900 font-bold text-base mb-2">How to Play</h2>

      {/* Section tabs */}
      <div className="flex gap-0.5 overflow-x-auto pb-1 mb-2">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`px-2.5 py-1.5 text-xs font-medium whitespace-nowrap rounded transition ${
              section === s.id
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white border border-gray-200 rounded-md p-3 sm:p-4">
        {section === "quickstart" && <QuickStart />}
        {section === "core" && <CoreSystems />}
        {section === "music" && <ReleasingMusic />}
        {section === "artists" && <ManagingArtists />}
        {section === "growing" && <GrowingLabel />}
        {section === "advanced" && <AdvancedStrategy />}
        {section === "faq" && <FAQ />}
      </div>
    </div>
  );
}
