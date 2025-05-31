import React from "react";
import {
  Input,
  Select,
  SelectItem,
  Slider,
  Button,
  Card,
  CardBody,
  Chip,
  Image,
} from "@heroui/react";
import { Icon } from "@iconify/react";

interface PlayerFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedTeam: string;
  onTeamChange: (value: string) => void;
  selectedPosition: string;
  onPositionChange: (value: string) => void;
  selectedCountry: string;
  onCountryChange: (value: string) => void;
  ratingRange: [number, number];
  onRatingRangeChange: (value: number | number[]) => void;
  ageRange: [number, number];
  onAgeRangeChange: (value: number | number[]) => void;
  onClearFilters: () => void;
  teams: Array<{ id: string; name: string }>;
  countries: Array<{ id: string; name: string }>;
  totalPlayers: number;
  filteredPlayers: number;
}

const PLAYER_POSITIONS = [
  { id: "1", name: "GK", fullName: "Goalkeeper" },
  { id: "2", name: "RWB", fullName: "Right Wing Back" },
  { id: "3", name: "RB", fullName: "Right Back" },
  { id: "4", name: "CB", fullName: "Center Back" },
  { id: "5", name: "LB", fullName: "Left Back" },
  { id: "6", name: "LWB", fullName: "Left Wing Back" },
  { id: "7", name: "CDM", fullName: "Defensive Midfielder" },
  { id: "8", name: "RM", fullName: "Right Midfielder" },
  { id: "9", name: "CM", fullName: "Center Midfielder" },
  { id: "10", name: "CAM", fullName: "Attacking Midfielder" },
  { id: "11", name: "LM", fullName: "Left Midfielder" },
  { id: "12", name: "RW", fullName: "Right Winger" },
  { id: "13", name: "RF", fullName: "Right Forward" },
  { id: "14", name: "CF", fullName: "Center Forward" },
  { id: "15", name: "LF", fullName: "Left Forward" },
  { id: "16", name: "LW", fullName: "Left Winger" },
  { id: "17", name: "ST", fullName: "Striker" },
];

export default function PlayerFilters({
  searchTerm,
  onSearchChange,
  selectedTeam,
  onTeamChange,
  selectedPosition,
  onPositionChange,
  selectedCountry,
  onCountryChange,
  ratingRange,
  onRatingRangeChange,
  ageRange,
  onAgeRangeChange,
  onClearFilters,
  teams,
  countries,
  totalPlayers,
  filteredPlayers,
}: PlayerFiltersProps) {
  // Local state for sliders to make them responsive
  const [localRatingRange, setLocalRatingRange] = React.useState<[number, number]>(ratingRange);
  const [localAgeRange, setLocalAgeRange] = React.useState<[number, number]>(ageRange);
  const debounceRef = React.useRef<NodeJS.Timeout>();
  const ageDebounceRef = React.useRef<NodeJS.Timeout>();

  // Update local ranges when external ranges change
  React.useEffect(() => {
    setLocalRatingRange(ratingRange);
  }, [ratingRange]);

  React.useEffect(() => {
    setLocalAgeRange(ageRange);
  }, [ageRange]);

  // Debounced rating change handler
  const handleRatingChange = (value: number | number[]) => {
    const newRange = value as [number, number];
    setLocalRatingRange(newRange);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onRatingRangeChange(newRange);
    }, 300);
  };

  // Debounced age change handler
  const handleAgeChange = (value: number | number[]) => {
    const newRange = value as [number, number];
    setLocalAgeRange(newRange);

    if (ageDebounceRef.current) {
      clearTimeout(ageDebounceRef.current);
    }

    ageDebounceRef.current = setTimeout(() => {
      onAgeRangeChange(newRange);
    }, 300);
  };

  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (ageDebounceRef.current) {
        clearTimeout(ageDebounceRef.current);
      }
    };
  }, []);

  const hasActiveFilters = 
    searchTerm || 
    selectedTeam || 
    selectedPosition || 
    selectedCountry || 
    ratingRange[0] > 0 || 
    ratingRange[1] < 100 ||
    ageRange[0] > 16 ||
    ageRange[1] < 45;

  // Helper function to get team logo URL
  const getTeamLogoUrl = (teamId: string): string => {
    return `http://localhost:8000/images/teams/${teamId}`;
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
            Player Filters & Search
          </h4>
          <div className="flex items-center gap-3">
            <Chip 
              color={filteredPlayers === totalPlayers ? "default" : "primary"} 
              variant="flat"
              size="sm"
            >
              {filteredPlayers} of {totalPlayers} players
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Search by player name */}
          <Input
            label="Search players"
            placeholder="Enter player name..."
            value={searchTerm}
            onValueChange={onSearchChange}
            startContent={<Icon icon="lucide:search" className="h-4 w-4 text-default-400" />}
            isClearable
            className="w-full"
          />

          {/* Filter by team */}
          <Select
            label="Team"
            placeholder="All teams"
            selectedKeys={selectedTeam ? [selectedTeam] : []}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as string;
              onTeamChange(selected || "");
            }}
            className="w-full"
            renderValue={(items) => {
              return items.map((item) => {
                const team = teams.find(t => t.id === item.key);
                if (!team) return <span key={item.key}>{item.textValue}</span>;
                
                return (
                  <div key={item.key} className="flex items-center gap-2">
                    <Image
                      src={getTeamLogoUrl(team.id)}
                      alt={`${team.name} logo`}
                      className="w-5 h-5 object-contain"
                      fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%2306d6a0' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'/%3E%3C/svg%3E"
                    />
                    <span className="truncate">{team.name}</span>
                  </div>
                );
              });
            }}
          >
            {teams.map((team) => (
              <SelectItem 
                key={team.id}
                startContent={
                  <Image
                    src={getTeamLogoUrl(team.id)}
                    alt={`${team.name} logo`}
                    className="w-5 h-5 object-contain"
                    fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%2306d6a0' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'/%3E%3C/svg%3E"
                  />
                }
              >
                {team.name}
              </SelectItem>
            ))}
          </Select>

          {/* Filter by position */}
          <Select
            label="Position"
            placeholder="All positions"
            selectedKeys={selectedPosition ? [selectedPosition] : []}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as string;
              onPositionChange(selected || "");
            }}
            className="w-full"
          >
            {PLAYER_POSITIONS.map((position) => (
              <SelectItem key={position.id} textValue={position.name}>
                <div className="flex flex-col">
                  <span className="font-semibold">{position.name}</span>
                  <span className="text-xs text-default-500">{position.fullName}</span>
                </div>
              </SelectItem>
            ))}
          </Select>

          {/* Filter by country */}
          <Select
            label="Nationality"
            placeholder="All countries"
            selectedKeys={selectedCountry ? [selectedCountry] : []}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as string;
              onCountryChange(selected || "");
            }}
            className="w-full"
            renderValue={(items) => {
              return items.map((item) => {
                const country = countries.find(c => c.id === item.key);
                if (!country) return <span key={item.key}>{item.textValue}</span>;
                
                return (
                  <div key={item.key} className="flex items-center gap-2">
                    <img
                      src={getCountryFlagUrl(country.id)}
                      alt={`Flag of ${country.name}`}
                      className="w-5 h-4 object-cover rounded-sm"
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
                    alt={`Flag of ${country.name}`}
                    className="w-5 h-4 object-cover rounded-sm"
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

          {/* Overall rating range slider */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Overall Rating: {localRatingRange[0]} - {localRatingRange[1]}
            </label>
            <Slider
              step={1}
              minValue={0}
              maxValue={100}
              value={localRatingRange}
              onChange={handleRatingChange}
              className="w-full"
              color="success"
              showTooltip
              tooltipProps={{
                placement: "bottom",
                color: "success",
                content: `${localRatingRange[0]} - ${localRatingRange[1]}`,
              }}
            />
          </div>

          {/* Age range slider */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Age: {localAgeRange[0]} - {localAgeRange[1]}
            </label>
            <Slider
              step={1}
              minValue={16}
              maxValue={45}
              value={localAgeRange}
              onChange={handleAgeChange}
              className="w-full"
              color="primary"
              showTooltip
              tooltipProps={{
                placement: "bottom",
                color: "primary",
                content: `${localAgeRange[0]} - ${localAgeRange[1]} years`,
              }}
            />
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
            {selectedTeam && (
              <Chip
                size="sm"
                variant="flat"
                color="secondary"
                onClose={() => onTeamChange("")}
              >
                Team: {teams.find(t => t.id === selectedTeam)?.name}
              </Chip>
            )}
            {selectedPosition && (
              <Chip
                size="sm"
                variant="flat"
                color="warning"
                onClose={() => onPositionChange("")}
              >
                Position: {PLAYER_POSITIONS.find(p => p.id === selectedPosition)?.name}
              </Chip>
            )}
            {selectedCountry && (
              <Chip
                size="sm"
                variant="flat"
                color="danger"
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
            {(ageRange[0] > 16 || ageRange[1] < 45) && (
              <Chip
                size="sm"
                variant="flat"
                color="primary"
                onClose={() => onAgeRangeChange([16, 45])}
              >
                Age: {localAgeRange[0]}-{localAgeRange[1]}
              </Chip>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
} 