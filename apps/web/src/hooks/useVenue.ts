'use client';

import { useState, useEffect, useCallback } from 'react';

const VENUE_KEY = 'kheloge_venue_id';
const VENUE_CHANGE_EVENT = 'kheloge-venue-change';

export function useVenue() {
  const [venueId, setVenueId] = useState<string>('');

  useEffect(() => {
    const stored = localStorage.getItem(VENUE_KEY) || '';
    setVenueId(stored);

    const handler = (e: Event) => {
      setVenueId((e as CustomEvent<string>).detail);
    };
    window.addEventListener(VENUE_CHANGE_EVENT, handler);
    return () => window.removeEventListener(VENUE_CHANGE_EVENT, handler);
  }, []);

  const selectVenue = useCallback((id: string) => {
    localStorage.setItem(VENUE_KEY, id);
    setVenueId(id);
    window.dispatchEvent(new CustomEvent<string>(VENUE_CHANGE_EVENT, { detail: id }));
  }, []);

  return { venueId, selectVenue };
}
