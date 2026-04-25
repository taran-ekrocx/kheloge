'use client';

import { useState, useEffect, useCallback } from 'react';

// Simple venue context via localStorage — in production use React Context
export function useVenue() {
  const [venueId, setVenueId] = useState<string>('');

  useEffect(() => {
    const stored = localStorage.getItem('kheloge_venue_id') || '';
    setVenueId(stored);
  }, []);

  const selectVenue = useCallback((id: string) => {
    localStorage.setItem('kheloge_venue_id', id);
    setVenueId(id);
  }, []);

  return { venueId, selectVenue };
}
