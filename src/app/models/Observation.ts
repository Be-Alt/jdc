export type ObservationTone = 'positive' | 'mixed' | 'difficulty' | 'warning';

export type ObservationItem = { id: string; label: string };

export type ObservationLevel = {
  id: string;
  label: string;
  tone: ObservationTone;
  items: ObservationItem[];
};

export type ObservationCategory = {
  id: string;
  label: string;
  levels: ObservationLevel[];
};
