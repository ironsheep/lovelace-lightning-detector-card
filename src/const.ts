export const CARD_VERSION = '0.2.0';

export const RINGSET_PAST_TOPNAME = 'prings';
export const RINGSET_CURRENT_TOPNAME = 'crings';

export const RINGSET_TIMESTAMP_KEY = 'timestamp'; // time ring report was created
export const RINGSET_LAST_DETECTION_KEY = 'last'; // [optional] may not be present (not here when no detections in this 'period_minutes')
export const RINGSET_FIRST_DETECTION_KEY = 'first'; // [optional] may not be present (not here when no detections in this 'period_minutes')
export const RINGSET_STORM_LAST_KEY = 'storm_last';
export const RINGSET_STORM_FIRST_KEY = 'storm_first';

export const RINGSET_PERIOD_MINUTES_KEY = 'period_minutes';
export const RINGSET_UNITS_KEY = 'units';
export const RINGSET_OUT_OF_RANGE_KEY = 'out_of_range';
export const RINGSET_RING_COUNT_KEY = 'ring_count';
export const RINGSET_RING_WIDTH_KM_KEY = 'ring_width_km';

export const RING_COUNT_KEY = 'count';
export const RING_DISTANCE_KM_KEY = 'distance_km';
export const RING_FROM_UNITS_KEY = 'from_units';
export const RING_TO_UNITS_KEY = 'to_units';
export const RING_ENERGY_KEY = 'energy';
