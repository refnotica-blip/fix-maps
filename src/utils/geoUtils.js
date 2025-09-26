/**
 * Checks if a point is inside a polygon using ray casting algorithm
 * @param {Object} point - {latitude, longitude}
 * @param {Array} polygon - Array of [longitude, latitude] coordinates
 * @returns {boolean}
 */
export const isPointInPolygon = (point, polygon) => {
  try {
    if (!point || !polygon || polygon.length < 3) return false;
    
    const { latitude: lat, longitude: lng } = point;
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      
      if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    return inside;
  } catch (error) {
    console.warn('Error in isPointInPolygon:', error);
    return false;
  }
};

/**
 * Finds which ward a point belongs to
 * @param {Object} point - {latitude, longitude}
 * @param {Object} geoJsonData - GeoJSON data with ward polygons
 * @returns {Object|null} Ward feature or null if not found
 */
export const findWardForPoint = (point, geoJsonData) => {
  try {
    if (!geoJsonData?.features || !point) return null;
    
    for (const feature of geoJsonData.features) {
      if (!feature.geometry) continue;
      
      if (feature.geometry.type === 'Polygon') {
        const coordinates = feature.geometry.coordinates[0];
        if (coordinates && isPointInPolygon(point, coordinates)) {
          return feature;
        }
      } else if (feature.geometry.type === 'MultiPolygon') {
        for (const polygon of feature.geometry.coordinates) {
          const coordinates = polygon[0];
          if (coordinates && isPointInPolygon(point, coordinates)) {
            return feature;
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.warn('Error in findWardForPoint:', error);
    return null;
  }
};

/**
 * Renders GeoJSON polygons as React Native Maps Polygon components
 * @param {Object} geoJsonData - GeoJSON data
 * @param {Object} options - Rendering options
 * @returns {Array} Array of Polygon components
 */
export const renderGeoJSONPolygons = (geoJsonData, options = {}) => {
  try {
    if (!geoJsonData?.features) return [];
    
    const {
      strokeColor = '#2196F3',
      fillColor = 'rgba(33, 150, 243, 0.1)',
      strokeWidth = 1,
      onPress = null,
    } = options;
    
    const polygons = [];
    
    geoJsonData.features.forEach((feature, index) => {
      try {
        if (!feature.geometry) return;
        
        if (feature.geometry.type === 'Polygon') {
          const coordinates = feature.geometry.coordinates[0];
          if (!coordinates || coordinates.length < 3) return;
          
          const mappedCoordinates = coordinates.map(coord => ({
            latitude: coord[1],
            longitude: coord[0],
          }));
          
          polygons.push({
            id: feature.properties?.id || feature.properties?.WARD_ID || `polygon-${index}`,
            coordinates: mappedCoordinates,
            strokeColor,
            fillColor,
            strokeWidth,
            feature,
            onPress: onPress ? () => onPress(feature) : undefined,
          });
        } else if (feature.geometry.type === 'MultiPolygon') {
          feature.geometry.coordinates.forEach((polygon, polyIndex) => {
            const coordinates = polygon[0];
            if (!coordinates || coordinates.length < 3) return;
            
            const mappedCoordinates = coordinates.map(coord => ({
              latitude: coord[1],
              longitude: coord[0],
            }));
            
            polygons.push({
              id: feature.properties?.id || feature.properties?.WARD_ID || `multipolygon-${index}-${polyIndex}`,
              coordinates: mappedCoordinates,
              strokeColor,
              fillColor,
              strokeWidth,
              feature,
              onPress: onPress ? () => onPress(feature) : undefined,
            });
          });
        }
      } catch (featureError) {
        console.warn(`Error processing feature ${index}:`, featureError);
      }
    });
    
    return polygons;
  } catch (error) {
    console.warn('Error in renderGeoJSONPolygons:', error);
    return [];
  }
};

/**
 * Simplifies GeoJSON polygons to reduce rendering complexity
 * @param {Object} geojson - The GeoJSON object
 * @param {number} tolerance - Simplification tolerance (higher = more simplified)
 * @returns {Object} Simplified GeoJSON
 */
export const simplifyGeoJSON = (geojson, tolerance = 0.005) => {
  try {
    // Import simplify-geojson dynamically to handle potential issues
    const simplify = require('simplify-geojson');
    return simplify(geojson, tolerance);
  } catch (error) {
    console.warn('Failed to simplify GeoJSON, using original:', error);
    return geojson;
  }
};

/**
 * Checks if a point is within the current map bounds
 * @param {Object} point - {latitude, longitude}
 * @param {Object} bounds - Map bounds
 * @returns {boolean}
 */
export const isPointInBounds = (point, bounds) => {
  try {
    if (!bounds || !point) return true;
    
    return (
      point.latitude >= bounds.southWest.latitude &&
      point.latitude <= bounds.northEast.latitude &&
      point.longitude >= bounds.southWest.longitude &&
      point.longitude <= bounds.northEast.longitude
    );
  } catch (error) {
    console.warn('Error in isPointInBounds:', error);
    return true;
  }
};

/**
 * Filters GeoJSON features based on map bounds
 * @param {Object} geojson - The GeoJSON object
 * @param {Object} bounds - Map bounds
 * @returns {Object} Filtered GeoJSON
 */
export const filterGeoJSONByBounds = (geojson, bounds) => {
  try {
    if (!bounds || !geojson?.features) return geojson;

    const filteredFeatures = geojson.features.filter(feature => {
      try {
        if (!feature.geometry?.coordinates) return false;

        // For polygons, check if any coordinate is within bounds
        let coordinates = [];
        if (feature.geometry.type === 'Polygon') {
          coordinates = feature.geometry.coordinates[0] || [];
        } else if (feature.geometry.type === 'MultiPolygon') {
          coordinates = feature.geometry.coordinates[0]?.[0] || [];
        }
        
        return coordinates.some(coord => 
          isPointInBounds({ latitude: coord[1], longitude: coord[0] }, bounds)
        );
      } catch (featureError) {
        console.warn('Error filtering feature:', featureError);
        return false;
      }
    });

    return {
      ...geojson,
      features: filteredFeatures
    };
  } catch (error) {
    console.warn('Error in filterGeoJSONByBounds:', error);
    return geojson;
  }
};

/**
 * Calculates distance between two points using Haversine formula
 * @param {Object} point1 - {latitude, longitude}
 * @param {Object} point2 - {latitude, longitude}
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (point1, point2) => {
  try {
    if (!point1 || !point2) return 0;
    
    const R = 6371; // Earth's radius in km
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  } catch (error) {
    console.warn('Error calculating distance:', error);
    return 0;
  }
};

/**
 * Debounce function to limit API calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};