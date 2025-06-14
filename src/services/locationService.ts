import type { UserData, Location, Place, Note } from '../types';
import { isLocationNearPlace, calculateDistance } from '../utils/geoUtils';

const STORAGE_KEY = 'user_location_data';
const DISTANCE_THRESHOLD = 500; // 距离偏差阈值（米）

// 计算权重的辅助函数
const calculateWeight = (timestamp: number): number => {
  const now = Date.now();
  const hoursDiff = (now - timestamp) / (1000 * 60 * 60); // 转换为小时
  // 使用对数函数，让权重随时间差增长，但增长速度逐渐放缓
  return Math.log(hoursDiff + 1) + 1;
};

// 计算地点的综合权重（结合距离和时间）
const calculatePlaceWeight = (
  place: Place, 
  distance: number,
  minDistance: number
): number => {
  // 距离权重：越接近最近距离，权重越大
  const distanceWeight = 1 - (distance - minDistance) / DISTANCE_THRESHOLD;
  
  // 获取该地点最旧的备注时间作为时间权重基础
  const oldestNote = place.notes.reduce((oldest, note) => 
    note.timestamp < oldest.timestamp ? note : oldest
  );
  const timeWeight = calculateWeight(oldestNote.timestamp);

  // 综合权重：时间权重 * 距离权重
  return timeWeight * distanceWeight;
};

// 基于权重进行随机选择
const weightedRandom = <T>(items: Array<{item: T; weight: number}>): T => {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;

  for (const {item, weight} of items) {
    random -= weight;
    if (random <= 0) {
      return item;
    }
  }

  return items[items.length - 1].item;
};

export const LocationService = {
  findNearbyPlace: (location: Location): Place | null => {
    const existingData = LocationService.getData();
    if (!existingData) return null;

    const nearbyPlace = existingData.places.find(
      place => isLocationNearPlace(location, place.locations)
    );

    return nearbyPlace || null;
  },

  createPlace: (name: string, location: Location) => {
    const existingData = LocationService.getData();
    const now = Date.now();

    const newPlace: Place = {
      id: Math.random().toString(36).substring(2, 9),
      name: name.trim(),
      locations: [location],
      notes: [],
      createdAt: now,
      lastUpdated: now
    };

    const newData: UserData = {
      places: existingData ? [...existingData.places, newPlace] : [newPlace],
      lastUpdated: now
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    return newData;
  },

  addLocationToPlace: (placeId: string, location: Location) => {
    const existingData = LocationService.getData();
    if (!existingData) return null;

    const now = Date.now();
    const newData: UserData = {
      places: existingData.places.map(place => {
        if (place.id === placeId) {
          return {
            ...place,
            locations: [...place.locations, location],
            lastUpdated: now
          };
        }
        return place;
      }),
      lastUpdated: now
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    return newData;
  },

  editPlaceName: (placeId: string, newName: string) => {
    const existingData = LocationService.getData();
    if (!existingData) return null;

    const now = Date.now();
    const newData: UserData = {
      places: existingData.places.map(place => {
        if (place.id === placeId) {
          return {
            ...place,
            name: newName.trim(),
            lastUpdated: now
          };
        }
        return place;
      }),
      lastUpdated: now
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    return newData;
  },

  addNoteToPlace: (placeId: string, content: string) => {
    const existingData = LocationService.getData();
    if (!existingData) return null;

    const newNote: Note = {
      id: Math.random().toString(36).substring(2, 9),
      content,
      timestamp: Date.now()
    };

    const now = Date.now();
    const newData: UserData = {
      places: existingData.places.map(place => {
        if (place.id === placeId) {
          return {
            ...place,
            notes: [...place.notes, newNote],
            lastUpdated: now
          };
        }
        return place;
      }),
      lastUpdated: now
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    return newData;
  },

  // 更新所有相同内容的备注的时间戳
  updateAllSimilarNotes: (noteContent: string): UserData | null => {
    const existingData = LocationService.getData();
    if (!existingData) return null;

    const now = Date.now();
    const newData: UserData = {
      places: existingData.places.map(place => ({
        ...place,
        notes: place.notes.map(note => {
          if (note.content === noteContent) {
            return {
              ...note,
              timestamp: now
            };
          }
          return note;
        }),
        lastUpdated: now
      })),
      lastUpdated: now
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    return newData;
  },

  updateNoteTimestamp: (placeId: string, noteId: string): UserData | null => {
    const existingData = LocationService.getData();
    if (!existingData) return null;

    // 首先找到要更新的备注内容
    let noteContent: string | null = null;
    existingData.places.forEach(place => {
      if (place.id === placeId) {
        const note = place.notes.find(n => n.id === noteId);
        if (note) {
          noteContent = note.content;
        }
      }
    });

    if (!noteContent) return null;

    // 更新所有相同内容的备注
    return LocationService.updateAllSimilarNotes(noteContent);
  },

  getRandomNoteFromNearestPlace: (currentLocation: Location): { note: Note; place: Place } | null => {
    const existingData = LocationService.getData();
    if (!existingData || existingData.places.length === 0) return null;

    // 计算每个地点到当前位置的距离
    const placesWithDistance = existingData.places
      .filter(place => place.notes.length > 0) // 只考虑有备注的地点
      .map(place => ({
        place,
        distance: calculateDistance(currentLocation, place.locations[0])
      }))
      .sort((a, b) => a.distance - b.distance);

    if (placesWithDistance.length === 0) return null;

    // 获取最近的地点的距离
    const minDistance = placesWithDistance[0].distance;

    // 筛选出在距离阈值范围内的地点
    const validPlaces = placesWithDistance.filter(
      ({ distance }) => distance <= minDistance + DISTANCE_THRESHOLD
    );

    if (validPlaces.length === 0) return null;

    // 为每个地点计算权重
    const placesWithWeights = validPlaces.map(({ place, distance }) => ({
      item: place,
      weight: calculatePlaceWeight(place, distance, minDistance)
    }));

    // 使用权重随机选择一个地点
    const selectedPlace = weightedRandom(placesWithWeights);

    // 从选中的地点随机选择一条备注
    const selectedNote = selectedPlace.notes[Math.floor(Math.random() * selectedPlace.notes.length)];

    // 更新所有同名备注的时间戳
    LocationService.updateAllSimilarNotes(selectedNote.content);

    return { 
      note: selectedNote,
      place: selectedPlace 
    };
  },

  getData: (): UserData | null => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  },

  clearData: () => {
    localStorage.removeItem(STORAGE_KEY);
  }
};
