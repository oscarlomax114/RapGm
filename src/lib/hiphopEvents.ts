// ── Hip-Hop Event System ──────────────────────────────────────────────────────
// Controversy, legal trouble, jail, and rap beef engine.
// Uses artist.controversyRisk as primary driver, PR as defense.
// Applied equally to player artists and rival artists.

import {
  Artist, GameEvent, GameState, RivalLabel,
  LegalState, BeefState, BeefStage, SentenceType, ActiveBeefRecord,
} from "./types";
import { PR_DATA } from "./data";

// ── Helpers ──────────────────────────────────────────────────────────────────

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randFloat(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// ── Event flavor pools ──────────────────────────────────────────────────────

const MINOR_CONTROVERSY_EVENTS = [
  { title: "Baby Mama Drama", desc: (n: string) => `${n}'s baby mama put him on blast on Instagram. The comments are going crazy.` },
  { title: "Ghostwriter Allegations", desc: (n: string) => `Someone leaked texts suggesting ${n} uses ghostwriters. Fans are debating.` },
  { title: "Chain Got Snatched", desc: (n: string) => `${n}'s chain got snatched at a nightclub. The video is everywhere.` },
  { title: "Awkward Interview", desc: (n: string) => `${n}'s interview clip went viral for all the wrong reasons. Twitter is having a field day.` },
  { title: "Livestream Rant", desc: (n: string) => `${n} went on a wild IG Live rant at 3 AM. Screenshots are circulating.` },
  { title: "Social Media Backlash", desc: (n: string) => `${n} posted something wild on Twitter. The quote tweets are brutal.` },
  { title: "Outfit Roast", desc: (n: string) => `${n} showed up to an event in a questionable fit. The memes are relentless.` },
  { title: "Leaked Snippet Mocked", desc: (n: string) => `A leaked snippet from ${n} is getting clowned online. Not a good look.` },
  { title: "Fan Encounter Goes Viral", desc: (n: string) => `${n} had an awkward fan encounter that got filmed. It's trending.` },
  { title: "Cryptic Posts", desc: (n: string) => `${n} posted a series of cryptic shots at unnamed people. Everyone's speculating.` },
  { title: "Old Video Resurfaces", desc: (n: string) => `An old embarrassing video of ${n} resurfaced. The internet won't let it go.` },
  { title: "Feature Verse Flopped", desc: (n: string) => `${n}'s feature verse is getting dragged. Multiple reaction videos already up.` },
  { title: "Parking Lot Argument", desc: (n: string) => `${n} was filmed arguing in a parking lot. The clip is going around.` },
  { title: "Caught Cappin'", desc: (n: string) => `${n} got exposed for lying about something. Receipts are out.` },
];

const MAJOR_CONTROVERSY_EVENTS = [
  { title: "Club Fight Goes Viral", desc: (n: string) => `${n} was involved in a fight at a club. Multiple angles filmed. This is a mess.` },
  { title: "Assault at Event", desc: (n: string) => `${n} allegedly assaulted someone at a public event. Witnesses are talking.` },
  { title: "Label Argument Leaked", desc: (n: string) => `A heated argument between ${n} and label management leaked. It's ugly.` },
  { title: "Exposure Scandal", desc: (n: string) => `${n} is caught up in a major exposure scandal. Everyone is posting about it.` },
  { title: "Chain Snatching Retaliation", desc: (n: string) => `${n} tried to retaliate after a chain snatching. The situation escalated.` },
  { title: "Public Call-Out", desc: (n: string) => `Another major artist publicly called out ${n}. It's dominating the timeline.` },
  { title: "Diss Track Triggers Media Storm", desc: (n: string) => `A diss track aimed at ${n} is everywhere. Media outlets are covering it.` },
  { title: "Family Scandal", desc: (n: string) => `${n}'s personal life is all over the blogs after a family scandal went public.` },
  { title: "Wild Behavior on Camera", desc: (n: string) => `${n} got caught doing something wild on camera. The footage is damning.` },
  { title: "Concert Incident", desc: (n: string) => `A major incident at ${n}'s concert is making headlines. Venue might ban them.` },
  { title: "Fraud Allegations", desc: (n: string) => `${n} is facing fraud allegations from a former business partner. Bad press incoming.` },
];

const LEGAL_INCIDENT_EVENTS = [
  { title: "Gun Charge", desc: (n: string) => `${n} caught a gun charge after a traffic stop. This is serious.`, severity: 7 },
  { title: "Drug Possession", desc: (n: string) => `${n} was arrested for drug possession. Bail has been posted.`, severity: 5 },
  { title: "Assault Charge", desc: (n: string) => `${n} is facing assault charges after an altercation. Lawyers are involved.`, severity: 6 },
  { title: "Probation Violation", desc: (n: string) => `${n} violated probation. Could be heading back to court.`, severity: 7 },
  { title: "Reckless Incident", desc: (n: string) => `${n} is in legal trouble after a reckless incident. Charges pending.`, severity: 5 },
  { title: "Violent Altercation", desc: (n: string) => `${n} was arrested after a violent altercation. The video is everywhere.`, severity: 8 },
  { title: "Weapons Found During Stop", desc: (n: string) => `Police found weapons during a routine stop of ${n}'s vehicle. Charges likely.`, severity: 7 },
  { title: "Arrest After Fight", desc: (n: string) => `${n} was arrested following a physical fight. This could get ugly.`, severity: 6 },
  { title: "DUI Arrest", desc: (n: string) => `${n} got a DUI arrest. Not a great headline.`, severity: 4 },
  { title: "Domestic Incident", desc: (n: string) => `${n} is facing charges after a domestic incident. This is a heavy situation.`, severity: 8 },
];

const BEEF_STARTER_EVENTS = [
  { title: "Subliminal Shots", desc: (a: string, b: string) => `${a} dropped what sounds like subliminal shots aimed at ${b}. Fans are connecting dots.` },
  { title: "Interview Jab", desc: (a: string, b: string) => `${a} took a subtle jab at ${b} in a new interview. The clip is circulating.` },
  { title: "Social Media Shade", desc: (a: string, b: string) => `${a} posted something on socials that fans think is aimed at ${b}. The comments are wild.` },
  { title: "Sneak Diss Rumor", desc: (a: string, b: string) => `There's a rumor ${a} sneak-dissed ${b} on a new track. People are analyzing the bars.` },
  { title: "Feature Snub", desc: (a: string, b: string) => `${a} apparently turned down a feature with ${b}. Fans are calling it disrespectful.` },
];

const BEEF_OPEN_EVENTS = [
  { title: "Direct Callout", desc: (a: string, b: string) => `${a} directly called out ${b} by name. No more subliminals — this is real.` },
  { title: "Online Back-and-Forth", desc: (a: string, b: string) => `${a} and ${b} are going back and forth online. Everyone's picking sides.` },
  { title: "Live Rant", desc: (a: string, b: string) => `${a} went on a rant about ${b} on IG Live. Thousands watched it happen.` },
  { title: "Diss Record Teaser", desc: (a: string, b: string) => `${a} just teased a diss record aimed at ${b}. The anticipation is insane.` },
];

const BEEF_DISS_EVENTS = [
  { title: "Diss Track Dropped", desc: (a: string, b: string) => `${a} dropped a diss track going at ${b}. It's already trending. The bars are vicious.` },
  { title: "Response Diss", desc: (a: string, b: string) => `${a} responded to ${b} with a full diss track. The internet is scoring rounds.` },
  { title: "Media Picks Sides", desc: (a: string, b: string) => `Media outlets are breaking down the ${a} vs ${b} beef. Think pieces are flying.` },
];

const BEEF_RESOLUTION_EVENTS = [
  { title: "Beef Fades Out", desc: (a: string, b: string) => `The ${a} vs ${b} beef seems to have faded. Both sides went quiet.` },
  { title: "Clear Winner", desc: (a: string, b: string) => `The general consensus is that ${a} won the beef against ${b}. The streets have spoken.` },
  { title: "Public Reconciliation", desc: (a: string, b: string) => `${a} and ${b} were spotted together. Looks like the beef is squashed.` },
  { title: "Physical Altercation", desc: (a: string, b: string) => `The ${a} vs ${b} beef turned physical. Someone could be catching charges.` },
  { title: "Long-Term Rivalry", desc: (a: string, b: string) => `The ${a} vs ${b} situation has become a long-term rivalry. This isn't going away.` },
];

const COURT_OUTCOME_DESCRIPTIONS: Record<SentenceType, (n: string) => string> = {
  dismissed: (n) => `${n}'s case was dismissed. Lawyers earned their money today. Back to business.`,
  probation: (n) => `${n} got probation. Restrictions apply, but they're free. Could've been worse.`,
  short: (n) => `${n} got a short sentence. They're going away for a few months. The label needs to adjust.`,
  medium: (n) => `${n} received a significant sentence. They'll be away for a while. This hurts.`,
  long: (n) => `${n} got hit with a long sentence. This is a career-altering situation.`,
  life: (n) => `${n} received a life sentence. Their career is effectively over. This is devastating.`,
};

// ── Rival artist name pool for beef opponents ────────────────────────────────

const RIVAL_BEEF_NAMES = [
  "Yung Savage", "Big Draco", "Lil Venom", "King Taz", "Slick Dolo",
  "Frost Mane", "Dark Syde", "Cash Peso", "Reckless Ron", "Ghost Flair",
  "Trap Bishop", "Blaze Luciano", "Nova Flame", "Ice Picasso", "Ace Boogie",
];

// ── Core event chance calculation ────────────────────────────────────────────

interface EventChanceParams {
  controversyRisk: number;    // 0-100
  prLevel: number;            // 0-10
  hasLegalTrouble: boolean;
  jailedCount: number;        // jailed artists on this label
  rosterSize: number;
  turn: number;
  momentum?: number;
  buzz?: number;
}

function computeEventChance(base: number, params: EventChanceParams): number {
  const pr = PR_DATA[params.prLevel];

  // controversyRisk modifier: 0 at risk 0, ~2.0x at risk 100
  const riskMod = params.controversyRisk / 50;

  // PR modifier: reduces frequency
  const prMod = 1 - pr.scandalFreqReduction;

  // Roster protection: reduces catastrophic stacking for small rosters
  let rosterMod = 1.0;
  if (params.rosterSize < 3 && params.jailedCount >= 1) rosterMod = 0.1;
  else if (params.jailedCount >= 1) rosterMod = 0.4;
  else if (params.jailedCount >= 2) rosterMod = 0.2;

  // State modifier: reduce chains if already in legal trouble
  const stateMod = params.hasLegalTrouble ? 0.3 : 1.0;

  // Early game shield
  const earlyShield = params.turn <= 20 ? 0.3 : params.turn <= 40 ? 0.6 : 1.0;

  return base * riskMod * prMod * rosterMod * stateMod * earlyShield;
}

// ── PR severity reduction ────────────────────────────────────────────────────

function prDamageReduction(prLevel: number): number {
  return PR_DATA[prLevel].scandalDamageReduction;
}

// ── Count jailed artists on a label ──────────────────────────────────────────

function countJailed(artists: Artist[]): number {
  return artists.filter(a => a.jailed).length;
}

// ── Generate minor controversy ───────────────────────────────────────────────

function generateMinorControversy(
  artist: Artist,
  prLevel: number,
  turn: number,
  labelName: string,
  isRival: boolean,
  rivalLabelId?: string,
): GameEvent | null {
  const template = pick(MINOR_CONTROVERSY_EVENTS);
  const dmgReduction = prDamageReduction(prLevel);

  const buzzGain = rand(5, 12);
  const repLoss = -Math.max(1, Math.round(rand(2, 6) * (1 - dmgReduction)));
  const momDelta = rand(-3, 4);

  return {
    id: uid(),
    turn,
    type: "minor_controversy",
    title: `${artist.name}: ${template.title}`,
    description: template.desc(artist.name),
    artistId: artist.id,
    moneyDelta: -rand(200, 1500),
    reputationDelta: repLoss,
    fanbaseDelta: rand(-500, 300),
    buzzDelta: buzzGain,
    momentumDelta: momDelta,
    resolved: true,
    isRivalEvent: isRival,
    rivalLabelId,
  };
}

// ── Generate major controversy ───────────────────────────────────────────────

function generateMajorControversy(
  artist: Artist,
  prLevel: number,
  turn: number,
  labelName: string,
  isRival: boolean,
  rivalLabelId?: string,
): { event: GameEvent; escalateToLegal: boolean; escalateToBeef: boolean } {
  const template = pick(MAJOR_CONTROVERSY_EVENTS);
  const dmgReduction = prDamageReduction(prLevel);
  const popScale = 0.5 + (artist.popularity / 100) * 1.5;

  const buzzGain = rand(10, 25);
  const repLoss = -Math.max(2, Math.round(rand(8, 18) * (1 - dmgReduction) * popScale));
  const momDelta = rand(-6, 8);
  const fanDelta = rand(-2000, 1000);

  // Chance to escalate into legal or beef
  const escalateToLegal = Math.random() < 0.15 * (artist.traits.controversyRisk / 100);
  const escalateToBeef = !escalateToLegal && Math.random() < 0.20;

  return {
    event: {
      id: uid(),
      turn,
      type: "major_controversy",
      title: `${artist.name}: ${template.title}`,
      description: template.desc(artist.name),
      artistId: artist.id,
      moneyDelta: Math.round(-rand(2000, 8000) * popScale),
      reputationDelta: repLoss,
      fanbaseDelta: fanDelta,
      popularityDelta: -rand(2, 6),
      buzzDelta: buzzGain,
      momentumDelta: momDelta,
      resolved: true,
      isRivalEvent: isRival,
      rivalLabelId,
    },
    escalateToLegal,
    escalateToBeef,
  };
}

// ── Legal trouble chain ──────────────────────────────────────────────────────

function generateLegalIncident(
  artist: Artist,
  prLevel: number,
  turn: number,
  isRival: boolean,
  rivalLabelId?: string,
): { event: GameEvent; legalState: LegalState } {
  const template = pick(LEGAL_INCIDENT_EVENTS);
  const dmgReduction = prDamageReduction(prLevel);

  const buzzGain = rand(8, 18);
  const repLoss = -Math.max(3, Math.round(rand(8, 15) * (1 - dmgReduction)));
  const momDelta = -rand(4, 10);

  const legalState: LegalState = {
    stage: "incident",
    offense: template.title,
    severity: template.severity,
    turnStarted: turn,
  };

  return {
    event: {
      id: uid(),
      turn,
      type: "legal_incident",
      title: `${artist.name}: ${template.title}`,
      description: template.desc(artist.name),
      artistId: artist.id,
      moneyDelta: -rand(5000, 20000),
      reputationDelta: repLoss,
      fanbaseDelta: -rand(500, 3000),
      buzzDelta: buzzGain,
      momentumDelta: momDelta,
      resolved: true,
      isRivalEvent: isRival,
      rivalLabelId,
    },
    legalState,
  };
}

function processLegalProgression(
  artist: Artist,
  prLevel: number,
  turn: number,
  isRival: boolean,
  rivalLabelId?: string,
): { events: GameEvent[]; updatedArtist: Partial<Artist> } {
  const legal = artist.legalState;
  if (!legal) return { events: [], updatedArtist: {} };

  const events: GameEvent[] = [];
  const updates: Partial<Artist> = {};
  const dmgReduction = prDamageReduction(prLevel);
  const prMod = PR_DATA[prLevel].scandalFreqReduction;

  if (legal.stage === "incident") {
    // Progress to charges filed after 2-6 turns
    const turnsSinceIncident = turn - legal.turnStarted;
    if (turnsSinceIncident >= rand(2, 6)) {
      // PR can help get charges dropped
      const dismissChance = 0.25 + prMod * 2; // 25% base, up to ~79% at max PR
      if (Math.random() < dismissChance) {
        // Charges dropped
        events.push({
          id: uid(), turn, type: "legal_incident",
          title: `${artist.name}: Charges Dropped`,
          description: `${artist.name}'s legal situation has been resolved. Charges were dropped.`,
          artistId: artist.id,
          moneyDelta: -rand(5000, 15000), // legal fees
          reputationDelta: rand(1, 3),
          fanbaseDelta: 0,
          buzzDelta: rand(2, 8),
          momentumDelta: rand(1, 5),
          resolved: true,
          isRivalEvent: isRival,
          rivalLabelId,
        });
        updates.legalState = undefined;
      } else {
        // Charges filed
        events.push({
          id: uid(), turn, type: "charges_filed",
          title: `${artist.name}: Charges Filed`,
          description: `Formal charges have been filed against ${artist.name} for ${legal.offense.toLowerCase()}. Court date pending.`,
          artistId: artist.id,
          moneyDelta: -rand(10000, 30000),
          reputationDelta: -Math.max(2, Math.round(rand(6, 12) * (1 - dmgReduction))),
          fanbaseDelta: -rand(1000, 5000),
          buzzDelta: rand(10, 20),
          momentumDelta: -rand(3, 8),
          resolved: true,
          isRivalEvent: isRival,
          rivalLabelId,
        });
        updates.legalState = {
          ...legal,
          stage: "charges_filed",
          turnChargesFiled: turn,
        };
      }
    }
  } else if (legal.stage === "charges_filed") {
    // Progress to court case after 4-12 turns
    const turnsSinceCharges = turn - (legal.turnChargesFiled ?? turn);
    if (turnsSinceCharges >= rand(4, 12)) {
      // Court case - determine outcome
      const outcome = determineCourtOutcome(artist, legal, prLevel);

      events.push({
        id: uid(), turn, type: "court_case",
        title: `${artist.name}: Court Verdict — ${outcome.sentence === "dismissed" ? "Dismissed" : outcome.sentence === "probation" ? "Probation" : "Sentenced"}`,
        description: COURT_OUTCOME_DESCRIPTIONS[outcome.sentence](artist.name),
        artistId: artist.id,
        moneyDelta: -rand(15000, 50000), // legal costs
        reputationDelta: outcome.sentence === "dismissed" ? rand(1, 4) : -Math.max(3, Math.round(rand(5, 15) * (1 - dmgReduction))),
        fanbaseDelta: outcome.sentence === "dismissed" ? rand(0, 2000) : -rand(2000, 10000),
        buzzDelta: rand(10, 25),
        momentumDelta: outcome.sentence === "dismissed" ? rand(3, 10) : -rand(5, 15),
        resolved: true,
        isRivalEvent: isRival,
        rivalLabelId,
      });

      if (outcome.sentence === "dismissed" || outcome.sentence === "probation") {
        updates.legalState = undefined;
        if (outcome.sentence === "probation") {
          updates.legalHistory = (artist.legalHistory ?? 0) + 1;
        }
      } else {
        // Jail sentence
        updates.legalState = {
          ...legal,
          stage: "resolved",
          turnCourtCase: turn,
          sentence: outcome.sentence,
          sentenceTurns: outcome.turns,
        };
        updates.jailed = true;
        updates.jailTurnsLeft = outcome.turns;
        updates.jailSentenceType = outcome.sentence;
        updates.legalHistory = (artist.legalHistory ?? 0) + 1;

        // Cancel tour if on tour
        if (artist.onTour) {
          updates.onTour = false;
          updates.tourTurnsLeft = 0;
          updates.tourType = null;
        }

        if (outcome.sentence === "life") {
          events.push({
            id: uid(), turn, type: "jail_sentence",
            title: `${artist.name}: Career Over`,
            description: `${artist.name} has been sentenced to life. Their career in music is effectively over.`,
            artistId: artist.id,
            moneyDelta: 0,
            reputationDelta: -rand(5, 15),
            fanbaseDelta: -rand(5000, 20000),
            buzzDelta: rand(15, 30),
            momentumDelta: -30,
            resolved: true,
            isRivalEvent: isRival,
            rivalLabelId,
          });
        } else {
          const sentenceLabel = outcome.sentence === "short" ? "a short sentence"
            : outcome.sentence === "medium" ? "a significant sentence"
            : "a long sentence";
          events.push({
            id: uid(), turn, type: "jail_sentence",
            title: `${artist.name}: Sentenced to ${outcome.turns} Weeks`,
            description: `${artist.name} received ${sentenceLabel} of ${outcome.turns} weeks. The label must adapt.`,
            artistId: artist.id,
            moneyDelta: 0,
            reputationDelta: -rand(3, 8),
            fanbaseDelta: -rand(1000, 5000),
            buzzDelta: rand(8, 20),
            momentumDelta: -rand(8, 20),
            resolved: true,
            isRivalEvent: isRival,
            rivalLabelId,
          });
        }
      }
    }
  }

  return { events, updatedArtist: updates };
}

function determineCourtOutcome(
  artist: Artist,
  legal: LegalState,
  prLevel: number,
): { sentence: SentenceType; turns: number } {
  const prMod = PR_DATA[prLevel].scandalFreqReduction;
  const risk = artist.traits.controversyRisk / 100;
  const severity = legal.severity / 10;
  const history = (artist.legalHistory ?? 0);

  // Base weights — PR shifts probability toward lighter outcomes
  let dismissWeight = 0.20 + prMod * 1.5 - severity * 0.1 - history * 0.05;
  let probationWeight = 0.30 + prMod * 0.8 - severity * 0.05;
  let shortWeight = 0.25 - prMod * 0.3;
  let mediumWeight = 0.15 + severity * 0.1 + risk * 0.1 + history * 0.05;
  let longWeight = 0.08 + severity * 0.08 + risk * 0.05 + history * 0.03;
  let lifeWeight = 0.02 * severity * risk + history * 0.005;

  // Clamp all weights
  dismissWeight = Math.max(0.05, dismissWeight);
  probationWeight = Math.max(0.05, probationWeight);
  shortWeight = Math.max(0.05, shortWeight);
  mediumWeight = Math.max(0.02, mediumWeight);
  longWeight = Math.max(0.01, longWeight);
  lifeWeight = Math.max(0, Math.min(0.03, lifeWeight)); // cap life at 3%

  const total = dismissWeight + probationWeight + shortWeight + mediumWeight + longWeight + lifeWeight;
  const roll = Math.random() * total;

  let cumulative = 0;
  cumulative += dismissWeight;
  if (roll < cumulative) return { sentence: "dismissed", turns: 0 };
  cumulative += probationWeight;
  if (roll < cumulative) return { sentence: "probation", turns: 0 };
  cumulative += shortWeight;
  if (roll < cumulative) return { sentence: "short", turns: rand(4, 12) };
  cumulative += mediumWeight;
  if (roll < cumulative) return { sentence: "medium", turns: rand(20, 52) };
  cumulative += longWeight;
  if (roll < cumulative) return { sentence: "long", turns: rand(80, 156) };

  return { sentence: "life", turns: 9999 };
}

// ── Jail state processing ────────────────────────────────────────────────────

function processJailState(
  artist: Artist,
  turn: number,
  isRival: boolean,
  rivalLabelId?: string,
): { events: GameEvent[]; updatedArtist: Partial<Artist> } {
  if (!artist.jailed || !artist.jailTurnsLeft) return { events: [], updatedArtist: {} };

  const events: GameEvent[] = [];
  const updates: Partial<Artist> = {};

  const turnsLeft = artist.jailTurnsLeft - 1;

  if (turnsLeft <= 0 && artist.jailSentenceType !== "life") {
    // Release from jail — "First Day Out" moment
    events.push({
      id: uid(), turn, type: "release_from_jail",
      title: `${artist.name}: First Day Out!`,
      description: `${artist.name} is free! The streets are buzzing. Expect a major comeback moment.`,
      artistId: artist.id,
      moneyDelta: 0,
      reputationDelta: rand(1, 5),
      fanbaseDelta: rand(2000, 10000),
      buzzDelta: rand(15, 25),
      momentumDelta: rand(10, 20),
      resolved: true,
      isRivalEvent: isRival,
      rivalLabelId,
    });

    updates.jailed = false;
    updates.jailTurnsLeft = 0;
    updates.jailSentenceType = undefined;
    updates.legalState = undefined;
    updates.releaseFromJailTurn = turn;
    updates.comebackBonusTurns = rand(4, 8); // 4-8 turns of comeback bonus
  } else {
    updates.jailTurnsLeft = turnsLeft;
  }

  return { events, updatedArtist: updates };
}

// ── Beef system ──────────────────────────────────────────────────────────────

function findBeefOpponent(
  artist: Artist,
  allArtists: Artist[],
  rivalLabels: RivalLabel[],
): { name: string; id?: string; labelName: string } {
  // Try to find a real artist to beef with (prefer rival artists)
  const rivalArtists = rivalLabels.flatMap(l =>
    l.rosterArtists
      .filter(a => !a.jailed && a.id !== artist.id && a.momentum > 15)
      .map(a => ({ artist: a, labelName: l.name }))
  );

  // Also consider other signed player artists
  const otherSigned = allArtists
    .filter(a => a.signed && !a.jailed && a.id !== artist.id && a.momentum > 15)
    .map(a => ({ artist: a, labelName: "your label" }));

  const candidates = [...rivalArtists, ...otherSigned];

  if (candidates.length > 0 && Math.random() < 0.6) {
    const target = pick(candidates);
    return { name: target.artist.name, id: target.artist.id, labelName: target.labelName };
  }

  // Fallback: fictional opponent
  return { name: pick(RIVAL_BEEF_NAMES), labelName: pick(rivalLabels).name };
}

function generateBeefStart(
  artist: Artist,
  opponent: { name: string; id?: string; labelName: string },
  turn: number,
  isRival: boolean,
  rivalLabelId?: string,
): { event: GameEvent; beefState: BeefState; beefRecord: ActiveBeefRecord } {
  const template = pick(BEEF_STARTER_EVENTS);

  const beefState: BeefState = {
    stage: "tension",
    opponentName: opponent.name,
    opponentId: opponent.id,
    opponentLabelName: opponent.labelName,
    turnStarted: turn,
    dissTrackCount: 0,
    turnsAtStage: 0,
  };

  const beefRecord: ActiveBeefRecord = {
    id: uid(),
    artist1Name: artist.name,
    artist1Id: artist.id,
    artist1LabelName: isRival ? (rivalLabelId ?? "") : "player",
    artist2Name: opponent.name,
    artist2Id: opponent.id,
    artist2LabelName: opponent.labelName,
    stage: "tension",
    turnStarted: turn,
    dissTrackCount: 0,
    turnsAtStage: 0,
  };

  return {
    event: {
      id: uid(), turn, type: "beef_tension",
      title: `${artist.name} vs ${opponent.name}: ${template.title}`,
      description: template.desc(artist.name, opponent.name),
      artistId: artist.id,
      moneyDelta: 0,
      reputationDelta: 0,
      fanbaseDelta: 0,
      buzzDelta: rand(4, 10),
      momentumDelta: rand(2, 5),
      resolved: true,
      isRivalEvent: isRival,
      rivalLabelId,
    },
    beefState,
    beefRecord,
  };
}

function processBeefProgression(
  artist: Artist,
  turn: number,
  isRival: boolean,
  rivalLabelId?: string,
): { events: GameEvent[]; updatedBeef: BeefState | undefined; updatedRecord: Partial<ActiveBeefRecord> } {
  const beef = artist.activeBeef;
  if (!beef) return { events: [], updatedBeef: undefined, updatedRecord: {} };

  const events: GameEvent[] = [];
  const turnsAtStage = beef.turnsAtStage + 1;
  let stage = beef.stage;
  let dissCount = beef.dissTrackCount;
  let winning = beef.playerIsWinning;

  // Determine if stage progresses
  if (stage === "tension" && turnsAtStage >= rand(2, 5)) {
    // Escalate to open beef or fizzle out
    if (Math.random() < 0.55) {
      stage = "open";
      const template = pick(BEEF_OPEN_EVENTS);
      events.push({
        id: uid(), turn, type: "beef_open",
        title: `${artist.name} vs ${beef.opponentName}: ${template.title}`,
        description: template.desc(artist.name, beef.opponentName),
        artistId: artist.id,
        moneyDelta: 0,
        reputationDelta: rand(-3, 0),
        fanbaseDelta: rand(0, 2000),
        buzzDelta: rand(10, 20),
        momentumDelta: rand(-2, 8),
        resolved: true,
        isRivalEvent: isRival,
        rivalLabelId,
      });
    } else {
      // Beef fizzles
      const template = BEEF_RESOLUTION_EVENTS[0]; // "Beef Fades Out"
      events.push({
        id: uid(), turn, type: "beef_resolution",
        title: `${artist.name} vs ${beef.opponentName}: ${template.title}`,
        description: template.desc(artist.name, beef.opponentName),
        artistId: artist.id,
        moneyDelta: 0,
        reputationDelta: 0,
        fanbaseDelta: 0,
        buzzDelta: -rand(2, 5),
        momentumDelta: -rand(1, 3),
        resolved: true,
        isRivalEvent: isRival,
        rivalLabelId,
      });
      return { events, updatedBeef: undefined, updatedRecord: { stage: "tension" } };
    }
  } else if (stage === "open" && turnsAtStage >= rand(2, 4)) {
    // Escalate to diss tracks or resolve
    if (Math.random() < 0.60) {
      stage = "diss_track";
      dissCount += 1;
      winning = Math.random() < 0.5; // who appears winning
      const template = pick(BEEF_DISS_EVENTS);
      events.push({
        id: uid(), turn, type: "beef_diss_track",
        title: `${artist.name} vs ${beef.opponentName}: ${template.title}`,
        description: template.desc(winning ? artist.name : beef.opponentName, winning ? beef.opponentName : artist.name),
        artistId: artist.id,
        moneyDelta: 0,
        reputationDelta: winning ? rand(0, 3) : -rand(2, 6),
        fanbaseDelta: rand(1000, 8000),
        buzzDelta: rand(12, 25),
        momentumDelta: winning ? rand(5, 12) : rand(-4, 4),
        resolved: true,
        isRivalEvent: isRival,
        rivalLabelId,
      });
    } else {
      // Resolve
      return resolveBeef(artist, beef, turn, isRival, rivalLabelId);
    }
  } else if (stage === "diss_track" && turnsAtStage >= rand(2, 5)) {
    // Continue diss exchange, escalate, or resolve
    if (dissCount < 4 && Math.random() < 0.40) {
      // Another diss track
      dissCount += 1;
      winning = Math.random() < 0.5;
      // Diminishing returns on repeated disses
      const buzzBonus = Math.max(3, rand(8, 18) - dissCount * 3);
      const template = pick(BEEF_DISS_EVENTS);
      events.push({
        id: uid(), turn, type: "beef_diss_track",
        title: `${artist.name} vs ${beef.opponentName}: ${template.title}`,
        description: template.desc(winning ? artist.name : beef.opponentName, winning ? beef.opponentName : artist.name),
        artistId: artist.id,
        moneyDelta: 0,
        reputationDelta: dissCount > 3 ? -rand(1, 4) : (winning ? rand(0, 2) : -rand(1, 4)),
        fanbaseDelta: rand(500, 4000),
        buzzDelta: buzzBonus,
        momentumDelta: winning ? rand(2, 8) : rand(-3, 3),
        resolved: true,
        isRivalEvent: isRival,
        rivalLabelId,
      });
    } else {
      // Resolve or escalate to physical
      return resolveBeef(artist, beef, turn, isRival, rivalLabelId);
    }
  }

  const updatedBeef: BeefState = {
    ...beef,
    stage,
    dissTrackCount: dissCount,
    playerIsWinning: winning,
    turnsAtStage: stage !== beef.stage ? 0 : turnsAtStage,
  };

  return {
    events,
    updatedBeef,
    updatedRecord: { stage, dissTrackCount: dissCount, turnsAtStage: updatedBeef.turnsAtStage },
  };
}

function resolveBeef(
  artist: Artist,
  beef: BeefState,
  turn: number,
  isRival: boolean,
  rivalLabelId?: string,
): { events: GameEvent[]; updatedBeef: undefined; updatedRecord: Partial<ActiveBeefRecord> } {
  const events: GameEvent[] = [];

  // Determine resolution type
  const roll = Math.random();
  let template;
  let legalEscalation = false;

  if (roll < 0.30) {
    // Clear winner
    const artistWins = Math.random() < 0.5;
    template = BEEF_RESOLUTION_EVENTS[1]; // "Clear Winner"
    const winner = artistWins ? artist.name : beef.opponentName;
    const loser = artistWins ? beef.opponentName : artist.name;
    events.push({
      id: uid(), turn, type: "beef_resolution",
      title: `${artist.name} vs ${beef.opponentName}: ${template.title}`,
      description: template.desc(winner, loser),
      artistId: artist.id,
      moneyDelta: 0,
      reputationDelta: artistWins ? rand(2, 6) : -rand(3, 8),
      fanbaseDelta: artistWins ? rand(3000, 10000) : -rand(1000, 5000),
      buzzDelta: rand(5, 15),
      momentumDelta: artistWins ? rand(5, 15) : -rand(5, 12),
      resolved: true,
      isRivalEvent: isRival,
      rivalLabelId,
    });
  } else if (roll < 0.50) {
    // Reconciliation
    template = BEEF_RESOLUTION_EVENTS[2]; // "Public Reconciliation"
    events.push({
      id: uid(), turn, type: "beef_resolution",
      title: `${artist.name} vs ${beef.opponentName}: ${template.title}`,
      description: template.desc(artist.name, beef.opponentName),
      artistId: artist.id,
      moneyDelta: 0,
      reputationDelta: rand(1, 4),
      fanbaseDelta: rand(500, 3000),
      buzzDelta: rand(3, 10),
      momentumDelta: rand(1, 5),
      resolved: true,
      isRivalEvent: isRival,
      rivalLabelId,
    });
  } else if (roll < 0.70) {
    // Fades out
    template = BEEF_RESOLUTION_EVENTS[0]; // "Beef Fades Out"
    events.push({
      id: uid(), turn, type: "beef_resolution",
      title: `${artist.name} vs ${beef.opponentName}: ${template.title}`,
      description: template.desc(artist.name, beef.opponentName),
      artistId: artist.id,
      moneyDelta: 0,
      reputationDelta: 0,
      fanbaseDelta: 0,
      buzzDelta: -rand(2, 6),
      momentumDelta: -rand(1, 4),
      resolved: true,
      isRivalEvent: isRival,
      rivalLabelId,
    });
  } else if (roll < 0.85) {
    // Physical altercation — possible legal escalation
    template = BEEF_RESOLUTION_EVENTS[3]; // "Physical Altercation"
    legalEscalation = Math.random() < 0.40;
    events.push({
      id: uid(), turn, type: "beef_resolution",
      title: `${artist.name} vs ${beef.opponentName}: ${template.title}`,
      description: template.desc(artist.name, beef.opponentName) + (legalEscalation ? " Charges may follow." : ""),
      artistId: artist.id,
      moneyDelta: -rand(5000, 15000),
      reputationDelta: -rand(5, 12),
      fanbaseDelta: rand(-3000, 5000),
      buzzDelta: rand(10, 25),
      momentumDelta: rand(-5, 5),
      resolved: true,
      isRivalEvent: isRival,
      rivalLabelId,
    });
  } else {
    // Long-term rivalry (just ends the active beef but could restart)
    template = BEEF_RESOLUTION_EVENTS[4]; // "Long-Term Rivalry"
    events.push({
      id: uid(), turn, type: "beef_resolution",
      title: `${artist.name} vs ${beef.opponentName}: ${template.title}`,
      description: template.desc(artist.name, beef.opponentName),
      artistId: artist.id,
      moneyDelta: 0,
      reputationDelta: 0,
      fanbaseDelta: rand(1000, 5000),
      buzzDelta: rand(3, 8),
      momentumDelta: rand(1, 5),
      resolved: true,
      isRivalEvent: isRival,
      rivalLabelId,
    });
  }

  return {
    events,
    updatedBeef: undefined,
    updatedRecord: {},
  };
}

// ── Main event engine: processes one artist ──────────────────────────────────

interface ArtistEventResult {
  events: GameEvent[];
  artistUpdates: Partial<Artist>;
  newBeefRecords: ActiveBeefRecord[];
}

function processArtistEvents(
  artist: Artist,
  state: GameState,
  prLevel: number,
  labelName: string,
  allSignedArtists: Artist[],
  isRival: boolean,
  rivalLabelId?: string,
): ArtistEventResult {
  const events: GameEvent[] = [];
  const updates: Partial<Artist> = {};
  const newBeefRecords: ActiveBeefRecord[] = [];

  // Skip jailed artists for new events (but still process jail countdown)
  if (artist.jailed) {
    const jailResult = processJailState(artist, state.turn, isRival, rivalLabelId);
    events.push(...jailResult.events);
    Object.assign(updates, jailResult.updatedArtist);
    return { events, artistUpdates: updates, newBeefRecords };
  }

  const jailedCount = countJailed(allSignedArtists);
  const rosterSize = allSignedArtists.filter(a => !a.jailed).length;

  const chanceParams: EventChanceParams = {
    controversyRisk: artist.traits.controversyRisk,
    prLevel,
    hasLegalTrouble: !!artist.legalState,
    jailedCount,
    rosterSize,
    turn: state.turn,
    momentum: artist.momentum,
    buzz: artist.buzz,
  };

  // ── Process existing legal chain ────────────────────────────────────────
  if (artist.legalState) {
    const legalResult = processLegalProgression(artist, prLevel, state.turn, isRival, rivalLabelId);
    events.push(...legalResult.events);
    Object.assign(updates, legalResult.updatedArtist);
  }

  // ── Process existing beef ───────────────────────────────────────────────
  if (artist.activeBeef) {
    const beefResult = processBeefProgression(artist, state.turn, isRival, rivalLabelId);
    events.push(...beefResult.events);
    if (beefResult.updatedBeef !== undefined) {
      updates.activeBeef = beefResult.updatedBeef;
    } else if (beefResult.events.length > 0) {
      updates.activeBeef = undefined; // beef resolved
    }
  }

  // ── Roll for new events ─────────────────────────────────────────────────

  // MINOR CONTROVERSY: ~6% base per turn (annualized ~5-8% with weekly turns / 52 per year)
  // Per-turn rate: 6% / 52 ≈ 0.115% base, but controversyRisk scales it up significantly
  const minorChance = computeEventChance(0.12, chanceParams);
  if (Math.random() < minorChance && !artist.legalState) {
    const event = generateMinorControversy(artist, prLevel, state.turn, labelName, isRival, rivalLabelId);
    if (event) {
      events.push(event);
      updates.yearlyControversies = (artist.yearlyControversies ?? 0) + 1;
    }
  }

  // MAJOR CONTROVERSY: ~2.5% base annually → ~0.048% per turn base
  const majorChance = computeEventChance(0.05, chanceParams);
  if (Math.random() < majorChance && !artist.legalState) {
    const result = generateMajorControversy(artist, prLevel, state.turn, labelName, isRival, rivalLabelId);
    events.push(result.event);
    updates.yearlyControversies = (artist.yearlyControversies ?? 0) + 1;

    // Possible escalation to legal
    if (result.escalateToLegal && !artist.legalState && !updates.legalState) {
      const legalResult = generateLegalIncident(artist, prLevel, state.turn, isRival, rivalLabelId);
      events.push(legalResult.event);
      updates.legalState = legalResult.legalState;
    }

    // Possible escalation to beef
    if (result.escalateToBeef && !artist.activeBeef && !updates.activeBeef) {
      const opponent = findBeefOpponent(artist, state.artists, state.rivalLabels);
      const beefResult = generateBeefStart(artist, opponent, state.turn, isRival, rivalLabelId);
      events.push(beefResult.event);
      updates.activeBeef = beefResult.beefState;
      newBeefRecords.push(beefResult.beefRecord);
    }
  }

  // LEGAL TROUBLE: ~0.75% base annually → ~0.014% per turn base
  const legalChance = computeEventChance(0.015, chanceParams);
  if (Math.random() < legalChance && !artist.legalState && !updates.legalState) {
    const legalResult = generateLegalIncident(artist, prLevel, state.turn, isRival, rivalLabelId);
    events.push(legalResult.event);
    updates.legalState = legalResult.legalState;
    updates.yearlyControversies = (updates.yearlyControversies ?? artist.yearlyControversies ?? 0) + 1;
  }

  // BEEF START: ~3% base annually → ~0.058% per turn base
  const beefChance = computeEventChance(0.06, chanceParams);
  if (Math.random() < beefChance && !artist.activeBeef && !updates.activeBeef) {
    const opponent = findBeefOpponent(artist, state.artists, state.rivalLabels);
    const beefResult = generateBeefStart(artist, opponent, state.turn, isRival, rivalLabelId);
    events.push(beefResult.event);
    updates.activeBeef = beefResult.beefState;
    newBeefRecords.push(beefResult.beefRecord);
  }

  return { events, artistUpdates: updates, newBeefRecords };
}

// ── Public API: process all hip-hop events for a turn ────────────────────────

export interface HipHopEventResult {
  events: GameEvent[];
  updatedArtists: Artist[];
  updatedRivalLabels: RivalLabel[];
  activeBeefs: ActiveBeefRecord[];
}

export function processHipHopEvents(state: GameState): HipHopEventResult {
  const allEvents: GameEvent[] = [];
  let activeBeefs = [...(state.activeBeefs ?? [])];
  const newBeefRecords: ActiveBeefRecord[] = [];

  // ── Process player artists ──────────────────────────────────────────────
  const signedArtists = state.artists.filter(a => a.signed);
  const updatedArtists = state.artists.map(artist => {
    if (!artist.signed) return artist;

    const result = processArtistEvents(
      artist, state, state.prLevel, state.labelName,
      signedArtists, false,
    );

    allEvents.push(...result.events);
    newBeefRecords.push(...result.newBeefRecords);

    // Apply comeback bonus decay
    let comebackBonusTurns = artist.comebackBonusTurns;
    if (comebackBonusTurns && comebackBonusTurns > 0) {
      comebackBonusTurns -= 1;
      if (comebackBonusTurns <= 0) comebackBonusTurns = undefined;
    }

    return {
      ...artist,
      ...result.artistUpdates,
      comebackBonusTurns: result.artistUpdates.comebackBonusTurns ?? comebackBonusTurns,
    };
  });

  // ── Process rival artists ───────────────────────────────────────────────
  const updatedRivalLabels = state.rivalLabels.map(label => {
    // Derive rival PR level from prestige (prestige 50 → PR ~3, prestige 80 → PR ~6)
    const rivalPR = label.prLevel ?? Math.min(10, Math.floor(label.prestige / 12));

    const updatedRoster = label.rosterArtists.map(artist => {
      const result = processArtistEvents(
        artist, state, rivalPR, label.name,
        label.rosterArtists, true, label.id,
      );

      allEvents.push(...result.events);
      newBeefRecords.push(...result.newBeefRecords);

      let comebackBonusTurns = artist.comebackBonusTurns;
      if (comebackBonusTurns && comebackBonusTurns > 0) {
        comebackBonusTurns -= 1;
        if (comebackBonusTurns <= 0) comebackBonusTurns = undefined;
      }

      return {
        ...artist,
        ...result.artistUpdates,
        comebackBonusTurns: result.artistUpdates.comebackBonusTurns ?? comebackBonusTurns,
      };
    });

    return {
      ...label,
      prLevel: rivalPR,
      rosterArtists: updatedRoster,
    };
  });

  // ── Update active beefs tracker ─────────────────────────────────────────
  // Remove resolved beefs, add new ones, age existing ones
  const allArtists = [...updatedArtists, ...updatedRivalLabels.flatMap(l => l.rosterArtists)];
  const artistsWithBeef = new Set(
    allArtists.filter(a => a.activeBeef).map(a => a.id)
  );

  // Keep beefs where at least one side still has active beef
  activeBeefs = activeBeefs
    .filter(b => artistsWithBeef.has(b.artist1Id ?? "") || artistsWithBeef.has(b.artist2Id ?? ""))
    .map(b => ({ ...b, turnsAtStage: b.turnsAtStage + 1 }));

  // Add new beefs
  activeBeefs.push(...newBeefRecords);

  return {
    events: allEvents,
    updatedArtists,
    updatedRivalLabels,
    activeBeefs,
  };
}

// ── Jail state helpers (for use in engine.ts tour/record checks) ─────────────

export function isArtistAvailable(artist: Artist): boolean {
  return !artist.jailed && artist.signed;
}

export function getJailStatus(artist: Artist): string | null {
  if (!artist.jailed) return null;
  if (artist.jailSentenceType === "life") return "Life sentence";
  const turns = artist.jailTurnsLeft ?? 0;
  if (turns <= 4) return `Releasing soon (${turns} weeks)`;
  if (turns <= 12) return `Short sentence (${turns} weeks left)`;
  if (turns <= 52) return `Sentenced (${turns} weeks left)`;
  return `Long sentence (${turns} weeks left)`;
}

// ── Comeback bonus for songs released after jail ─────────────────────────────

export function getComebackViralBonus(artist: Artist): number {
  if (!artist.comebackBonusTurns || artist.comebackBonusTurns <= 0) return 0;
  // Decaying bonus: stronger immediately after release
  return Math.round(10 + artist.comebackBonusTurns * 3);
}

// ── Apply buzz/momentum from hip-hop events to artist ────────────────────────

export function applyHipHopEventEffects(artist: Artist, events: GameEvent[]): Artist {
  let a = { ...artist };
  for (const ev of events) {
    if (ev.artistId !== artist.id) continue;
    if (ev.buzzDelta) a.buzz = clamp((a.buzz ?? 30) + ev.buzzDelta, 0, 100);
    if (ev.momentumDelta) a.momentum = clamp((a.momentum ?? 50) + ev.momentumDelta, 0, 100);
    if (ev.popularityDelta) a.popularity = clamp(a.popularity + ev.popularityDelta, 0, 100);
    a.fanbase = Math.max(0, a.fanbase + ev.fanbaseDelta);

    // Track controversies
    if (["minor_controversy", "major_controversy", "legal_incident"].includes(ev.type)) {
      a.yearlyControversies = (a.yearlyControversies ?? 0) + 1;
    }
  }
  return a;
}

// ── Jail decay: momentum/buzz/fanbase decay while jailed ─────────────────────

export function applyJailDecay(artist: Artist): Artist {
  if (!artist.jailed) return artist;
  return {
    ...artist,
    momentum: Math.max(0, Math.round((artist.momentum ?? 50) * 0.97)), // 3% decay per turn
    buzz: Math.max(0, Math.round((artist.buzz ?? 30) * 0.98)),         // 2% decay per turn
    fanbase: Math.max(0, Math.round(artist.fanbase * 0.998)),           // 0.2% decay per turn (fans are loyal)
  };
}
