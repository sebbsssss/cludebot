// Personal-life topic taxonomy for /showcase/wiki. Replaces the dev-tooling
// topics (Memory Decay, Agent Loops…) with life domains a non-technical user
// can immediately read as their own.

import type { Topic, Cluster } from './wiki-data';

// Personal life clusters mapped onto the existing Cluster palette so the dot
// colours stay consistent with the rest of the page chrome.
//   architecture (blue)   → work / career
//   research (orange)     → learning, reading, ideas
//   product (green)       → home, money, planning
//   self (purple)         → health, family, relationships, personal
const PERSONAL_TOPICS: Topic[] = [
  { id: 'sleep',           name: 'Sleep',                cluster: 'self' as Cluster,         color: '#8B5CF6', count: 0,
    summary: "How you actually sleep — what's working, what isn't, and the patterns the agent has noticed across the last few weeks." },
  { id: 'sarahs-wedding',  name: "Sarah's Wedding",      cluster: 'product' as Cluster,      color: '#10B981', count: 0,
    summary: 'May 24 in Healdsburg. RSVPs, gift, hotel, what to wear — everything you need to remember in one place.' },
  { id: 'apartment-search',name: 'Apartment Search',     cluster: 'product' as Cluster,      color: '#10B981', count: 0,
    summary: "What you're looking for, the places you've seen, and the patterns of what you keep coming back to." },
  { id: 'cooking',         name: 'Cooking',              cluster: 'research' as Cluster,     color: '#F59E0B', count: 0,
    summary: "Recipes that made it into the rotation, techniques that worked, and what you've been learning about food." },
  { id: 'reading',         name: 'Reading',              cluster: 'research' as Cluster,     color: '#F59E0B', count: 0,
    summary: 'Books finished, books abandoned, lines that stuck. Your reading life as it accumulates.' },
  { id: 'moms-surgery',    name: "Mom's Surgery",        cluster: 'self' as Cluster,         color: '#8B5CF6', count: 0,
    summary: 'May 18 at UCSF. Logistics, who covers what, what mom needs, what you noticed in the calls leading up to it.' },
  { id: 'career',          name: 'Career Direction',     cluster: 'architecture' as Cluster, color: '#2244FF', count: 0,
    summary: "What you keep coming back to about your career — the path you're being pushed toward vs. the one you actually want." },
  { id: 'money',           name: 'Money',                cluster: 'product' as Cluster,      color: '#10B981', count: 0,
    summary: 'Decisions, allocations, big purchases. The financial picture as it changes month to month.' },
];

export function showcaseTopics(): Topic[] {
  return PERSONAL_TOPICS;
}
