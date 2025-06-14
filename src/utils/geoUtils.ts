import type { Location } from '../types';

// 地球半径（米）
const EARTH_RADIUS = 6371000;

// 将角度转换为弧度
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// 计算两个位置之间的距离（米）
export function calculateDistance(loc1: Location, loc2: Location): number {
  const lat1Rad = toRadians(loc1.latitude);
  const lat2Rad = toRadians(loc2.latitude);
  const deltaLat = toRadians(loc2.latitude - loc1.latitude);
  const deltaLon = toRadians(loc2.longitude - loc1.longitude);

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return EARTH_RADIUS * c;
}

// 检查新位置是否在现有地点的范围内（100米）
export function isLocationNearPlace(newLocation: Location, existingLocations: Location[]): boolean {
  const MAX_DISTANCE = 100; // 100米范围

  return existingLocations.some(existingLocation => 
    calculateDistance(newLocation, existingLocation) <= MAX_DISTANCE
  );
}
