/** Khoảng cách Haversine (mét) giữa hai điểm GPS. */
export function haversineDistanceM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isWithinRadius(lat, lng, centerLat, centerLng, radiusM) {
  if (centerLat == null || centerLng == null || !radiusM) return false;
  return haversineDistanceM(lat, lng, centerLat, centerLng) <= radiusM;
}

export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator?.geolocation) {
      reject(new Error('Trình duyệt không hỗ trợ GPS'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      (err) => {
        const msg = err.code === 1
          ? 'Cần cấp quyền truy cập vị trí để chấm công'
          : err.code === 2
            ? 'Không xác định được vị trí GPS'
            : 'Hết thời gian chờ GPS';
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
        ...options,
      },
    );
  });
}

export function watchPosition(onUpdate, onError, options = {}) {
  if (!navigator?.geolocation) {
    onError?.(new Error('Trình duyệt không hỗ trợ GPS'));
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => onUpdate({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    }),
    (err) => {
      const msg = err.code === 1
        ? 'Cần cấp quyền truy cập vị trí'
        : 'Không theo dõi được vị trí GPS';
      onError?.(new Error(msg));
    },
    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 5000,
      ...options,
    },
  );
  return () => navigator.geolocation.clearWatch(id);
}

export function formatCoords(lat, lng) {
  if (lat == null || lng == null) return '';
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
