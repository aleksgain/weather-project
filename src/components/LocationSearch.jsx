import { useState, useRef, useId } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { useLocationSearch } from '../hooks/useLocationSearch';

export default function LocationSearch({ onLocationSelect }) {
  const { query, setQuery, results, loading, error, selectLocation, clearResults } =
    useLocationSearch();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const listboxId = useId();

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setIsOpen(true);
    setActiveIndex(-1);
  };

  const handleSelect = (location) => {
    const selected = selectLocation(location);
    setIsOpen(false);
    setActiveIndex(-1);
    if (onLocationSelect) {
      onLocationSelect(selected);
    }
  };

  const handleKeyDown = (e) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Escape') {
        clearResults();
        setIsOpen(false);
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

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          displayName: 'My Location',
        };
        clearResults();
        setIsOpen(false);
        if (onLocationSelect) {
          onLocationSelect(location);
        }
      },
      () => {
        // Geolocation error - silently fail
      }
    );
  };

  const showDropdown = isOpen && (results.length > 0 || loading || error);
  const activeDescendant =
    activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
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
          onBlur={() => {
            // Delay to allow click on dropdown items
            setTimeout(() => setIsOpen(false), 200);
          }}
          placeholder="Search location..."
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
        <button
          onClick={handleUseMyLocation}
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
          {error && (
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
