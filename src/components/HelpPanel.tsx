"use client";

function Heading({ id, children }: { id: string; children: React.ReactNode }) {
  return <h3 id={id} className="text-gray-900 font-bold text-sm mt-6 mb-1 scroll-mt-4">{children}</h3>;
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

const TOC = [
  { id: "overview", label: "Overview" },
  { id: "starting", label: "Starting a Label" },
  { id: "signing", label: "Signing Artists" },
  { id: "music", label: "Releasing Music" },
  { id: "promo", label: "Promo & Growth" },
  { id: "finances", label: "Finances" },
  { id: "upgrades", label: "Upgrades" },
  { id: "achievements", label: "Achievements & Hall of Fame" },
  { id: "tips", label: "Tips & Strategy" },
];

export default function HelpPanel() {
  return (
    <div className="p-2 sm:p-4 max-w-2xl mx-auto">
      <h2 className="text-gray-900 font-bold text-base mb-3">How to Play</h2>

      {/* Table of contents */}
      <nav className="bg-white border border-gray-200 rounded-md p-3 mb-4">
        <div className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide mb-1.5">Contents</div>
        <ol className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
          {TOC.map((item, i) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="text-xs text-blue-600 hover:text-blue-500 hover:underline transition"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {i + 1}. {item.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* All sections in one scrollable flow */}
      <div className="bg-white border border-gray-200 rounded-md p-3 sm:p-4 space-y-2">

        {/* 1. Overview */}
        <Heading id="overview">Overview</Heading>
        <P>You just founded a record label. You start with no signed artists, $120K in the bank, and a small reputation. Your goal: build the most dominant hip-hop label in the industry.</P>
        <P>Each turn represents one week. Every week you can sign artists, record songs, release music, book tours, upgrade departments, and more. Revenue is calculated weekly from streams, tours, merch, and brand deals. Overhead costs are also deducted weekly.</P>
        <P>The game ends if your cash drops below -$50K (bankruptcy) or reputation hits 0. Otherwise, play as long as you want and chase achievements, awards, and Hall of Fame status.</P>

        {/* 2. Starting a Label */}
        <Heading id="starting">Starting a Label</Heading>
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

        {/* 3. Signing Artists */}
        <Heading id="signing">Signing Artists</Heading>
        <Sub>Scouting & Discovery</Sub>
        <P>Your Scouting department determines how many free agents you can see. Higher scouting level reveals more of the 400-artist market. Discovered artists show full stats; undiscovered ones are hidden.</P>

        <Sub>Contracts</Sub>
        <P>When signing an artist, choose a 1, 2, or 3-album deal. Longer deals cost more upfront but lock in the artist. After they fulfill their album commitments, you&apos;ll need to renegotiate. If negotiations fail, they may leave.</P>

        <Sub>Willingness</Sub>
        <P>Artists have a willingness to sign based on your label&apos;s reputation vs their star power. Elite artists won&apos;t sign with unknown labels. Build reputation to attract top talent. If declined, there&apos;s an 8-week cooldown before you can re-approach.</P>

        <Sub>Artist Attributes</Sub>
        <P>Each artist has 15 skill attributes across three categories: Lyricism (lyricism, wordplay, storytelling, creativity, originality), Flow (flow, delivery, technique, mic presence, versatility), and Songwriting (songwriting, hookability, beat selection, hitmaking, charisma). The overall rating is their average.</P>

        {/* 4. Releasing Music */}
        <Heading id="music">Releasing Music</Heading>
        <Sub>Recording</Sub>
        <P>Select an artist and producer to record a song. Song quality depends on the artist&apos;s attributes, the producer&apos;s quality/hitmaking stats, and genre compatibility. Artists have weekly recording limits based on their work ethic.</P>

        <Sub>Producer Selection</Sub>
        <P>Producers specialize in genres. Matching genres gives a significant quality boost. Look for the fit indicators:</P>
        <ul className="list-disc space-y-0.5 ml-4">
          <Li><strong>Strong Fit</strong> (green) - Same genre, maximum quality bonus</Li>
          <Li><strong>Good Fit</strong> (blue) - Related genre, modest bonus</Li>
          <Li><strong>Neutral</strong> (gray) - No bonus or penalty</Li>
          <Li><strong>Poor Fit</strong> (red) - Mismatched genres, quality penalty</Li>
        </ul>

        <Sub>Singles vs Albums</Sub>
        <P>Songs can be released as standalone singles or collected into albums. Singles are faster and test the waters. Albums require 6+ tracks and generate more revenue, reputation, and awards potential.</P>

        <Sub>Album Strategy</Sub>
        <P>Start an album project for an artist, then record songs into it. The album&apos;s quality score is the average of its tracks. Higher marketing budgets boost initial streams. Artists have album cooldowns after releasing one.</P>

        <Sub>Features</Sub>
        <P>Add feature artists to songs for a collaboration boost. Features from bigger artists cost more but can dramatically increase a song&apos;s reach. Chemistry between artists affects the final quality.</P>

        {/* 5. Promo & Growth */}
        <Heading id="promo">Promo & Growth</Heading>
        <Sub>Fatigue & Morale</Sub>
        <P>Recording and touring increase fatigue. High fatigue lowers song quality and increases injury risk. Use the Rest action to recover. Morale affects willingness to re-sign and overall productivity.</P>

        <Sub>Touring</Sub>
        <P>Tours generate revenue and reputation but take the artist off the studio for several weeks. Tour sizes range from club tours (cheap, short) to world tours (expensive, long, massive revenue). Artists need cooldown periods between tours.</P>

        <Sub>Charts & Competition</Sub>
        <P>Your songs compete with rival label releases for chart positions. Chart position is driven by quality, artist popularity, momentum, buzz, and fanbase. Staying on the chart longer earns more streams and reputation.</P>

        <Sub>Artist Development</Sub>
        <P>Young artists improve over time, especially with good management. Their attributes grow toward their potential ceiling. Artists peak at their peak age (26-32) and may decline after.</P>

        <Sub>Rival Labels</Sub>
        <P>Several AI-controlled labels compete against you, signing artists, releasing music, and climbing rankings. Their roster scales with prestige.</P>

        {/* 6. Finances */}
        <Heading id="finances">Finances</Heading>
        <Sub>Revenue Streams</Sub>
        <P><strong>Streaming</strong> is the primary revenue source. All released songs generate base revenue from your cumulative fanbase, with charting songs earning significantly more. A catalog of released songs builds long-tail passive income over time.</P>
        <P><strong>Touring</strong> generates lump-sum payouts scaled by artist popularity and fan count. Don&apos;t tour too frequently — there&apos;s a cooldown penalty for back-to-back tours.</P>
        <P><strong>Merch</strong> scales with fanbase, popularity, and your Merch department level. Higher-tier artists with larger fanbases generate significantly more.</P>
        <P><strong>Brand Deals</strong> unlock at reputation 50+ and require a marketable artist (25K+ fans or 40+ popularity). Revenue scales with rep and fanbase.</P>

        <Sub>Overhead</Sub>
        <P>Weekly overhead includes artist salaries and department maintenance. Keep an eye on your burn rate vs income. Going below -$50K cash ends the game.</P>

        {/* 7. Upgrades */}
        <Heading id="upgrades">Upgrades</Heading>
        <P>Seven department upgrades (0-10 each) improve different aspects of your label:</P>
        <ul className="list-disc space-y-0.5 ml-4">
          <Li><strong>Studio</strong> - Unlocks better producers and increases roster cap</Li>
          <Li><strong>Scouting</strong> - Reveals more free agents and gives better prospect info</Li>
          <Li><strong>Artist Development</strong> - Faster attribute growth for your artists</Li>
          <Li><strong>Touring</strong> - Better tour revenue and more tour options</Li>
          <Li><strong>Marketing</strong> - Stronger release impact and initial streams</Li>
          <Li><strong>PR</strong> - Mitigates scandal damage and controversy fallout</Li>
          <Li><strong>Merch</strong> - Increases merch revenue per fan</Li>
        </ul>
        <P>Recommended upgrade order: Studio first (better producers = better songs = more revenue), Scouting second (find better artists), then Touring and Marketing. PR is important if your artists are controversy-prone.</P>

        {/* 8. Achievements & Hall of Fame */}
        <Heading id="achievements">Achievements & Hall of Fame</Heading>
        <Sub>Awards</Sub>
        <P>Annual award ceremonies recognize the best songs, albums, artists, and labels. Winning awards brings cash bonuses, reputation, and bragging rights.</P>

        <Sub>Achievements</Sub>
        <P>Track milestones across 11 categories: streaming, merch, touring, cash, charts, albums, awards, collaborations, dynasty, Hall of Fame, and narrative. Each category has multiple tiers to unlock.</P>

        <Sub>Hall of Fame</Sub>
        <P>Legendary artists who achieve sustained excellence can be inducted into the Hall of Fame. This is the ultimate mark of a career well-managed.</P>

        {/* 9. Tips & Strategy */}
        <Heading id="tips">Tips & Strategy</Heading>
        <Sub>Genre Specialization vs Diversity</Sub>
        <P>Focusing on one genre lets you maximize producer-artist fit and build a cohesive brand. But diversifying protects against market shifts. Most successful labels lean toward 1-2 primary genres.</P>

        <Sub>Release Timing</Sub>
        <P>Singles are great for testing artists and building buzz quickly. Albums are better for established artists who can fill 6+ tracks with quality. Release a few singles to build hype, then drop the album.</P>

        <Sub>Tour Timing</Sub>
        <P>Don&apos;t tour an artist right after a release — let the streams build first. Tour after momentum is established. Avoid back-to-back major tours; use the cooldown for recording.</P>

        <Sub>Roster Management</Sub>
        <P>Quality over quantity. A roster of 3-4 strong artists beats 8 mediocre ones. Drop underperformers to free up budget. Sign artists with high potential even if their current rating is modest.</P>

        <Sub>Early Game Economy</Sub>
        <P>Keep costs low with underground producers early on. Build a catalog of released songs quickly — even modest songs earn base streaming revenue. Invest in studio upgrades to unlock mid-tier producers by the end of year one.</P>

        <Sub>Common Mistakes</Sub>
        <ul className="list-disc space-y-0.5 ml-4">
          <Li><strong>Songs flopping?</strong> Check producer-artist genre match. Make sure fatigue isn&apos;t too high. Scrap weak songs instead of releasing everything.</Li>
          <Li><strong>Running out of money?</strong> Focus on getting songs to chart. Tour popular artists. Upgrade merch for passive income.</Li>
          <Li><strong>Artist leaving?</strong> Renegotiate before contracts expire. Keep morale high with chart success and reasonable workloads.</Li>
          <Li><strong>Going bankrupt?</strong> Watch weekly overhead vs income. Don&apos;t overextend on expensive signings or tours.</Li>
        </ul>

        <Sub>The Mall</Sub>
        <P>The Mall is purely cosmetic — jewelry, cars, homes, and more. It&apos;s a fun money sink once you&apos;re profitable, but don&apos;t go broke buying a Bugatti.</P>
      </div>
    </div>
  );
}
