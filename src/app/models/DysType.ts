export type DysAccommodation = {
  id: number;
  amenagement: string;
};

export type DysType = {
  id: number;
  code: string;
  nom: string;
  description: string | null;
  accommodations: DysAccommodation[];
};
