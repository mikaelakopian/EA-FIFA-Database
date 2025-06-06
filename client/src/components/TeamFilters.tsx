import React from "react";
import {
  Input,
  Select,
  SelectItem,
  Button,
  Card,
  CardBody,
  Chip,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { RangeSlider } from "./RangeSlider";

interface TeamFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedLeague: string;
  onLeagueChange: (value: string) => void;
  selectedCountry: string;
  onCountryChange: (value: string) => void;
  ratingRange: [number, number];
  onRatingRangeChange: (value: number | number[]) => void;
  onClearFilters: () => void;
  leagues: Array<{ id: string; name: string }>;
  countries: Array<{ id: string; name: string }>;
  totalTeams: number;
  filteredTeams: number;
}


export const TeamFilters = ({
  searchTerm,
  onSearchChange,
  selectedLeague,
  onLeagueChange,
  selectedCountry,
  onCountryChange,
  ratingRange,
  onRatingRangeChange,
  onClearFilters,
  leagues,
  countries,
  totalTeams,
  filteredTeams,
}: TeamFiltersProps) => {
  const [localRatingRange, setLocalRatingRange] = React.useState<[number, number]>(ratingRange);

  React.useEffect(() => {
    setLocalRatingRange(ratingRange);
  }, [ratingRange]);

  // Simple rating change handler
  const handleRatingChange = (value: number | number[]) => {
    const newRange = value as [number, number];
    onRatingRangeChange(newRange);
  };

  const handleLocalRatingChange = (value: [number, number]) => {
    setLocalRatingRange(value);
  };

  const hasActiveFilters = searchTerm || selectedLeague || selectedCountry || ratingRange[0] > 0 || ratingRange[1] < 100;

  // Helper function to get league logo URL
  const getLeagueLogoUrl = (leagueId: string): string => {
    return `http://localhost:8000/images/leagues/${leagueId}`;
  };

  // Helper function to get country flag URL
  const getCountryFlagUrl = (countryId: string): string => {
    return `http://localhost:8000/images/flags/${countryId}`;
  };

  return (
      <Card className="mb-6">
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold flex items-center gap-2">
              <Icon icon="lucide:filter" className="h-5 w-5" />
              Filters & Search
            </h4>
            <div className="flex items-center gap-3">
              <Chip 
                color={filteredTeams === totalTeams ? "default" : "primary"} 
                variant="flat"
                size="sm"
              >
                {filteredTeams} of {totalTeams} teams
              </Chip>
              {hasActiveFilters && (
                <Button
                  size="sm"
                  variant="flat"
                  color="warning"
                  startContent={<Icon icon="lucide:x" className="h-4 w-4" />}
                  onPress={onClearFilters}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search by team name */}
            <Input
              label="Search teams"
              placeholder="Enter team name..."
              value={searchTerm}
              onValueChange={onSearchChange}
              startContent={<Icon icon="lucide:search" className="h-4 w-4 text-default-400" />}
              isClearable
              className="w-full"
              aria-label="Search teams by name"
            />

            {/* Filter by league */}
            <Select
              label="League"
              placeholder="All leagues"
              selectedKeys={selectedLeague ? [selectedLeague] : []}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                onLeagueChange(selected || "");
              }}
              className="w-full"
              aria-label="Filter teams by league"
              renderValue={(items) => {
                return items.map((item) => {
                  const league = leagues.find(l => l.id === item.key);
                  if (!league) return <span key={item.key}>{item.textValue}</span>;
                  
                  return (
                    <div key={item.key} className="flex items-center gap-2">
                      <img
                        src={getLeagueLogoUrl(league.id)}
                        alt={`${league.name} logo`}
                        className="w-5 h-5 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <span className="truncate">{league.name}</span>
                    </div>
                  );
                });
              }}
            >
              {leagues.map((league) => (
                <SelectItem 
                  key={league.id}
                  startContent={
                    <img
                      src={getLeagueLogoUrl(league.id)}
                      alt={`${league.name} logo`}
                      className="w-5 h-5 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  }
                >
                  {league.name}
                </SelectItem>
              ))}
            </Select>

            {/* Filter by country */}
            <Select
              label="Country"
              placeholder="All countries"
              selectedKeys={selectedCountry ? [selectedCountry] : []}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                onCountryChange(selected || "");
              }}
              className="w-full"
              aria-label="Filter teams by country"
              renderValue={(items) => {
                return items.map((item) => {
                  const country = countries.find(c => c.id === item.key);
                  if (!country) return <span key={item.key}>{item.textValue}</span>;
                  
                  return (
                    <div key={item.key} className="flex items-center gap-2">
                      <img
                        src={getCountryFlagUrl(country.id)}
                        alt={`${country.name} flag`}
                        className="w-5 h-3 object-cover rounded-sm"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <span className="truncate">{country.name}</span>
                    </div>
                  );
                });
              }}
            >
              {countries.map((country) => (
                <SelectItem 
                  key={country.id}
                  startContent={
                    <img
                      src={getCountryFlagUrl(country.id)}
                      alt={`${country.name} flag`}
                      className="w-5 h-3 object-cover rounded-sm"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  }
                >
                  {country.name}
                </SelectItem>
              ))}
            </Select>

            {/* Rating range slider */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Overall Rating: {localRatingRange[0]} - {localRatingRange[1]}
              </label>
              <div className="w-full">
                <RangeSlider
                  value={ratingRange}
                  onChange={handleRatingChange}
                  onLocalChange={handleLocalRatingChange}
                  min={0}
                  max={100}
                  step={1}
                  color="success"
                  showTooltip={true}
                  label="Team overall rating range filter"
                />
              </div>
            </div>
          </div>

          {/* Active filters display */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-default-200">
              <span className="text-sm text-default-600 self-center">Active filters:</span>
              {searchTerm && (
                <Chip
                  size="sm"
                  variant="flat"
                  color="primary"
                  onClose={() => onSearchChange("")}
                >
                  Name: {searchTerm}
                </Chip>
              )}
              {selectedLeague && (
                <Chip
                  size="sm"
                  variant="flat"
                  color="secondary"
                  onClose={() => onLeagueChange("")}
                >
                  League: {leagues.find(l => l.id === selectedLeague)?.name}
                </Chip>
              )}
              {selectedCountry && (
                <Chip
                  size="sm"
                  variant="flat"
                  color="warning"
                  onClose={() => onCountryChange("")}
                >
                  Country: {countries.find(c => c.id === selectedCountry)?.name}
                </Chip>
              )}
              {(ratingRange[0] > 0 || ratingRange[1] < 100) && (
                <Chip
                  size="sm"
                  variant="flat"
                  color="success"
                  onClose={() => onRatingRangeChange([0, 100])}
                >
                  Rating: {localRatingRange[0]}-{localRatingRange[1]}
                </Chip>
              )}
            </div>
          )}
        </CardBody>
      </Card>
  );
};