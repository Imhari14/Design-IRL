
export interface Pin {
  id: string;
  title: string;
  description: string;
  images: {
    orig: {
      url: string;
    };
  };
}

export interface PinterestApiResponse {
  data: Pin[];
  cursor: string | null;
}

export interface TasteAnalysis {
  palette: string[]; // 3 hex codes
  materials: string[];
  layout: string;
  mood: string;
}

export interface TasteProfile {
  colors: string[];
  textures: string[];
  moods: string[];
}

export enum AppState {
  WELCOME,
  API_KEY_INPUT,
  PATHWAY_SELECTION,
  SEARCH,
  ANALYZING,
  TRY_ON_SETUP,
  GENERATING,
  EDITING,
}