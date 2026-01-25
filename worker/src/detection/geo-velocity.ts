import type { Location } from '../types';

export function calculateGeoVelocityScore(
  currentLocation: Location | undefined,
  lastLocation: Location | undefined,
  timeDiffHours: number
): number {
  if (!currentLocation || !lastLocation || timeDiffHours <= 0) {
    return 0;
  }

  const distanceKm = haversineDistance(currentLocation, lastLocation);
  const velocityKmh = distanceKm / timeDiffHours;
  
  // Flag impossible or suspicious travel
  if (velocityKmh > 800) {
    return 100; // Impossible travel (faster than commercial flight)
  } else if (velocityKmh > 500) {
    return 80; // Very suspicious
  } else if (velocityKmh > 300) {
    return 60; // Highly unusual
  } else if (velocityKmh > 200) {
    return 40; // Unusual
  } else if (velocityKmh > 100) {
    return 20; // Slightly unusual
  }
  
  return 0;
}

function haversineDistance(loc1: Location, loc2: Location): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(loc2.latitude - loc1.latitude);
  const dLon = toRad(loc2.longitude - loc1.longitude);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(loc1.latitude)) * Math.cos(toRad(loc2.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function isNewLocation(
  currentLocation: Location | undefined,
  previousLocations: Location[],
  toleranceKm: number = 50
): boolean {
  if (!currentLocation || previousLocations.length === 0) {
    return true;
  }

  for (const prevLoc of previousLocations) {
    const distance = haversineDistance(currentLocation, prevLoc);
    if (distance < toleranceKm) {
      return false; // Not new, close to a previous location
    }
  }

  return true; // New location
}