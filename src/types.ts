export interface Note {
  id: string;
  content: string;
  timestamp: number;
}

export interface Location {
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface Place {
  id: string;
  name: string;
  locations: Location[];
  notes: Note[];
  createdAt: number;
  lastUpdated: number;
}

export interface UserData {
  places: Place[];
  lastUpdated: number;
}
