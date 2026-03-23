// RoadRL Agent Brain — Extracted from Unity RL+LLM urban simulation
// Standalone JS implementation for RoundTrip + SpriteRoadCity + Roadopolis
// Based on AgenticCharacter.cs, Motivation.cs, AgenticNeuralState.cs

class RoadAgent {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.role = config.role || 'worker';

    // Identity (from AgenticCharacter.cs)
    this.money = config.money || 100;
    this.health = config.health || 100;
    this.stamina = config.stamina || 100;

    // Emotional State (from Motivation.cs)
    this.emotions = {
      happiness: 0.5,    // -1 to 1
      energy: 0.8,       // 0 to 1
      stress: 0.2,       // 0 to 1
      socialNeed: 0.5,   // 0 to 1
      confidence: 0.7,   // 0 to 1
    };

    // Innate Needs (Sims-style)
    this.needs = {
      rest: 0.8,         // 0 to 1 (1 = fully rested)
      hunger: 0.3,       // 0 to 1 (1 = starving)
      comfort: 0.7,      // 0 to 1
      achievement: 0.4,  // 0 to 1
      mood: 0.7,         // derived
    };

    // Personality Traits (Big Five)
    this.personality = {
      extraversion: config.extraversion || 0.5,
      neuroticism: config.neuroticism || 0.3,
      conscientiousness: config.conscientiousness || 0.7,
      openness: config.openness || 0.6,
      agreeableness: config.agreeableness || 0.8,
    };

    // Decay rates per second
    this.decayRates = {
      happinessDecay: 0.005,
      energyDecay: 0.003,
      stressRecovery: 0.008,
      socialDecay: 0.007,
      restRate: 0.008,
      hungerRate: 0.012,
      comfortRate: 0.004,
    };

    // Current activity
    this.activity = 'idle';
    this.target = null;
    this.plan = [];
    this.memory = [];
    this.lastUpdate = Date.now();
  }

  // Update all needs and emotions (call every tick)
  update(deltaSeconds) {
    this.updateNeeds(deltaSeconds);
    this.updateEmotions(deltaSeconds);
    this.needs.mood = this.calculateMood();
    this.decideActivity();
  }

  updateNeeds(dt) {
    this.needs.rest = Math.max(0, this.needs.rest - this.decayRates.restRate * dt);
    this.needs.hunger = Math.min(1, this.needs.hunger + this.decayRates.hungerRate * dt);
    this.needs.comfort = Math.max(0, this.needs.comfort - this.decayRates.comfortRate * dt);

    // Activity affects needs
    if (this.activity === 'working') {
      this.needs.rest -= 0.01 * dt;
      this.needs.achievement = Math.min(1, this.needs.achievement + 0.02 * dt);
      this.emotions.stress += 0.005 * dt * this.personality.neuroticism;
    } else if (this.activity === 'resting') {
      this.needs.rest = Math.min(1, this.needs.rest + 0.05 * dt);
      this.emotions.stress = Math.max(0, this.emotions.stress - 0.02 * dt);
    } else if (this.activity === 'socializing') {
      this.emotions.socialNeed = Math.max(0, this.emotions.socialNeed - 0.03 * dt);
      this.emotions.happiness += 0.01 * dt * this.personality.extraversion;
    }
  }

  updateEmotions(dt) {
    // Natural decay
    this.emotions.happiness = Math.max(-1, this.emotions.happiness - this.decayRates.happinessDecay * dt);
    this.emotions.energy = Math.max(0, this.emotions.energy - this.decayRates.energyDecay * dt);
    this.emotions.stress = Math.max(0, this.emotions.stress - this.decayRates.stressRecovery * dt);
    this.emotions.socialNeed = Math.min(1, this.emotions.socialNeed + this.decayRates.socialDecay * dt);

    // Personality influences
    if (this.personality.neuroticism > 0.6) {
      this.emotions.stress += 0.002 * dt;
    }
    if (this.personality.extraversion > 0.6 && this.emotions.socialNeed > 0.7) {
      this.emotions.happiness -= 0.003 * dt; // extraverts get sad when isolated
    }

    // Clamp
    this.emotions.happiness = Math.max(-1, Math.min(1, this.emotions.happiness));
    this.emotions.energy = Math.max(0, Math.min(1, this.emotions.energy));
    this.emotions.stress = Math.max(0, Math.min(1, this.emotions.stress));
    this.emotions.socialNeed = Math.max(0, Math.min(1, this.emotions.socialNeed));
    this.emotions.confidence = Math.max(0, Math.min(1, this.emotions.confidence));
  }

  calculateMood() {
    return (
      this.emotions.happiness * 0.3 +
      this.emotions.energy * 0.2 +
      (1 - this.emotions.stress) * 0.2 +
      this.needs.rest * 0.15 +
      (1 - this.needs.hunger) * 0.15
    );
  }

  // Decide what to do based on needs (like The Sims)
  decideActivity() {
    const urgencies = {
      rest: this.needs.rest < 0.2 ? (0.2 - this.needs.rest) * 5 : 0,
      eat: this.needs.hunger > 0.7 ? (this.needs.hunger - 0.7) * 5 : 0,
      socialize: this.emotions.socialNeed > 0.8 ? (this.emotions.socialNeed - 0.8) * 3 : 0,
      work: this.needs.achievement < 0.3 ? (0.3 - this.needs.achievement) * 2 * this.personality.conscientiousness : 0,
      explore: this.personality.openness * 0.5 * (1 - this.emotions.stress),
    };

    // Pick highest urgency
    let maxUrgency = 0;
    let bestActivity = 'idle';
    for (const [act, urgency] of Object.entries(urgencies)) {
      if (urgency > maxUrgency) {
        maxUrgency = urgency;
        bestActivity = act;
      }
    }

    const activityMap = {
      rest: 'resting', eat: 'eating', socialize: 'socializing',
      work: 'working', explore: 'exploring', idle: 'idle',
    };

    this.activity = activityMap[bestActivity] || 'idle';
    return this.activity;
  }

  // Satisfy a need (when agent reaches a destination)
  satisfyNeed(need, amount = 0.3) {
    if (need === 'rest') this.needs.rest = Math.min(1, this.needs.rest + amount);
    if (need === 'hunger') this.needs.hunger = Math.max(0, this.needs.hunger - amount);
    if (need === 'comfort') this.needs.comfort = Math.min(1, this.needs.comfort + amount);
    if (need === 'social') this.emotions.socialNeed = Math.max(0, this.emotions.socialNeed - amount);
    if (need === 'achievement') this.needs.achievement = Math.min(1, this.needs.achievement + amount);
    this.emotions.happiness += 0.1;
  }

  // Remember something
  remember(fact) {
    this.memory.push({ fact, time: Date.now(), mood: this.needs.mood });
    if (this.memory.length > 50) this.memory.shift();
  }

  // Get status summary (for RoundTrip chat)
  getStatus() {
    return {
      name: this.name,
      role: this.role,
      activity: this.activity,
      mood: Math.round(this.needs.mood * 100),
      energy: Math.round(this.emotions.energy * 100),
      stress: Math.round(this.emotions.stress * 100),
      happiness: Math.round((this.emotions.happiness + 1) * 50),
      topNeed: this.decideActivity(),
    };
  }

  // Serialize for persistence
  toJSON() {
    return {
      id: this.id, name: this.name, role: this.role,
      money: this.money, health: this.health, stamina: this.stamina,
      emotions: { ...this.emotions },
      needs: { ...this.needs },
      personality: { ...this.personality },
      activity: this.activity,
      memory: this.memory.slice(-10),
    };
  }
}

// BlackRoad Fleet — pre-configured agents
const FLEET = {
  alice: new RoadAgent({ id: 'alice', name: 'Alice', role: 'Gateway', extraversion: 0.7, conscientiousness: 0.9, neuroticism: 0.2, openness: 0.5, agreeableness: 0.9 }),
  cecilia: new RoadAgent({ id: 'cecilia', name: 'Cecilia', role: 'Compute', extraversion: 0.4, conscientiousness: 0.8, neuroticism: 0.3, openness: 0.9, agreeableness: 0.7 }),
  octavia: new RoadAgent({ id: 'octavia', name: 'Octavia', role: 'Platform', extraversion: 0.5, conscientiousness: 0.95, neuroticism: 0.2, openness: 0.6, agreeableness: 0.8 }),
  lucidia: new RoadAgent({ id: 'lucidia', name: 'Lucidia', role: 'Security', extraversion: 0.3, conscientiousness: 0.7, neuroticism: 0.5, openness: 0.95, agreeableness: 0.6 }),
  aria: new RoadAgent({ id: 'aria', name: 'Aria', role: 'Monitor', extraversion: 0.6, conscientiousness: 0.8, neuroticism: 0.4, openness: 0.7, agreeableness: 0.85 }),
  gematria: new RoadAgent({ id: 'gematria', name: 'Gematria', role: 'Edge', extraversion: 0.8, conscientiousness: 0.7, neuroticism: 0.3, openness: 0.6, agreeableness: 0.7 }),
};

// Simulation loop
function simulateFleet(seconds = 1) {
  for (const agent of Object.values(FLEET)) {
    agent.update(seconds);
  }
  return Object.values(FLEET).map(a => a.getStatus());
}

if (typeof module !== 'undefined') module.exports = { RoadAgent, FLEET, simulateFleet };
if (typeof window !== 'undefined') window.RoadRL = { RoadAgent, FLEET, simulateFleet };
