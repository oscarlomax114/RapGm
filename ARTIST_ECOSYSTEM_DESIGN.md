# Artist Ecosystem Redesign — Full Design Proposal

## Overview

This document proposes a complete rework of the artist generation, career lifecycle, and market dynamics systems. The goal: simulate the volatility of real hip-hop careers where most artists flame out, some break through, fewer sustain relevance, and only a tiny handful become decade-long superstars.

---

## 1. NEW ARTIST PROPERTIES

### Added Fields to Artist Interface

```ts
interface Artist {
  // ... existing fields ...

  // NEW: Career phase system
  careerPhase: "prospect" | "emerging" | "established" | "veteran" | "declining";

  // NEW: Momentum (0–100) — primary driver of career survival
  momentum: number;

  // NEW: Buzz/exposure (0–100) — market-facing visibility
  buzz: number;

  // NEW: Career durability archetype
  durability: "flash" | "solid" | "durable";

  // NEW: Career history tracking
  peakMomentum: number;       // highest momentum ever reached
  turnsAtLowMomentum: number; // consecutive turns with momentum < 25
  totalSinglesReleased: number;
  totalAlbumsReleased: number;
  chartHits: number;          // times charted in top 10
  flops: number;              // released songs that never charted
  careerStartTurn: number;    // turn when first signed or entered pool
}
```

### Durability Archetype Distribution

| Archetype | Frequency | Momentum Decay/Turn | Flop Recovery | Hit Momentum Gain | Career Length |
|-----------|-----------|---------------------|---------------|-------------------|---------------|
| Flash     | 45%       | -2.0/turn idle      | Slow (-15 per flop) | +25-35 per hit | 1-3 years typical |
| Solid     | 40%       | -1.0/turn idle      | Moderate (-8 per flop) | +15-22 per hit | 3-7 years typical |
| Durable   | 15%       | -0.5/turn idle      | Good (-4 per flop) | +10-18 per hit | 5-15 years typical |

### Visibility to Player

| Property | Visibility |
|----------|-----------|
| careerPhase | Always visible |
| momentum | Visible if scouted OR signed |
| buzz | Always visible (public-facing) |
| durability | Hidden. Partially inferred from behavior over time. Scouting level 8+ reveals a hint ("volatile career type", "stable career type", "marathon career type") |
| peakMomentum | Visible if signed |
| turnsAtLowMomentum | Hidden |
| chartHits / flops | Visible (public record) |

---

## 2. AGE DISTRIBUTION REWORK

### Free Agent Age Generation

Replace flat `Math.floor(Math.random() * 15) + 18` with weighted sampling:

```ts
function generateFreeAgentAge(): number {
  const roll = Math.random() * 100;
  if (roll < 35)       return 18 + Math.floor(Math.random() * 3);   // 18-20: 35%
  else if (roll < 60)  return 21 + Math.floor(Math.random() * 3);   // 21-23: 25%
  else if (roll < 78)  return 24 + Math.floor(Math.random() * 3);   // 24-26: 18%
  else if (roll < 90)  return 27 + Math.floor(Math.random() * 3);   // 27-29: 12%
  else if (roll < 97)  return 30 + Math.floor(Math.random() * 3);   // 30-32: 7%
  else                 return 33 + Math.floor(Math.random() * 5);   // 33-37: 3%
}
```

**Result for 400 free agents:**
- ~140 are 18-20
- ~100 are 21-23
- ~72 are 24-26
- ~48 are 27-29
- ~28 are 30-32
- ~12 are 33+

### Signed Starter Age

Keep starters at 18-21 (player starts with young prospects to develop).

---

## 3. OVERALL RATING DISTRIBUTION REWORK

### Global OVR Generation

Replace the current split (young vs older) with a single unified curve that uses age as a modifier, not a fork.

```ts
function generateBaseOVR(): number {
  // Weighted draw from a right-skewed distribution
  // Most artists are mediocre; stars are rare
  const roll = Math.random() * 100;

  if (roll < 30)       return randInt(25, 39);   // 30% raw/amateur
  else if (roll < 60)  return randInt(40, 54);   // 30% local talent
  else if (roll < 82)  return randInt(55, 69);   // 22% underground/fringe pro
  else if (roll < 93)  return randInt(70, 79);   // 11% label-worthy
  else if (roll < 98)  return randInt(80, 89);   // 5%  star-level
  else if (roll < 99.6) return randInt(90, 94);  // 1.6% superstar
  else                 return randInt(95, 99);   // 0.4% generational
}
```

**Expected counts in 400 free agents:**
- 25-39: ~120
- 40-54: ~120
- 55-69: ~88
- 70-79: ~44
- 80-89: ~20
- 90-94: ~6
- 95+: ~1-2

### Age Modifiers on OVR

The base OVR represents *potential talent ceiling*. Current OVR depends on age and career development:

```ts
function applyAgeModifier(baseOVR: number, age: number, durability: string): number {
  // Young artists haven't reached their ceiling yet
  if (age <= 20) {
    // Current = 40-65% of ceiling. Huge growth room.
    const developmentPct = 0.40 + Math.random() * 0.25;
    return Math.max(25, Math.floor(baseOVR * developmentPct));
  }
  else if (age <= 23) {
    // Current = 55-80% of ceiling. Still developing.
    const developmentPct = 0.55 + Math.random() * 0.25;
    return Math.max(25, Math.floor(baseOVR * developmentPct));
  }
  else if (age <= 26) {
    // Current = 70-95% of ceiling. Approaching prime.
    const developmentPct = 0.70 + Math.random() * 0.25;
    return Math.floor(baseOVR * developmentPct);
  }
  else if (age <= 30) {
    // Current = 80-100% of ceiling. In or near prime.
    const developmentPct = 0.80 + Math.random() * 0.20;
    return Math.floor(baseOVR * developmentPct);
  }
  else {
    // 31+: at ceiling but may have started declining
    // Durable artists hold; flash artists may already be fading
    const declineYears = age - 30;
    const declineRate = durability === "flash" ? 0.04
                      : durability === "solid" ? 0.02
                      : 0.01; // durable
    const declinePct = Math.max(0.5, 1.0 - declineYears * declineRate);
    return Math.floor(baseOVR * declinePct * (0.95 + Math.random() * 0.05));
  }
}
```

**Example outputs:**
- 19-year-old with baseOVR 85 → current OVR ~34-54 (raw phenom, huge upside)
- 22-year-old with baseOVR 65 → current OVR ~36-52 (developing mid-tier)
- 26-year-old with baseOVR 75 → current OVR ~53-71 (approaching prime)
- 30-year-old with baseOVR 90 → current OVR ~72-90 (peak star)
- 34-year-old flash with baseOVR 80 → current OVR ~54-67 (fading fast)
- 34-year-old durable with baseOVR 80 → current OVR ~69-77 (still solid)

### Potential Rework

Potential should derive from `baseOVR` (the ceiling) rather than current OVR:

```ts
function computePotential(baseOVR: number, currentOVR: number, age: number): number {
  // Potential = how high they can realistically develop
  // Young artists: potential ≈ baseOVR (they can reach their ceiling)
  // Older artists: potential ≈ currentOVR (growth window closed)
  const ageGrowthFactor = Math.max(0, (28 - age) / 10); // 1.0 at 18, 0 at 28, negative after
  const potential = currentOVR + ageGrowthFactor * (baseOVR - currentOVR) * 0.8;
  return Math.min(99, Math.round(potential));
}
```

---

## 4. CAREER PHASE SYSTEM

### Phase Assignment at Generation

```ts
function assignCareerPhase(age: number, ovr: number, momentum: number, buzz: number): CareerPhase {
  if (age <= 22 && ovr < 60) return "prospect";
  if (age <= 22 && ovr >= 60) return "emerging"; // rare early breakout
  if (momentum >= 50 && ovr >= 55 && buzz >= 40) return "established";
  if (age >= 30 && momentum < 40) return "veteran";
  if (momentum < 20 && age >= 25) return "declining";
  if (buzz >= 30 || ovr >= 50) return "emerging";
  return "prospect";
}
```

### Phase Transitions During Gameplay

Phases update every turn based on current state:

```ts
function updateCareerPhase(artist: Artist): CareerPhase {
  const { age, overallRating: ovr, momentum, buzz, careerPhase } = artist;

  // Declining: momentum collapsed
  if (momentum < 15 && artist.turnsAtLowMomentum > 12) return "declining";

  // Veteran: older, lower momentum, but still has some value
  if (age >= 30 && momentum < 45 && momentum >= 15) return "veteran";

  // Established: strong momentum, proven track record
  if (momentum >= 55 && ovr >= 60 && (artist.chartHits >= 3 || artist.totalAlbumsReleased >= 2)) {
    return "established";
  }

  // Emerging: building buzz, showing promise
  if ((buzz >= 30 || momentum >= 30) && ovr >= 45) return "emerging";

  // Prospect: young and unproven
  if (age <= 24 && artist.chartHits < 2 && artist.totalAlbumsReleased < 1) return "prospect";

  // Default based on momentum
  if (momentum >= 40) return "emerging";
  if (momentum < 25 && age >= 28) return "declining";
  return "prospect";
}
```

### Phase Effects

| Phase | Momentum Decay Rate | Fan Churn | Label Interest | Signing Willingness | Description |
|-------|--------------------:|----------:|:--------------:|:-------------------:|-------------|
| Prospect | 1.0x | 0.4% | Low unless high potential | Normal | Unproven, cheap, risky |
| Emerging | 0.8x | 0.3% | Moderate-High | +10 bonus | Building buzz, exciting to sign |
| Established | 0.6x | 0.2% | High | +20 bonus | Proven value, expensive |
| Veteran | 1.2x | 0.5% | Moderate | Normal | Still has value but slowing |
| Declining | 1.5x | 0.8% | Low | -15 penalty | Fading, cheap, risky |

---

## 5. MOMENTUM SYSTEM

### Initialization

```ts
function generateInitialMomentum(age: number, ovr: number, buzz: number): number {
  // Young unproven artists: low momentum (they haven't done anything yet)
  if (age <= 21) return Math.floor(Math.random() * 20) + 5;  // 5-24

  // Scale with age: older free agents had careers — some with leftover momentum
  const ageBonus = Math.min(20, (age - 18) * 3);
  const ovrBonus = Math.max(0, (ovr - 40) * 0.4);
  const buzzBonus = buzz * 0.2;
  const base = ageBonus + ovrBonus + buzzBonus + (Math.random() * 15 - 5);
  return clamp(Math.floor(base), 5, 75);
}
```

### Momentum Changes Per Turn

```ts
function updateMomentum(artist: Artist, events: TurnEvents): number {
  let delta = 0;
  const decay = getDurabilityDecay(artist.durability);

  // === GAINS ===

  // Charting this turn (any position)
  if (events.chartedThisTurn) {
    const posBonus = events.bestPosition <= 3 ? 8 : events.bestPosition <= 10 ? 4 : 2;
    delta += posBonus;
  }

  // Hit song (top 5 chart position)
  if (events.hitSongThisTurn) {
    const hitGain = artist.durability === "flash" ? randInt(25, 35)
                  : artist.durability === "solid" ? randInt(15, 22)
                  : randInt(10, 18); // durable: steadier gains
    delta += hitGain;
  }

  // Album released this turn
  if (events.albumReleasedThisTurn) {
    delta += Math.floor(events.albumQualityScore * 0.15); // 0-15 based on quality
  }

  // Successful tour week
  if (artist.onTour) {
    delta += 1; // slow steady gain from touring
  }

  // === LOSSES ===

  // Idle decay (no release in last 8 turns, not on tour)
  if (events.turnsIdle > 8) {
    const idleDecay = decay * Math.min(3, Math.floor(events.turnsIdle / 8));
    delta -= idleDecay;
  }

  // Flop (released song that fell off chart in < 3 weeks or never charted)
  if (events.flopThisTurn) {
    const flopDamage = artist.durability === "flash" ? randInt(12, 18)
                     : artist.durability === "solid" ? randInt(6, 10)
                     : randInt(3, 6);
    delta -= flopDamage;
  }

  // Scandal
  if (events.scandalThisTurn) {
    delta -= randInt(8, 20);
  }

  // Natural decay (always ticking down slightly)
  delta -= decay * 0.5;

  // Age modifier: older artists lose momentum faster when idle
  if (artist.age >= 30 && events.turnsIdle > 4) {
    delta -= (artist.age - 29) * 0.3;
  }

  return clamp(artist.momentum + delta, 0, 100);
}

function getDurabilityDecay(durability: string): number {
  return durability === "flash" ? 2.0
       : durability === "solid" ? 1.0
       : 0.5; // durable
}
```

### Momentum Effects

| Momentum Range | Effect |
|:--------------:|--------|
| 80-100 | Hot streak. Chart bonus, fan surge, labels fight to keep them. Signing fee premium. |
| 60-79 | Strong. Reliable performer. Labels happy. Good fan retention. |
| 40-59 | Steady. Functional career. Average fan growth. |
| 25-39 | Cooling off. Fan churn increases. Labels start evaluating. Rival labels may drop. |
| 10-24 | Cold. High fan churn. Signing very unlikely. Retirement risk begins. |
| 0-9 | Washed. Near-certain retirement within 20 turns unless revived. |

---

## 6. BUZZ / EXPOSURE SYSTEM

### Initialization

```ts
function generateInitialBuzz(age: number, ovr: number, momentum: number): number {
  // Young unknowns: low buzz
  if (age <= 20) return Math.floor(Math.random() * 25) + 5;   // 5-29

  // Buzz correlates with OVR and momentum but has its own randomness
  // Some low-OVR artists can have high buzz (viral, aesthetic, personality)
  // Some high-OVR artists can have low buzz (underground, no marketing)
  const ovrComponent = ovr * 0.3;
  const momentumComponent = momentum * 0.3;
  const randomComponent = Math.random() * 30 - 10; // -10 to +20
  const viralLottery = Math.random() < 0.08 ? randInt(15, 35) : 0; // 8% viral outlier

  return clamp(Math.floor(ovrComponent + momentumComponent + randomComponent + viralLottery), 5, 95);
}
```

### Buzz Changes Per Turn

```ts
function updateBuzz(artist: Artist, events: TurnEvents): number {
  let delta = 0;

  // Charting raises buzz
  if (events.chartedThisTurn) delta += events.bestPosition <= 5 ? 5 : 2;

  // Album release is a buzz event
  if (events.albumReleasedThisTurn) delta += 3;

  // Tour generates local buzz
  if (artist.onTour) delta += 0.5;

  // Viral moment
  if (events.viralMoment) delta += randInt(10, 25);

  // Scandal can raise or lower buzz
  if (events.scandalThisTurn) delta += randInt(-5, 8); // controversy = attention

  // Inactivity kills buzz faster than momentum
  if (events.turnsIdle > 6) {
    delta -= Math.min(4, Math.floor(events.turnsIdle / 4));
  }

  // Natural decay
  delta -= 0.8;

  // Marketing department bonus
  delta += events.marketingBuzzBonus || 0; // from marketing dept level

  return clamp(artist.buzz + delta, 0, 100);
}
```

### Buzz vs Momentum Distinction

| | Momentum | Buzz |
|-|----------|------|
| What it measures | Career health & trajectory | Public visibility & market attention |
| Driven by | Sustained output, chart consistency | Virality, releases, controversy, marketing |
| Decay rate | Slow-medium (durability-based) | Fast (attention is fleeting) |
| Effect on signing | Major factor in label interest | Affects willingness and signing fee |
| Effect on charts | Indirect (through fan retention) | Direct boost to chart scoring |
| Visible to player | Only if scouted/signed | Always visible |

---

## 7. LABEL SIGNING EVALUATION (AI + Player)

### Revised computeWillingness

```ts
function computeWillingness(artist: Artist, labelRep: number): number {
  const repFactor = clamp(labelRep / 100, 0, 1);

  // Star power now includes momentum
  const starPower = (artist.overallRating * 0.4 + artist.popularity * 0.2 + artist.momentum * 0.3 + artist.buzz * 0.1) / 100;

  const loyaltyFactor = artist.traits.loyalty / 100;

  // Base willingness: higher rep = more willing
  let base = 20 + repFactor * 60;

  // Star penalty: better artists are pickier
  const starPenalty = starPower * 55;
  const repGap = Math.max(0, starPenalty - repFactor * 75);
  base -= repGap;

  // Career phase modifier
  const phaseBonus = artist.careerPhase === "emerging" ? 10
                   : artist.careerPhase === "declining" ? 15 // desperate
                   : artist.careerPhase === "prospect" ? 5  // eager
                   : artist.careerPhase === "veteran" ? -5  // skeptical
                   : 0; // established
  base += phaseBonus;

  // Low momentum artists are more willing (need a deal)
  if (artist.momentum < 30) base += 10;

  const adjusted = base * (0.7 + loyaltyFactor * 0.3);
  return clamp(Math.round(adjusted), 0, 100);
}
```

### Revised computeSigningFee

```ts
function computeSigningFee(artist: Artist, state: GameState, albumCount: 1|2|3): number {
  const ovrFactor = Math.pow(artist.overallRating / 45, 2.8);
  const momentumFactor = 0.7 + (artist.momentum / 100) * 0.6; // 0.7-1.3x
  const buzzFactor = 0.85 + (artist.buzz / 100) * 0.3; // 0.85-1.15x

  let base = Math.floor(
    ovrFactor * 12000
    + artist.fanbase * 0.8
    + artist.popularity * 500
    + artist.momentum * 200 // momentum adds value
  );

  // Money motivation multiplier
  const moneyMult = 0.8 + (artist.traits.moneyMotivation / 100) * 0.6;

  // Album count multiplier
  const albumMult = albumCount === 1 ? 0.65 : albumCount === 2 ? 1.0 : 1.45;

  // Age multiplier (young premium, old discount)
  const ageMult = artist.age <= 22 ? 1.15
                : artist.age <= 32 ? 1.0
                : artist.age <= 34 ? 0.8
                : 0.65;

  // Career phase multiplier
  const phaseMult = artist.careerPhase === "established" ? 1.3
                  : artist.careerPhase === "emerging" ? 1.1
                  : artist.careerPhase === "declining" ? 0.6
                  : artist.careerPhase === "veteran" ? 0.75
                  : 1.0;

  return Math.floor(base * albumMult * moneyMult * ageMult * phaseMult * momentumFactor * buzzFactor);
}
```

### AI Label Signing Logic

Rival labels should evaluate artists using a composite score:

```ts
function computeLabelInterest(artist: Artist, label: RivalLabel): number {
  let score = 0;

  // Raw talent
  score += artist.overallRating * 0.25;

  // Potential (labels love upside)
  score += artist.potential * 0.20;

  // Momentum (are they hot right now?)
  score += artist.momentum * 0.20;

  // Buzz (market attention)
  score += artist.buzz * 0.15;

  // Age discount (young = runway)
  const ageScore = artist.age <= 22 ? 15
                 : artist.age <= 26 ? 10
                 : artist.age <= 30 ? 5
                 : artist.age <= 33 ? 0
                 : -10;
  score += ageScore;

  // Career phase
  score += artist.careerPhase === "emerging" ? 10
         : artist.careerPhase === "prospect" ? 5
         : artist.careerPhase === "established" ? 15
         : artist.careerPhase === "veteran" ? -5
         : -15; // declining

  // Genre fit bonus
  if (label.preferredGenres?.includes(artist.genre)) score += 8;

  return score;
}

// Labels sign artists with interest score > 55
// Higher prestige labels have higher thresholds (prestige * 0.4 + 30)
```

### Age-Based Signing Thresholds

```
Age 18-23: signableMinOVR = 35  (labels bet on upside)
Age 24-27: signableMinOVR = 50  (need current value)
Age 28-32: signableMinOVR = 60  (need strong current quality)
Age 33+:   signableMinOVR = 70  (need elite skill OR momentum > 50 OR fanbase > 200K)
```

These thresholds apply to rival AI signing logic. Player can sign anyone above MIN_SIGNING_WILLINGNESS, but the game naturally makes bad older signings unprofitable.

---

## 8. FREE AGENT POOL LOGIC

### Why Artists Are In Free Agency

At generation time, assign a `freeAgentReason` for older/good artists to explain their availability:

```ts
type FreeAgentReason =
  | "unsigned_prospect"    // young, never signed
  | "recently_dropped"     // label dropped them (low momentum)
  | "contract_expired"     // finished contract, chose not to re-sign
  | "independent"          // prefers independence (high loyalty + low money motivation)
  | "comeback"             // returning after hiatus
  | "scandal_fallout"      // dropped after controversy
  | "niche_artist"         // too underground for label interest
  | "post_decline";        // was good, declined, now available

function assignFreeAgentReason(artist: Artist): FreeAgentReason {
  if (artist.age <= 23) return "unsigned_prospect";
  if (artist.overallRating >= 70 && artist.age >= 27) {
    // Good older artist in free agency needs explanation
    const roll = Math.random();
    if (roll < 0.25) return "recently_dropped";
    if (roll < 0.45) return "contract_expired";
    if (roll < 0.60) return "independent";
    if (roll < 0.75) return "comeback";
    if (roll < 0.85) return "scandal_fallout";
    return "post_decline";
  }
  if (artist.momentum < 20 && artist.age >= 28) return "post_decline";
  if (artist.overallRating < 55) return "unsigned_prospect";
  if (artist.traits.loyalty > 65 && artist.traits.moneyMotivation < 40) return "independent";
  return "unsigned_prospect";
}
```

### Free Agent Filtering: Who Should Be Rare?

When generating the initial pool, apply this filter:

```ts
function shouldBeInFreeAgency(artist: Artist): boolean {
  // Good + prime age + high momentum = should be signed, not free
  if (artist.overallRating >= 75 && artist.age >= 24 && artist.age <= 32 && artist.momentum >= 50) {
    return Math.random() < 0.15; // only 15% chance they're available
  }
  // Decent + good momentum + prime = probably signed
  if (artist.overallRating >= 65 && artist.momentum >= 40 && artist.age >= 25 && artist.age <= 30) {
    return Math.random() < 0.35;
  }
  return true; // everyone else is plausibly free
}
```

For artists that fail this check, either:
1. Don't generate them (reduce pool)
2. Generate them but reduce their momentum to explain availability
3. Assign them to rival labels instead

### Ongoing Pool Refreshing

Each turn (2-5 new artists):
- 80% are age 18-22 (fresh prospects entering the scene)
- 15% are age 23-27 (regional artists gaining attention)
- 5% are age 28+ (comeback stories, journeymen)

When artists are dropped by rival labels, they enter the free agent pool with reduced momentum (-20) and a "recently_dropped" reason. This creates organic mid-career free agents.

---

## 9. CAREER PROGRESSION & DECLINE

### Replace Age-Based Decline with Momentum-Driven System

Remove the hard age breakpoints from `applyAlbumDevelopment`. Instead:

```ts
function applyAlbumDevelopment(artist: Artist, devLevel: number): Artist {
  const dev = ARTIST_DEV_DATA[devLevel];
  const { age, overallRating, potential, momentum, durability } = artist;

  // Growth chance based on age, momentum, and durability
  let growthChance: number;
  let stagnateChance: number;
  let declineChance: number;

  if (age <= 25) {
    // Young: high growth chance, momentum-boosted
    growthChance = 0.65 + (momentum / 100) * 0.15 + dev.improveProbBonus;
    declineChance = 0.08 - dev.regressReduction * 0.2;
    stagnateChance = 1 - growthChance - declineChance;
  } else if (age <= 29) {
    // Prime: moderate growth, stability
    growthChance = 0.35 + (momentum / 100) * 0.15 + dev.improveProbBonus;
    declineChance = 0.12 - dev.regressReduction * 0.3;
    stagnateChance = 1 - growthChance - declineChance;
  } else if (age <= 33) {
    // Late career: growth rare, maintenance key
    growthChance = 0.15 + (momentum / 100) * 0.10 + dev.improveProbBonus * 0.5;
    const durabilityDeclineMod = durability === "flash" ? 0.15
                                : durability === "solid" ? 0.05
                                : 0.0;
    declineChance = 0.20 + durabilityDeclineMod - dev.regressReduction * 0.3;
    stagnateChance = 1 - growthChance - declineChance;
  } else {
    // Veteran: declining is default, durability is the lifeline
    growthChance = durability === "durable" ? 0.10 + dev.improveProbBonus * 0.3
                 : durability === "solid" ? 0.05
                 : 0.02;
    const agePenalty = Math.min(0.4, (age - 33) * (durability === "flash" ? 0.12 : durability === "solid" ? 0.06 : 0.03));
    declineChance = 0.35 + agePenalty - dev.ageDeclineReduction;
    stagnateChance = 1 - growthChance - declineChance;
  }

  // Clamp all probabilities
  growthChance = clamp(growthChance, 0.02, 0.95);
  declineChance = clamp(declineChance, 0.02, 0.70);
  stagnateChance = clamp(stagnateChance, 0.05, 0.80);

  // Normalize
  const total = growthChance + stagnateChance + declineChance;
  growthChance /= total;
  stagnateChance /= total;

  const roll = Math.random();
  if (roll < growthChance) {
    // Growth: +2 to +12 OVR, weighted toward smaller gains at older ages
    const maxGain = age <= 25 ? 15 : age <= 29 ? 8 : age <= 33 ? 4 : 2;
    const gain = randInt(1, maxGain);
    return applyOVRDelta(artist, gain);
  } else if (roll < growthChance + stagnateChance) {
    return artist; // no change
  } else {
    // Decline
    const maxLoss = age <= 29 ? 3 : age <= 33 ? 5 : durability === "flash" ? 8 : 5;
    const loss = randInt(1, maxLoss);
    return applyOVRDelta(artist, -loss);
  }
}
```

### Retirement Logic (Momentum-Driven)

Replace age-based retirement with:

```ts
function checkRetirement(artist: Artist, turn: number): boolean {
  // Momentum collapse = primary retirement driver
  if (artist.momentum <= 5 && artist.turnsAtLowMomentum > 26) {
    return Math.random() < 0.40; // 40% per turn when truly washed
  }
  if (artist.momentum <= 15 && artist.turnsAtLowMomentum > 16) {
    return Math.random() < 0.15;
  }

  // Age-based retirement (backup for very old artists)
  if (artist.age >= 38) {
    const ageRisk = (artist.age - 37) * 0.04; // 4% per year over 37
    const momentumProtection = artist.momentum > 40 ? 0.5 : 1.0; // hot artists stay longer
    return Math.random() < ageRisk * momentumProtection;
  }

  // Extremely low morale + low momentum = quits
  if (artist.morale < 15 && artist.momentum < 20) {
    return Math.random() < 0.10;
  }

  return false;
}
```

---

## 10. REVISED generateArtist FUNCTION

```ts
export function generateArtist(id: string, signed = false): Artist {
  const genre = pick(GENRES);

  // Age: weighted distribution for free agents, young for signed
  const age = signed
    ? Math.floor(Math.random() * 4) + 18
    : generateFreeAgentAge();

  const peakAge = Math.floor(Math.random() * 7) + 26;

  // Durability: weighted random
  const durRoll = Math.random();
  const durability: "flash" | "solid" | "durable" =
    durRoll < 0.45 ? "flash" : durRoll < 0.85 ? "solid" : "durable";

  // Base OVR (talent ceiling) from weighted distribution
  const baseOVR = generateBaseOVR();

  // Current OVR adjusted for age and development
  const currentOVR = applyAgeModifier(baseOVR, age, durability);

  // Generate attributes around current OVR
  const cap = age <= 21 ? 65 + Math.floor((currentOVR - 25) / 5) : 100;
  const attributes = generateAttributes(currentOVR, cap);
  let overallRating = computeOverall(attributes);

  // Floor: minimum 25
  if (overallRating < 25) {
    const bump = 25 - overallRating;
    const keys = Object.keys(attributes) as (keyof ArtistAttributes)[];
    for (const k of keys) attributes[k] = Math.min(100, attributes[k] + bump);
    overallRating = computeOverall(attributes);
  }

  const potential = computePotential(baseOVR, overallRating, age);

  // Momentum & buzz
  const momentum = generateInitialMomentum(age, overallRating, 0); // buzz not yet computed
  const buzz = generateInitialBuzz(age, overallRating, momentum);

  // Career phase
  const careerPhase = assignCareerPhase(age, overallRating, momentum, buzz);

  // Traits
  const moneyMotivation = Math.floor(Math.random() * 61) + 20;
  const competitiveness = Math.floor(Math.random() * 61) + 20;

  return {
    id,
    name: generateArtistName(),
    persona: pick(PERSONAS),
    genre,
    appearance: randomAppearance(),
    popularity: Math.floor(Math.random() * 40) + 10,
    fanbase: Math.floor(Math.random() * 50000) + 5000,
    attributes,
    overallRating,
    potential,
    age,
    peakAge,
    fatigue: 0,
    morale: 80,
    signed,
    contractAlbumsTotal: signed ? 1 : 0,
    contractAlbumsLeft: signed ? 1 : 0,
    onTour: false,
    tourTurnsLeft: 0,
    tourType: null,
    lastMajorTourTurn: 0,
    lastTourEndTurn: 0,
    lastAlbumReleaseTurn: 0,
    preferredAlbumLength: Math.round(10 + (moneyMotivation / 100) * 20),
    minSongQuality: Math.floor(overallRating * (0.50 + competitiveness / 200)),
    traits: {
      loyalty: Math.floor(Math.random() * 41) + 40,
      workEthic: Math.floor(Math.random() * 41) + 40,
      moneyMotivation,
      competitiveness,
      fameMotivation: Math.floor(Math.random() * 61) + 20,
      controversyRisk: Math.floor(Math.random() * 61) + 10,
    },
    // NEW fields
    careerPhase,
    momentum,
    buzz,
    durability,
    peakMomentum: momentum,
    turnsAtLowMomentum: 0,
    totalSinglesReleased: 0,
    totalAlbumsReleased: 0,
    chartHits: 0,
    flops: 0,
    careerStartTurn: 0,
  };
}
```

---

## 11. WORLD GENERATION QUALITY CHECK

At game start, after generating 400 free agents, run a validation pass:

```ts
function validatePool(pool: Artist[]): Artist[] {
  return pool.filter(artist => {
    // Remove unrealistic cases
    // Good prime-age artist with high momentum shouldn't be unsigned
    if (!shouldBeInFreeAgency(artist)) {
      // 85% of these get filtered out; 15% stay with reduced momentum
      if (Math.random() < 0.85) return false;
      artist.momentum = Math.max(10, artist.momentum - 25);
      artist.freeAgentReason = pick(["recently_dropped", "contract_expired", "independent", "comeback"]);
    }
    return true;
  });

  // Backfill to maintain pool size with young prospects
  while (pool.length < 400) {
    const prospect = generateArtist(`pool_backfill_${pool.length}`);
    prospect.age = randInt(18, 22); // force young backfill
    pool.push(prospect);
  }
}
```

---

## 12. EXAMPLE GENERATED PROFILES

### 1. Young Raw Prospect (most common)
```
Name: Lil Venom | Age: 19 | Genre: trap
OVR: 31 | Potential: 78 | Phase: prospect
Momentum: 12 | Buzz: 8 | Durability: flash
Traits: loyalty 55, workEthic 62, controversy 35
Signing fee: ~$8K | Willingness: 72 (eager)
Status: Cheap lottery ticket. Could explode or flame out.
```

### 2. Buzzing Emerging Artist
```
Name: Ghost Kane | Age: 22 | Genre: drill
OVR: 52 | Potential: 71 | Phase: emerging
Momentum: 38 | Buzz: 45 | Durability: solid
Traits: loyalty 48, workEthic 70, controversy 22
Signing fee: ~$35K | Willingness: 58
Status: Starting to get noticed. Good work ethic. Solid bet.
```

### 3. Underground Veteran
```
Name: Street Symphony | Age: 29 | Genre: boom-bap
OVR: 64 | Potential: 66 | Phase: veteran
Momentum: 28 | Buzz: 18 | Durability: durable
Traits: loyalty 72, workEthic 75, controversy 15
Signing fee: ~$55K | Willingness: 45
Status: Skilled but overlooked. Low buzz but reliable. Patient career.
```

### 4. Fading Flash Star
```
Name: Young Blaze | Age: 26 | Genre: pop-rap
OVR: 71 | Potential: 73 | Phase: declining
Momentum: 14 | Buzz: 22 | Durability: flash
Traits: loyalty 42, workEthic 45, controversy 58
Signing fee: ~$40K | Willingness: 68 (desperate)
Status: Had one big year. Momentum collapsed. Risky revival project.
```

### 5. Rare Superstar Prospect
```
Name: Phantom J. Knox | Age: 20 | Genre: trap
OVR: 45 | Potential: 92 | Phase: prospect
Momentum: 18 | Buzz: 30 | Durability: durable
Traits: loyalty 65, workEthic 78, controversy 20
Signing fee: ~$22K | Willingness: 65
Status: Diamond in the rough. Generational ceiling. Requires development.
```

### 6. Established Star (rare in free agency)
```
Name: Apex | Age: 27 | Genre: r-and-b
OVR: 82 | Potential: 84 | Phase: established
Momentum: 42 | Buzz: 50 | Durability: solid
Reason: contract_expired
Signing fee: ~$280K | Willingness: 32
Status: Just left a major label. Proven talent. Expensive and selective.
```

### 7. Washed Legend
```
Name: The Oracle | Age: 34 | Genre: boom-bap
OVR: 58 | Potential: 58 | Phase: declining
Momentum: 8 | Buzz: 12 | Durability: solid
Reason: post_decline
Signing fee: ~$15K | Willingness: 78
Status: Used to be a force. Momentum gone. Cheap nostalgia signing.
```

---

## 13. CHART SCORING REVISION

Add momentum and buzz to chart scoring:

```ts
function computeChartScore(song: Song, artist: Artist): number {
  const baseScore = song.viralPotential * 0.4
                  + song.quality * 0.25
                  + artist.popularity * 0.10
                  + artist.momentum * 0.15      // NEW
                  + artist.buzz * 0.10;          // NEW

  // Freshness bonus (same as before)
  const age = currentTurn - song.releasedTurn;
  const freshnessBonus = Math.min(age <= 16 ? (16 - age) * 1.5 : 0, baseScore * 0.4);

  // Decay after 20 weeks
  const decayFactor = age <= 20 ? 1.0 : Math.max(0, 1.0 - (age - 20) * 0.08);

  return (baseScore + freshnessBonus + Math.random() * 10) * decayFactor;
}
```

---

## 14. ONE-HIT WONDER GENERATION

The system naturally produces one-hit wonders through:

1. **Flash durability** (45% of artists) — high momentum gain from hits, but rapid decay and devastating flop damage
2. **Momentum collapse after a hit** — if a flash artist hits #1 but their next release flops, momentum can swing from 80 to 50 in a few turns, then drain to 20 within a year of inactivity
3. **Buzz decay** — buzz fades faster than momentum, so a one-hit artist's follow-up gets less chart support
4. **Low OVR + high viral** — some artists chart due to catchiness (high viral potential) despite mediocre quality. Their next song probably won't be as catchy.

**Expected career lengths by durability:**
- Flash: median ~60-90 turns (1-2 years of relevance). 30% flame out after first hit.
- Solid: median ~150-250 turns (3-5 years). Can sustain with consistent output.
- Durable: median ~300-500 turns (6-10 years). Can weather flops. Rare decline below 40 momentum before age 33.

---

## 15. IMPLEMENTATION PRIORITY

### Phase 1 (Core — must implement together)
1. Add `momentum`, `buzz`, `durability`, `careerPhase` to Artist interface
2. Rewrite `generateArtist` with new age/OVR distributions
3. Implement momentum update in `advanceTurn`
4. Implement buzz update in `advanceTurn`
5. Update `computeWillingness` and `computeSigningFee`
6. Update career phase transitions each turn

### Phase 2 (Progression & lifecycle)
7. Rewrite `applyAlbumDevelopment` to use momentum + durability
8. Replace age-based retirement with momentum-based retirement
9. Update rival label signing logic with `computeLabelInterest`
10. Add `shouldBeInFreeAgency` filter to pool generation

### Phase 3 (Polish & visibility)
11. Add momentum/buzz to chart scoring
12. Update UI: show career phase badge, momentum bar (if scouted), buzz indicator
13. Add durability hint at high scouting levels
14. Show `freeAgentReason` in artist detail panel for older free agents
15. Track `chartHits`, `flops`, `totalSinglesReleased`, `totalAlbumsReleased`

### Phase 4 (Balance tuning)
16. Run 600-week simulations
17. Tune durability decay rates
18. Tune momentum gain/loss values
19. Verify one-hit wonder frequency (~30-40% of charting artists)
20. Verify superstar longevity (~5-10% of artists sustain 300+ turns)

---

## 16. BALANCING RECOMMENDATIONS

- **Momentum decay must be tuned carefully.** Too fast = no one sustains careers. Too slow = everyone stays relevant forever. Start with the values above and adjust based on simulation.
- **Buzz should decay faster than momentum.** A forgotten artist with skill should be able to mount a comeback; a buzzed-about artist with no skill should fade fast.
- **Flash artists should be exciting but fragile.** Players should learn that signing a flash artist means fast returns but short windows. The fun is in extracting maximum value before they crash.
- **Durable artists should be boring-but-valuable.** They don't spike as hard but they sustain. Finding a durable artist with high potential is the dream signing.
- **The pool should always feel alive.** Every few turns, there should be a new face worth looking at. The combination of 2-5 new artists/turn + rival drops + retirements should create a constantly shifting market.
- **Don't punish the player for signing old artists** — make it organically unprofitable through momentum decay and limited growth potential. The game should let you do it but make you feel the consequences.
