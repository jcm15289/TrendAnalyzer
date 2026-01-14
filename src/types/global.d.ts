declare global {
  interface Window {
    trends: {
      embed: {
        renderExploreWidget: (
          type: string,
          payload: {
            comparisonItem: { keyword: string; geo: string; time: string }[];
            category: number;
            property: string;
          },
          options: {
            exploreQuery: string;
            guestPath: string;
          }
        ) => void;
      };
    };
  }
}

// This export is needed to make the file a module.
export {};
