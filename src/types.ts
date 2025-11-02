export type FeedItem = {
  id: string;
  title: string;
  ts: number; // unix ms
  popularity: number; // integer
  segment: string;
  region: string;
};

export type User = {
  id: number;
  region: string;
  prefWeights: Record<string, number>;
};
