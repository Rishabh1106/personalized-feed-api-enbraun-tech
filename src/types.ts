export type FeedItem = {
  id: string;
  title: string;
  ts: number; // unix ms
  popularity: number; // integer
  category: string;
  region: string;
  meta: any;
};

export type User = {
  id: string;
  region: string;
  prefWeights: Record<string, number>;
};
