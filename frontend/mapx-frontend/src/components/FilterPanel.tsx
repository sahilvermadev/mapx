import React, { useState } from 'react';
import { FaStar, FaEye, FaEyeSlash, FaTimes } from 'react-icons/fa';
import type { FilterOptions } from '../services/profile';
import { COMMON_GOOGLE_PLACES_TYPES } from '../utils/placeTypes';
import './FilterPanel.css';

type TabType = 'recommendations' | 'likes' | 'saved';

interface FilterPanelProps {
  filters: FilterOptions;
  onFilterChange: (filters: FilterOptions) => void;
  activeTab: TabType;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFilterChange,
  activeTab
}) => {
  const [localFilters, setLocalFilters] = useState<FilterOptions>(filters);

  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    const clearedFilters: FilterOptions = {};
    setLocalFilters(clearedFilters);
    onFilterChange(clearedFilters);
  };

  const hasActiveFilters = Object.values(filters).some(value => 
    value !== undefined && value !== '' && value !== 'all'
  );

  return (
    <div className="filter-panel">
      <div className="filter-header">
        <h3>Filters</h3>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="clear-filters-btn" aria-label="Clear all filters">
            <FaTimes />
            Clear All
          </button>
        )}
      </div>

      <div className="filter-content">
        {/* Rating Filter - Only for recommendations */}
        {activeTab === 'recommendations' && (
          <div className="filter-group">
            <label className="filter-label">
              <FaStar className="filter-icon" />
              Rating
            </label>
            <div className="rating-filter">
              {[5, 4, 3, 2, 1].map(rating => (
                <button
                  key={rating}
                  className={`rating-btn ${filters.rating === rating ? 'active' : ''}`}
                  onClick={() => handleFilterChange('rating', filters.rating === rating ? undefined : rating)}
                  aria-label={`Filter by ${rating} star rating`}
                >
                  {rating}+
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Visibility Filter - Only for recommendations */}
        {activeTab === 'recommendations' && (
          <div className="filter-group">
            <label className="filter-label">
              <FaEye className="filter-icon" />
              Visibility
            </label>
            <div className="visibility-filter">
              <button
                className={`visibility-btn ${filters.visibility === 'all' || !filters.visibility ? 'active' : ''}`}
                onClick={() => handleFilterChange('visibility', 'all')}
              >
                All
              </button>
              <button
                className={`visibility-btn ${filters.visibility === 'public' ? 'active' : ''}`}
                onClick={() => handleFilterChange('visibility', 'public')}
              >
                <FaEye />
                Public
              </button>
              <button
                className={`visibility-btn ${filters.visibility === 'friends' ? 'active' : ''}`}
                onClick={() => handleFilterChange('visibility', 'friends')}
              >
                <FaEyeSlash />
                Friends Only
              </button>
            </div>
          </div>
        )}

        {/* Category Filter */}
        <div className="filter-group">
          <label className="filter-label">Category</label>
          <select
            value={filters.category || ''}
            onChange={(e) => handleFilterChange('category', e.target.value || undefined)}
            className="category-select"
          >
            <option value="">All Categories</option>
            {COMMON_GOOGLE_PLACES_TYPES.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range Filter */}
        <div className="filter-group">
          <label className="filter-label">Date Range</label>
          <div className="date-range">
            <input
              type="date"
              value={filters.date_from || ''}
              onChange={(e) => handleFilterChange('date_from', e.target.value || undefined)}
              className="date-input"
              placeholder="From"
            />
            <span className="date-separator">to</span>
            <input
              type="date"
              value={filters.date_to || ''}
              onChange={(e) => handleFilterChange('date_to', e.target.value || undefined)}
              className="date-input"
              placeholder="To"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel; 