import { useState, useRef, useId, useEffect, useCallback } from 'react';
import { Search, MapPin, Loader2, X } from 'lucide-react';
import { searchLocations } from '../utils/nominatim';

export default function LocationSearch({ currentLocation, isManual, onLocationSelect, onReset }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);
  const controllerRef = useRef(null);
  const listboxId = useId();

  // Abort in-flight request and clear debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (controllerRef.current) controllerRef.current.abort();
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.trim().length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }

    if (controllerRef.current) controllerRef.current.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const data = await searchLocations(searchQuery, { signal: controller.signal });
      if (!controller.signal.aborted) {
        setResults(data);
        setLoading(false);
        if (data.length === 0) {
          setError('No locations found');
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError' && !controller.signal.aborted) {
        setError(err.message || 'Search failed');
        setLoading(false);
      }
    }
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setIsOpen(true);
    setActiveIndex(-1);
    setError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  const handleSelect = (location) => {
    const name = location.displayName
      ? location.displayName.split(',')[0]
      : `${location.lat.toFixed(2)}, ${location.lon.toFixed(2)}`;
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
    if (onLocationSelect) {
      onLocationSelect({ lat: location.lat, lon: location.lon, name });
    }
  };

  const handleKeyDown = (e) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Escape') {
        setQuery('');
        setResults([]);
        setIsOpen(false);
        setError(null);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < results.length) {
          handleSelect(results[activeIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  const handleReset = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setError(null);
    if (onReset) onReset();
  };

  const showDropdown = isOpen && (results.length > 0 || loading || error);
  const activeDescendant =
    activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          padding: 'var(--spacing-sm) var(--spacing-md)',
          borderRadius: 'var(--card-radius-sm)',
          border: '1px solid var(--glass-border)',
        }}
      >
        {loading ? (
          <Loader2
            size={18}
            color="var(--text-muted)"
            style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}
            aria-hidden="true"
          />
        ) : (
          <Search size={18} color="var(--text-muted)" aria-hidden="true" style={{ flexShrink: 0 }} />
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={currentLocation || 'Search location...'}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-activedescendant={activeDescendant}
          aria-autocomplete="list"
          aria-label="Search for a location"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: '0.9375rem',
            fontFamily: 'inherit',
          }}
        />
        {isManual && (
          <button
            onClick={handleReset}
            aria-label="Use my current location"
            title="Use my location"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 'var(--spacing-xs)',
              borderRadius: 'var(--card-radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              transition: 'color 0.2s ease',
              flexShrink: 0,
            }}
          >
            <MapPin size={18} />
          </button>
        )}
      </div>

      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Location search results"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 'var(--spacing-xs)',
            padding: 'var(--spacing-xs)',
            listStyle: 'none',
            zIndex: 100,
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--card-radius-sm)',
            maxHeight: '240px',
            overflowY: 'auto',
          }}
        >
          {loading && (
            <li
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                color: 'var(--text-muted)',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)',
              }}
            >
              <Loader2
                size={14}
                style={{ animation: 'spin 1s linear infinite' }}
                aria-hidden="true"
              />
              Searching...
            </li>
          )}
          {error && !loading && (
            <li
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                color: 'var(--accent-orange)',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </li>
          )}
          {!loading &&
            !error &&
            results.map((result, index) => (
              <li
                key={`${result.lat}-${result.lon}`}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={() => handleSelect(result)}
                onMouseEnter={() => setActiveIndex(index)}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  borderRadius: 'calc(var(--card-radius-sm) / 2)',
                  background:
                    index === activeIndex
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'transparent',
                  transition: 'background 0.15s ease',
                }}
              >
                {result.displayName}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
