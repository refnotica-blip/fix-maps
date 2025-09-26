import { useState, useEffect } from 'react';
import { useGeoJSON } from './useGeoJSON';
import { findWardForPoint } from '../utils/geoUtils';

export const useWards = () => {
  const { geoJsonData, loading, error } = useGeoJSON();

  const findWardByLocation = (latitude, longitude) => {
    try {
      if (!geoJsonData || loading || !latitude || !longitude) return null;
      
      const point = { latitude, longitude };
      const ward = findWardForPoint(point, geoJsonData);
      
      if (ward) {
        return {
          id: ward.properties?.id || ward.properties?.WARD_ID || ward.properties?.ward_id,
          name: ward.properties?.name || ward.properties?.WARD_NAME || ward.properties?.ward_name || `Ward ${ward.properties?.WARD_ID || ward.properties?.ward_id}`,
          municipality: ward.properties?.municipality || ward.properties?.MUNICIPALITY || ward.properties?.mun_name,
          properties: ward.properties,
        };
      }
      
      return null;
    } catch (error) {
      console.warn('Error finding ward by location:', error);
      return null;
    }
  };

  const getAllWards = () => {
    try {
      if (!geoJsonData || loading) return [];
      
      return geoJsonData.features.map(feature => ({
        id: feature.properties?.id || feature.properties?.WARD_ID || feature.properties?.ward_id,
        name: feature.properties?.name || feature.properties?.WARD_NAME || feature.properties?.ward_name || `Ward ${feature.properties?.WARD_ID || feature.properties?.ward_id}`,
        municipality: feature.properties?.municipality || feature.properties?.MUNICIPALITY || feature.properties?.mun_name,
        properties: feature.properties,
        geometry: feature.geometry,
      }));
    } catch (error) {
      console.warn('Error getting all wards:', error);
      return [];
    }
  };

  return {
    geoJsonData,
    loading,
    error,
    findWardByLocation,
    getAllWards,
  };
};