export const DEFAULT_SETTINGS = {
  username: "purrpleuser",
  interests:
    "technology, science, space, programming, open source, weird and funny news. Less interested in celebrity gossip and sports.",
  feeds: [
    "https://hnrss.org/frontpage",
    "https://feeds.arstechnica.com/arstechnica/index",
    "https://feeds.bbci.co.uk/news/world/rss.xml",
    "https://www.sciencedaily.com/rss/top/science.xml",
    "https://www.theverge.com/rss/index.xml",
    "https://feeds.npr.org/1001/rss.xml",
  ].join("\n"),
  cycleMinutes: 30,
  postsPerCycle: 4,
  minRelevance: 30,
  agentsEnabled: true,
  lastCycleAt: 0,
};

export type Settings = typeof DEFAULT_SETTINGS;
