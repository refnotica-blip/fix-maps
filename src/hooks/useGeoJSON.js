import { useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { simplifyGeoJSON, filterGeoJSONByBounds } from '../utils/geoUtils';

const GEOJSON_CACHE_KEY = 'cached_wards_geojson';
const CACHE_EXPIRY_HOURS = 24;
const GEOJSON_URL = 'https://raw.githubusercontent.com/Thabang-777/wards-geojson/main/wards.geojson';

export const useGeoJSON = (mapBounds = null, simplificationTolerance = 0.005) => {
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load and cache GeoJSON data
  useEffect(() => {
    loadGeoJSON();
  }, []);

  const loadGeoJSON = async () => {
    try {
      setLoading(true);
      setError(null);

      // Try to load from cache first
      const cachedData = await getCachedGeoJSON();
      if (cachedData) {
        console.log('Loading GeoJSON from cache');
        setGeoJsonData(cachedData);
        setLoading(false);
        return;
      }

      console.log('Loading GeoJSON from remote URL');
      // Load from remote URL with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(GEOJSON_URL, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch GeoJSON: ${response.status}`);
      }
      
      const rawGeoJSON = await response.json();
      console.log('GeoJSON loaded, features count:', rawGeoJSON.features?.length || 0);

      // Simplify the GeoJSON to improve performance with higher tolerance
      const simplifiedGeoJSON = simplifyGeoJSON(rawGeoJSON, simplificationTolerance);
      console.log('GeoJSON simplified');

      // Cache the simplified data
      await cacheGeoJSON(simplifiedGeoJSON);
      console.log('GeoJSON cached');
      
      setGeoJsonData(simplifiedGeoJSON);
    } catch (err) {
      console.error('Failed to load GeoJSON:', err);
      if (err.name === 'AbortError') {
        setError('Request timed out. Please check your internet connection.');
      } else {
        setError(err.message);
      }
      // Set empty GeoJSON to allow app to continue working
      setGeoJsonData({ type: 'FeatureCollection', features: [] });
    } finally {
      setLoading(false);
    }
  };

  const getCachedGeoJSON = async () => {
    try {
      const cached = await AsyncStorage.getItem(GEOJSON_CACHE_KEY);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      const cacheAge = (now - timestamp) / (1000 * 60 * 60); // hours

      if (cacheAge > CACHE_EXPIRY_HOURS) {
        console.log('Cache expired, removing');
        await AsyncStorage.removeItem(GEOJSON_CACHE_KEY);
        return null;
      }

      console.log('Cache valid, age:', cacheAge.toFixed(2), 'hours');
      return data;
    } catch (error) {
      console.warn('Failed to load cached GeoJSON:', error);
      return null;
    }
  };

  const cacheGeoJSON = async (data) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(GEOJSON_CACHE_KEY, JSON.stringify(cacheData));
      console.log('GeoJSON cached successfully');
    } catch (error) {
      console.warn('Failed to cache GeoJSON:', error);
    }
  };

  // Filter GeoJSON based on map bounds for performance
  const filteredGeoJSON = useMemo(() => {
    if (!geoJsonData || !mapBounds) return geoJsonData;
    
    try {
      return filterGeoJSONByBounds(geoJsonData, mapBounds);
    } catch (error) {
      console.warn('Failed to filter GeoJSON by bounds:', error);
      return geoJsonData;
    }
  }, [geoJsonData, mapBounds]);

  const refreshGeoJSON = () => {
    AsyncStorage.removeItem(GEOJSON_CACHE_KEY);
    loadGeoJSON();
  };

  return {
    geoJsonData: filteredGeoJSON,
    loading,
    error,
    refreshGeoJSON
  };
};