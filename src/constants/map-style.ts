/**
 * Dark Transit Map Style for Delhi NCT
 * Designed for TransitDilli Radar Mode:
 * Deep dark palette, vibrant arterial roads, transit corridors, and no commercial clutter.
 */
export const TRANSIT_MAP_STYLE = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#0F172A' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#0F172A' }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#94A3B8' }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#E2E8F0' }],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1E293B' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0F172A' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64748B' }],
  },
  {
    featureType: 'road.local',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#273549' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#16202E' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#94A3B8' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#1E293B' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38BDF8' }],
  },
  {
    featureType: 'transit.station.bus',
    stylers: [{ visibility: 'on' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0B132B' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#334155' }],
  },
];
