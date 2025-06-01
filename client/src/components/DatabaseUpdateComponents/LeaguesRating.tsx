import { useState, useEffect, useMemo } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Spinner,
  Chip,
  Badge,
  Pagination,
  Tooltip
} from "@heroui/react";
import { Icon } from "@iconify/react";

interface League {
  tier: number;
  competition: string;
  country: string;
  clubs: number;
  average_market_value: string;
  total_value: string;
}

interface Confederation {
  confederation_name: string;
  leagues: League[];
}

interface LeaguesData {
  confederations: Confederation[];
}

interface CountryLeagues {
  [tier: number]: League[];
}

interface FC25LevelRating {
  average_rating: number;
  team_count: number;
  min_rating: number;
  max_rating: number;
  level: number;
}

interface CountryData {
  country: string;
  leagues: CountryLeagues;
  totalLeagues: number;
  maxTier: number;
  fc25Ratings?: { [level: number]: FC25LevelRating };
}

interface LeaguesRatingProps {
  onClose: () => void;
}

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
} | null;

export default function LeaguesRating({ onClose }: LeaguesRatingProps) {
  const [countryData, setCountryData] = useState<CountryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  
  const rowsPerPage = 20;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load nation mapping
      const nationResponse = await fetch("http://localhost:8000/db/tm_fifa_nation_map");
      if (!nationResponse.ok) {
        throw new Error(`Failed to load nation map: ${nationResponse.status}`);
      }
      const nationData = await nationResponse.json();

      // Load leagues data
      const leaguesResponse = await fetch("http://localhost:8000/db/leagues_from_transfermarkt");
      if (!leaguesResponse.ok) {
        throw new Error(`Failed to load leagues data: ${leaguesResponse.status}`);
      }
      const leagues = await leaguesResponse.json();

      // Load FC25 league ratings
      const fc25Response = await fetch("http://localhost:8000/db/fc25_league_ratings");
      let fc25Ratings = {};
      
      if (fc25Response.ok) {
        fc25Ratings = await fc25Response.json();
      } else {
        console.warn("Failed to load FC25 ratings, continuing without them");
      }

      // Process data to group leagues by country
      processCountryData(leagues, nationData, fc25Ratings);
    } catch (err) {
      console.error("Error loading data:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const processCountryData = (leagues: LeaguesData, nations: Record<string, string>, fc25Ratings: any = {}) => {
    const countryMap = new Map<string, CountryLeagues>();

    // Process all leagues from all confederations
    leagues.confederations.forEach(confederation => {
      confederation.leagues.forEach(league => {
        const country = league.country;
        
        if (!countryMap.has(country)) {
          countryMap.set(country, {});
        }
        
        const countryLeagues = countryMap.get(country)!;
        if (!countryLeagues[league.tier]) {
          countryLeagues[league.tier] = [];
        }
        
        countryLeagues[league.tier].push(league);
      });
    });

    // Convert to array format for table display
    const processedData: CountryData[] = [];
    
    // First add countries that have leagues
    countryMap.forEach((leagues, country) => {
      const maxTier = Math.max(...Object.keys(leagues).map(Number));
      const totalLeagues = Object.values(leagues).reduce((sum, tierLeagues) => sum + tierLeagues.length, 0);
      
      // Get FC25 ratings for this country (now keyed by Transfermarkt country name)
      const countryFC25Ratings = fc25Ratings[country];
      
      processedData.push({
        country,
        leagues,
        totalLeagues,
        maxTier,
        fc25Ratings: countryFC25Ratings
      });
    });

    // Then add countries from nation map that don't have leagues yet
    Object.keys(nations).forEach(country => {
      if (!countryMap.has(country)) {
        processedData.push({
          country,
          leagues: {},
          totalLeagues: 0,
          maxTier: 0
        });
      }
    });

    // Sort by tier 1 market value (descending) regardless of FC25 data
    processedData.sort((a, b) => {
      const aTier1Value = calculateTierValue(a, 1);
      const bTier1Value = calculateTierValue(b, 1);
      
      // Handle countries without tier 1 data (put them at the end)
      if (aTier1Value === -1 && bTier1Value === -1) {
        return a.country.localeCompare(b.country);
      }
      if (aTier1Value === -1) return 1;
      if (bTier1Value === -1) return -1;
      
      // Sort by tier 1 market value (descending)
      if (aTier1Value !== bTier1Value) {
        return bTier1Value - aTier1Value;
      }
      
      // If same tier 1 value, sort by country name
      return a.country.localeCompare(b.country);
    });

    setCountryData(processedData);
  };

  const parseMarketValue = (valueStr: string): number | null => {
    if (!valueStr || valueStr === "—" || valueStr.trim() === "") return null;
    
    // Remove currency symbol and convert to number
    let value = valueStr.replace(/[€$,]/g, '');
    
    if (value.includes('bn')) {
      const parsed = parseFloat(value.replace('bn', ''));
      return isNaN(parsed) ? null : parsed * 1000; // Convert billions to millions
    } else if (value.includes('m')) {
      const parsed = parseFloat(value.replace('m', ''));
      return isNaN(parsed) ? null : parsed;
    } else if (value.includes('k')) {
      const parsed = parseFloat(value.replace('k', ''));
      return isNaN(parsed) ? null : parsed / 1000; // Convert thousands to millions
    }
    
    return null;
  };

  const formatMarketValue = (value: number): string => {
    if (value === 0) return "—";
    
    if (value >= 1000) {
      return `€${(value / 1000).toFixed(2)}bn`;
    } else if (value >= 1) {
      return `€${value.toFixed(0)}m`;
    } else if (value >= 0.001) {
      return `€${(value * 1000).toFixed(0)}k`;
    } else {
      return `€${(value * 1000000).toFixed(0)}`;
    }
  };

  const getAverageMarketValue = (league: League): string => {
    // If average_market_value is available and not "-", use it
    if (league.average_market_value && league.average_market_value !== "-") {
      return league.average_market_value;
    }
    
    // Calculate from total_value and clubs if possible
    if (league.total_value && league.clubs && league.total_value !== "—") {
      const totalValue = parseMarketValue(league.total_value);
      if (totalValue !== null && league.clubs > 0) {
        const averageValue = totalValue / league.clubs;
        return formatMarketValue(averageValue);
      }
    }
    
    return "—";
  };

  const calculateTierValue = (country: CountryData, tier: number): number => {
    const tierLeagues = country.leagues[tier] || [];
    if (tierLeagues.length === 0) return -1; // Put empty tiers at the end
    
    const validValues: number[] = [];
    tierLeagues.forEach(league => {
      const avgValue = getAverageMarketValue(league);
      if (avgValue !== "—") {
        const value = parseMarketValue(avgValue);
        if (value !== null) {
          validValues.push(value);
        }
      }
    });
    
    if (validValues.length === 0) return -1;
    
    // Return average value for multiple leagues, or single value
    return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
  };

  // Regression model for first divisions only - calculated once when component loads
  const getFirstDivisionRegressionModel = useMemo(() => {
    if (!countryData || countryData.length === 0) return null;
    
    // Collect ONLY first division (tier 1) FC25 ratings with their market values
    const trainingData: Array<{ marketValue: number; rating: number }> = [];
    
    countryData.forEach(country => {
      if (country.fc25Ratings && country.fc25Ratings[1]) {
        // Only use tier 1 data
        const tier1Data = country.fc25Ratings[1];
        const marketValue = calculateTierValue(country, 1);
        if (marketValue > 0) {
          trainingData.push({
            marketValue: marketValue,
            rating: tier1Data.average_rating
          });
        }
      }
    });
    
    if (trainingData.length < 3) return null; // Need at least 3 first divisions for regression
    
    // Simple linear regression: rating = a * log(marketValue) + b
    const n = trainingData.length;
    let sumRating = 0, sumLogMarket = 0;
    let sumLogMarketRating = 0, sumLogMarketSq = 0;
    
    trainingData.forEach(point => {
      const logMarket = Math.log(point.marketValue + 1);
      sumRating += point.rating;
      sumLogMarket += logMarket;
      sumLogMarketRating += logMarket * point.rating;
      sumLogMarketSq += logMarket * logMarket;
    });
    
    // Calculate regression coefficients
    const avgRating = sumRating / n;
    const avgLogMarket = sumLogMarket / n;
    
    const marketCoeff = (sumLogMarketRating - n * avgLogMarket * avgRating) / (sumLogMarketSq - n * avgLogMarket * avgLogMarket);
    const intercept = avgRating - marketCoeff * avgLogMarket;
    
    // Calculate R-squared for model quality
    let ssRes = 0, ssTot = 0;
    trainingData.forEach(point => {
      const predicted = marketCoeff * Math.log(point.marketValue + 1) + intercept;
      const residual = point.rating - predicted;
      const totalDev = point.rating - avgRating;
      ssRes += residual * residual;
      ssTot += totalDev * totalDev;
    });
    
    const rSquared = 1 - (ssRes / ssTot);
    
    return {
      marketCoeff,
      intercept,
      rSquared,
      dataPoints: trainingData.length,
      minMarketValue: Math.min(...trainingData.map(d => d.marketValue)),
      maxMarketValue: Math.max(...trainingData.map(d => d.marketValue)),
      minRating: Math.min(...trainingData.map(d => d.rating)),
      maxRating: Math.max(...trainingData.map(d => d.rating))
    };
  }, [countryData]);


  // Calculate average tier 1 to tier 2 drop from existing FC25 data
  const getAverageTier1ToTier2Drop = useMemo(() => {
    if (!countryData || countryData.length === 0) return 8.0; // Default fallback
    
    const drops: number[] = [];
    
    countryData.forEach(country => {
      if (country.fc25Ratings?.[1] && country.fc25Ratings?.[2]) {
        const tier1Rating = country.fc25Ratings[1].average_rating;
        const tier2Rating = country.fc25Ratings[2].average_rating;
        const drop = tier1Rating - tier2Rating;
        drops.push(drop);
      }
    });
    
    if (drops.length === 0) return 8.0; // Default if no data
    
    // Calculate average drop
    const averageDrop = drops.reduce((sum, drop) => sum + drop, 0) / drops.length;
    
    // Debug logging
    console.log(`[DEBUG] Average tier 1→2 drop: ${averageDrop.toFixed(2)} (from ${drops.length} countries: ${drops.map(d => d.toFixed(1)).join(', ')})`);
    
    return Math.max(1, Math.min(15, averageDrop)); // Clamp between 1-15 points
  }, [countryData]);

  // Calculate average tier 2 to tier 3 drop from existing FC25 data
  const getAverageTier2ToTier3Drop = useMemo(() => {
    if (!countryData || countryData.length === 0) return 5.0; // Default fallback
    
    const drops: number[] = [];
    
    countryData.forEach(country => {
      if (country.fc25Ratings?.[2] && country.fc25Ratings?.[3]) {
        const tier2Rating = country.fc25Ratings[2].average_rating;
        const tier3Rating = country.fc25Ratings[3].average_rating;
        const drop = tier2Rating - tier3Rating;
        drops.push(drop);
      }
    });
    
    if (drops.length === 0) return 5.0; // Default if no data
    
    // Calculate average drop
    const averageDrop = drops.reduce((sum, drop) => sum + drop, 0) / drops.length;
    
    // Debug logging
    console.log(`[DEBUG] Average tier 2→3 drop: ${averageDrop.toFixed(2)} (from ${drops.length} countries: ${drops.map(d => d.toFixed(1)).join(', ')})`);
    
    return Math.max(1, Math.min(15, averageDrop)); // Clamp between 1-15 points
  }, [countryData]);

  // Function to get tier 1 rating for a country (either FC25 data or regression prediction)
  const getTier1Rating = (countryName: string): number | null => {
    const targetCountryData = countryData.find(c => c.country === countryName);
    
    // If country has tier 1 FC25 data, use it
    if (targetCountryData?.fc25Ratings?.[1]) {
      return targetCountryData.fc25Ratings[1].average_rating;
    }
    
    // If no tier 1 FC25 data, get tier 1 market value and predict using regression
    if (targetCountryData) {
      const tier1MarketValue = calculateTierValue(targetCountryData, 1);
      if (tier1MarketValue > 0 && getFirstDivisionRegressionModel) {
        const model = getFirstDivisionRegressionModel;
        const logMarketValue = Math.log(tier1MarketValue + 1);
        let prediction = model.marketCoeff * logMarketValue + model.intercept;
        prediction = Math.max(model.minRating - 5, Math.min(model.maxRating + 5, prediction));
        return prediction;
      }
    }
    
    return null;
  };

  // Function to get tier 2 rating for a country (either FC25 data or calculated from tier 1)
  const getTier2Rating = (countryName: string): number | null => {
    const targetCountryData = countryData.find(c => c.country === countryName);
    
    // If country has tier 2 FC25 data, use it
    if (targetCountryData?.fc25Ratings?.[2]) {
      return targetCountryData.fc25Ratings[2].average_rating;
    }
    
    // If no tier 2 FC25 data, calculate from tier 1
    const tier1Rating = getTier1Rating(countryName);
    if (tier1Rating !== null) {
      return tier1Rating - getAverageTier1ToTier2Drop;
    }
    
    return null;
  };

  // Function to get tier 3 rating for a country (either FC25 data or calculated from tier 2)
  const getTier3Rating = (countryName: string): number | null => {
    const targetCountryData = countryData.find(c => c.country === countryName);
    
    // If country has tier 3 FC25 data, use it
    if (targetCountryData?.fc25Ratings?.[3]) {
      return targetCountryData.fc25Ratings[3].average_rating;
    }
    
    // If no tier 3 FC25 data, calculate from tier 2
    const tier2Rating = getTier2Rating(countryName);
    if (tier2Rating !== null) {
      return tier2Rating - getAverageTier2ToTier3Drop;
    }
    
    return null;
  };

  // Function to get tier 4 rating for a country (either FC25 data or calculated from tier 3)
  const getTier4Rating = (countryName: string): number | null => {
    const targetCountryData = countryData.find(c => c.country === countryName);
    
    // If country has tier 4 FC25 data, use it
    if (targetCountryData?.fc25Ratings?.[4]) {
      return targetCountryData.fc25Ratings[4].average_rating;
    }
    
    // If no tier 4 FC25 data, calculate from tier 3 with fixed 3-point drop
    const tier3Rating = getTier3Rating(countryName);
    if (tier3Rating !== null) {
      return tier3Rating - 3;
    }
    
    return null;
  };

  // Function to estimate FC25 rating - regression for tier 1, calculated drop for tier 2 and tier 3
  const estimateFC25Rating = (marketValueInMillions: number, targetTier: number, countryName: string, isDefaultRating = false): number => {
    if (targetTier === 1) {
      // For countries with no market data, use default rating of 50
      if (isDefaultRating) {
        return 50;
      }
      
      // Use regression for tier 1 (first divisions)
      if (!getFirstDivisionRegressionModel) {
        return 60; // Fallback if no regression model
      }
      
      const model = getFirstDivisionRegressionModel;
      const logMarketValue = Math.log(marketValueInMillions + 1);
      let prediction = model.marketCoeff * logMarketValue + model.intercept;
      
      // Clamp prediction within reasonable bounds based on training data
      prediction = Math.max(model.minRating - 5, Math.min(model.maxRating + 5, prediction));
      
      return Math.max(45, Math.min(95, Math.round(prediction * 10) / 10));
    }
    
    if (targetTier === 2) {
      // For tier 2, ALWAYS use tier 1 rating minus fixed drop (ignore tier 2 market value)
      const tier1Rating = getTier1Rating(countryName);
      
      if (tier1Rating !== null) {
        const estimatedTier2 = tier1Rating - getAverageTier1ToTier2Drop;
        
        // Debug logging
        console.log(`[DEBUG ${countryName} Tier 2] Tier 1 rating: ${tier1Rating.toFixed(1)}, Drop: ${getAverageTier1ToTier2Drop.toFixed(1)}, Tier 2: ${estimatedTier2.toFixed(1)}`);
        
        return Math.max(45, Math.min(95, Math.round(estimatedTier2 * 10) / 10));
      }
      
      // Fallback for default rating if no tier 1 available
      if (isDefaultRating) {
        const defaultTier1 = 50;
        const estimatedTier2 = defaultTier1 - getAverageTier1ToTier2Drop;
        return Math.max(45, Math.min(95, Math.round(estimatedTier2 * 10) / 10));
      }
    }
    
    if (targetTier === 3) {
      // For tier 3, use tier 2 rating minus fixed drop (ignore tier 3 market value)
      const tier2Rating = getTier2Rating(countryName);
      
      if (tier2Rating !== null) {
        const estimatedTier3 = tier2Rating - getAverageTier2ToTier3Drop;
        
        // Debug logging
        console.log(`[DEBUG ${countryName} Tier 3] Tier 2 rating: ${tier2Rating.toFixed(1)}, Drop: ${getAverageTier2ToTier3Drop.toFixed(1)}, Tier 3: ${estimatedTier3.toFixed(1)}`);
        
        return Math.max(45, Math.min(95, Math.round(estimatedTier3 * 10) / 10));
      }
      
      // Fallback for default rating if no tier 2 available
      if (isDefaultRating) {
        const defaultTier1 = 50;
        const defaultTier2 = defaultTier1 - getAverageTier1ToTier2Drop;
        const estimatedTier3 = defaultTier2 - getAverageTier2ToTier3Drop;
        return Math.max(45, Math.min(95, Math.round(estimatedTier3 * 10) / 10));
      }
    }
    
    if (targetTier === 4) {
      // For tier 4, use tier 3 rating minus fixed 3-point drop (ignore tier 4 market value)
      const tier3Rating = getTier3Rating(countryName);
      
      if (tier3Rating !== null) {
        const estimatedTier4 = tier3Rating - 3;
        
        // Debug logging
        console.log(`[DEBUG ${countryName} Tier 4] Tier 3 rating: ${tier3Rating.toFixed(1)}, Drop: 3.0, Tier 4: ${estimatedTier4.toFixed(1)}`);
        
        return Math.max(45, Math.min(95, Math.round(estimatedTier4 * 10) / 10));
      }
      
      // Fallback for default rating if no tier 3 available
      if (isDefaultRating) {
        const defaultTier1 = 50;
        const defaultTier2 = defaultTier1 - getAverageTier1ToTier2Drop;
        const defaultTier3 = defaultTier2 - getAverageTier2ToTier3Drop;
        const estimatedTier4 = defaultTier3 - 3;
        return Math.max(45, Math.min(95, Math.round(estimatedTier4 * 10) / 10));
      }
    }
    
    if (targetTier === 5) {
      // For tier 5, use tier 4 rating minus fixed 3-point drop (ignore tier 5 market value)
      const tier4Rating = getTier4Rating(countryName);
      
      if (tier4Rating !== null) {
        const estimatedTier5 = tier4Rating - 3;
        
        // Debug logging
        console.log(`[DEBUG ${countryName} Tier 5] Tier 4 rating: ${tier4Rating.toFixed(1)}, Drop: 3.0, Tier 5: ${estimatedTier5.toFixed(1)}`);
        
        return Math.max(45, Math.min(95, Math.round(estimatedTier5 * 10) / 10));
      }
      
      // Fallback for default rating if no tier 4 available
      if (isDefaultRating) {
        const defaultTier1 = 50;
        const defaultTier2 = defaultTier1 - getAverageTier1ToTier2Drop;
        const defaultTier3 = defaultTier2 - getAverageTier2ToTier3Drop;
        const defaultTier4 = defaultTier3 - 3;
        const estimatedTier5 = defaultTier4 - 3;
        return Math.max(45, Math.min(95, Math.round(estimatedTier5 * 10) / 10));
      }
    }
    
    // Fallback for any other tiers
    return 60;
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
    setPage(1); // Reset to first page when sorting
  };

  const filteredData = useMemo(() => {
    let filtered = countryData;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(country =>
        country.country.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply sorting
    if (sortConfig) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: number;
        let bValue: number;
        
        if (sortConfig.key === 'country') {
          aValue = a.country.localeCompare(b.country);
          bValue = 0;
        } else if (sortConfig.key.startsWith('tier-')) {
          const tier = parseInt(sortConfig.key.split('-')[1]);
          aValue = calculateTierValue(a, tier);
          bValue = calculateTierValue(b, tier);
        } else {
          return 0;
        }
        
        if (sortConfig.key === 'country') {
          return sortConfig.direction === 'asc' ? aValue : -aValue;
        } else {
          // For tier and FC25 rating sorting, handle -1 values (empty values)
          if (aValue === -1 && bValue === -1) return 0;
          if (aValue === -1) return 1; // Put empty values at the end
          if (bValue === -1) return -1;
          
          return sortConfig.direction === 'desc' ? bValue - aValue : aValue - bValue;
        }
      });
    }
    
    return filtered;
  }, [countryData, searchTerm, sortConfig]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredData.slice(start, end);
  }, [filteredData, page, rowsPerPage]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  const renderTierCell = (country: CountryData, tier: number) => {
    const tierLeagues = country.leagues[tier] || [];
    
    // Get FC25 rating for this tier
    const fc25Rating = country.fc25Ratings?.[tier];
    
    if (tierLeagues.length === 0) {
      // If no Transfermarkt leagues but has FC25 rating, show FC25 rating
      if (fc25Rating) {
        return (
          <div className="text-left">
            <Chip
              color="success"
              variant="flat"
              size="sm"
              className="text-xs font-semibold"
            >
              {fc25Rating.average_rating}
            </Chip>
            <div className="text-xs text-default-500 mt-1">
              {fc25Rating.team_count} команд FC25
            </div>
          </div>
        );
      }
      
      // Show default rating for countries with no leagues but still need estimates
      const defaultRating = estimateFC25Rating(0, tier, country.country, true);
      return (
        <div className="text-left">
          <Chip
            color="secondary"
            variant="flat"
            size="sm"
            className="text-xs font-semibold"
          >
            ◊{defaultRating}
          </Chip>
          <div className="text-xs text-default-500 mt-1">
            нет лиг
          </div>
        </div>
      );
    }

    if (tierLeagues.length === 1) {
      // Single league
      const league = tierLeagues[0];
      const avgValue = getAverageMarketValue(league);
      
      if (fc25Rating) {
        // Show FC25 rating in table, market value in tooltip
        return (
          <Tooltip content={`Средняя стоимость: ${avgValue} (${league.clubs} клубов)`}>
            <div className="text-left">
              <Chip
                color="success"
                variant="flat"
                size="sm"
                className="text-xs font-semibold"
              >
                {fc25Rating.average_rating}
              </Chip>
              <div className="text-xs text-default-500 mt-1">
                {fc25Rating.team_count} команд FC25
              </div>
            </div>
          </Tooltip>
        );
      } else {
        // Show market value in table, but if we can estimate rating, show estimated rating with market value in tooltip
        const avgMarketValue = getAverageMarketValue(league);
        const marketValueParsed = parseMarketValue(avgMarketValue);
        
        if (marketValueParsed && marketValueParsed > 0 && (tier === 1 || tier === 2 || tier === 3 || tier === 4 || tier === 5)) {
          // Show estimated ratings for all tiers (tier 1: regression, tiers 2-5: calculated drops)
          const estimatedRating = estimateFC25Rating(marketValueParsed, tier, country.country);
          return (
            <Tooltip content={`Рыночная стоимость: ${avgValue} (${league.clubs} клубов)`}>
              <div className="text-left">
                <Chip
                  color="warning"
                  variant="flat"
                  size="sm"
                  className="text-xs font-semibold"
                >
                  ~{estimatedRating}
                </Chip>
                <div className="text-xs text-default-500 mt-1">
                  {league.clubs} клубов
                </div>
              </div>
            </Tooltip>
          );
        } else {
          // No valid market data - check if it's a dash and show default rating
          if (avgValue === "—") {
            const defaultRating = estimateFC25Rating(0, tier, country.country, true);
            return (
              <div className="text-left">
                <Chip
                  color="secondary"
                  variant="flat"
                  size="sm"
                  className="text-xs font-semibold"
                >
                  ◊{defaultRating}
                </Chip>
                <div className="text-xs text-default-500 mt-1">
                  {league.clubs} клубов
                </div>
              </div>
            );
          } else {
            // Show market value for non-dash cases
            return (
              <div className="text-left">
                <div className="text-sm font-semibold text-foreground">
                  {avgValue}
                </div>
                <div className="text-xs text-default-500">
                  {league.clubs} клубов
                </div>
              </div>
            );
          }
        }
      }
    } else {
      // Multiple leagues - calculate average market value
      const validValues: number[] = [];
      tierLeagues.forEach(league => {
        const avgValue = getAverageMarketValue(league);
        if (avgValue !== "—") {
          const value = parseMarketValue(avgValue);
          if (value !== null) {
            validValues.push(value);
          }
        }
      });
      
      if (validValues.length === 0) {
        // No valid market values found
        if (fc25Rating) {
          return (
            <div className="text-left">
              <Chip
                color="success"
                variant="flat"
                size="sm"
                className="text-xs font-semibold"
              >
                {fc25Rating.average_rating}
              </Chip>
              <div className="text-xs text-default-500 mt-1">
                {fc25Rating.team_count} команд FC25
              </div>
            </div>
          );
        }
        
        // Show default rating for countries with no market data
        const defaultRating = estimateFC25Rating(0, tier, country.country, true);
        return (
          <div className="text-left">
            <Chip
              color="secondary"
              variant="flat"
              size="sm"
              className="text-xs font-semibold"
            >
              ◊{defaultRating}
            </Chip>
            <div className="text-xs text-default-500 mt-1">
              ({tierLeagues.length} лиг)
            </div>
          </div>
        );
      }
      
      const totalValue = validValues.reduce((sum, value) => sum + value, 0);
      const averageValue = totalValue / validValues.length;
      
      if (fc25Rating) {
        // Show FC25 rating in table, market value in tooltip
        return (
          <Tooltip content={`Средняя стоимость: ${formatMarketValue(averageValue)} (${validValues.length}/${tierLeagues.length} лиг)`}>
            <div className="text-left">
              <Chip
                color="success"
                variant="flat"
                size="sm"
                className="text-xs font-semibold"
              >
                {fc25Rating.average_rating}
              </Chip>
              <div className="text-xs text-default-500 mt-1">
                {fc25Rating.team_count} команд FC25
              </div>
            </div>
          </Tooltip>
        );
      } else {
        // Show market value in table, but if we can estimate rating, show estimated rating with market value in tooltip
        if (averageValue > 0 && (tier === 1 || tier === 2 || tier === 3 || tier === 4 || tier === 5)) {
          // Show estimated ratings for all tiers (tier 1: regression, tiers 2-5: calculated drops)
          const estimatedRating = estimateFC25Rating(averageValue, tier, country.country);
          return (
            <Tooltip content={`Рыночная стоимость: ${formatMarketValue(averageValue)} (${validValues.length}/${tierLeagues.length} лиг)`}>
              <div className="text-left">
                <Chip
                  color="warning"
                  variant="flat"
                  size="sm"
                  className="text-xs font-semibold"
                >
                  ~{estimatedRating}
                </Chip>
                <div className="text-xs text-default-500 mt-1">
                  ({validValues.length}/{tierLeagues.length} лиг)
                </div>
              </div>
            </Tooltip>
          );
        } else {
          // No valid market data to estimate from
          return (
            <div className="text-left">
              <div className="text-sm font-semibold text-foreground">
                {formatMarketValue(averageValue)}
              </div>
              <div className="text-xs text-default-500">
                ({validValues.length}/{tierLeagues.length} лиг)
              </div>
            </div>
          );
        }
      }
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardBody className="flex items-center justify-center py-10">
          <Spinner size="lg" label="Загрузка данных о рейтинге лиг..." />
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardBody>
          <div className="text-center py-10">
            <Icon icon="mdi:alert-circle" className="w-16 h-16 text-danger mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-danger mb-2">Ошибка загрузки</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button color="primary" onPress={loadData}>
              Попробовать снова
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  const totalCountries = countryData.length;
  const countriesWithLeagues = countryData.filter(c => c.totalLeagues > 0).length;
  const totalLeagues = countryData.reduce((sum, c) => sum + c.totalLeagues, 0);

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon icon="mdi:trophy-variant" className="w-8 h-8 text-primary" />
            <div>
              <h2 className="text-2xl font-bold">Рейтинг лиг по странам</h2>
              <p className="text-gray-600">FC25 рейтинг для лиг из игры, рыночная стоимость для остальных (наведите для подробностей)</p>
            </div>
          </div>
          <Button 
            color="danger" 
            variant="light" 
            onPress={onClose}
            startContent={<Icon icon="mdi:close" />}
          >
            Закрыть
          </Button>
        </CardHeader>
        <CardBody className="pt-0">
          <div className="flex flex-wrap gap-4 mb-4">
            <Chip color="primary" variant="flat">
              <span className="font-semibold">{totalCountries}</span> стран всего
            </Chip>
            <Chip color="success" variant="flat">
              <span className="font-semibold">{countriesWithLeagues}</span> стран с лигами
            </Chip>
            <Chip color="secondary" variant="flat">
              <span className="font-semibold">{totalLeagues}</span> лиг всего
            </Chip>
            <Chip color="warning" variant="flat">
              <span className="font-semibold">{filteredData.length}</span> показано
            </Chip>
          </div>
          
          <div className="flex items-center gap-3 mb-4 p-3 bg-success-50 border border-success-200 rounded-lg">
            <Icon icon="mdi:gamepad-variant" className="w-5 h-5 text-success-600" />
            <div className="text-sm">
              <span className="font-semibold text-success-800">Легенда:</span>
              <span className="text-success-700 ml-2">
                <Chip color="success" variant="flat" size="sm" className="mx-1">00.0</Chip>
                — рейтинг лиг, представленных в игре FC25
              </span>
              <span className="text-warning-700 ml-4">
                <Chip color="warning" variant="flat" size="sm" className="mx-1">~00.0</Chip>
                — предполагаемый рейтинг (1-й тир: ML модель {getFirstDivisionRegressionModel ? `R² = ${(getFirstDivisionRegressionModel.rSquared * 100).toFixed(1)}%` : '?'}; 2-й тир: дроп {getAverageTier1ToTier2Drop.toFixed(1)} очков; 3-й тир: дроп {getAverageTier2ToTier3Drop.toFixed(1)} очков; 4-й и 5-й тир: дроп по 3 очка)
              </span>
              <span className="text-secondary-700 ml-4">
                <Chip color="secondary" variant="flat" size="sm" className="mx-1">◊00.0</Chip>
                — базовый рейтинг (1-й тир: 50, остальные тиры: расчёт по дропам)
              </span>
            </div>
          </div>
          
          <Input
            placeholder="Поиск по названию страны..."
            value={searchTerm}
            onValueChange={setSearchTerm}
            startContent={<Icon icon="mdi:magnify" />}
            className="max-w-sm"
            isClearable
          />
        </CardBody>
      </Card>

      {/* Table */}
      <Card>
        <CardBody className="p-0">
          <Table 
            aria-label="Таблица рейтинга лиг по странам"
            bottomContent={
              totalPages > 1 ? (
                <div className="flex w-full justify-center">
                  <Pagination
                    isCompact
                    showControls
                    showShadow
                    color="primary"
                    page={page}
                    total={totalPages}
                    onChange={setPage}
                  />
                </div>
              ) : null
            }
          >
            <TableHeader>
              <TableColumn className="w-48">
                <div 
                  className="flex items-center gap-2 cursor-pointer hover:text-primary"
                  onClick={() => handleSort('country')}
                >
                  <Icon icon="mdi:flag" className="w-4 h-4" />
                  Страна
                  {sortConfig?.key === 'country' && (
                    <Icon 
                      icon={sortConfig.direction === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'} 
                      className="w-4 h-4" 
                    />
                  )}
                </div>
              </TableColumn>
              <TableColumn className="w-48">
                <div 
                  className="flex items-center gap-2 cursor-pointer hover:text-primary"
                  onClick={() => handleSort('tier-1')}
                >
                  <Badge content="1" color="primary" size="sm">
                    <Icon icon="mdi:trophy" className="w-4 h-4" />
                  </Badge>
                  Уровень 1
                  {sortConfig?.key === 'tier-1' && (
                    <Icon 
                      icon={sortConfig.direction === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'} 
                      className="w-4 h-4" 
                    />
                  )}
                </div>
              </TableColumn>
              <TableColumn className="w-48">
                <div 
                  className="flex items-center gap-2 cursor-pointer hover:text-primary"
                  onClick={() => handleSort('tier-2')}
                >
                  <Badge content="2" color="secondary" size="sm">
                    <Icon icon="mdi:medal" className="w-4 h-4" />
                  </Badge>
                  Уровень 2
                  {sortConfig?.key === 'tier-2' && (
                    <Icon 
                      icon={sortConfig.direction === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'} 
                      className="w-4 h-4" 
                    />
                  )}
                </div>
              </TableColumn>
              <TableColumn className="w-48">
                <div 
                  className="flex items-center gap-2 cursor-pointer hover:text-primary"
                  onClick={() => handleSort('tier-3')}
                >
                  <Badge content="3" color="warning" size="sm">
                    <Icon icon="mdi:trophy-variant" className="w-4 h-4" />
                  </Badge>
                  Уровень 3
                  {sortConfig?.key === 'tier-3' && (
                    <Icon 
                      icon={sortConfig.direction === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'} 
                      className="w-4 h-4" 
                    />
                  )}
                </div>
              </TableColumn>
              <TableColumn className="w-48">
                <div 
                  className="flex items-center gap-2 cursor-pointer hover:text-primary"
                  onClick={() => handleSort('tier-4')}
                >
                  <Badge content="4" color="success" size="sm">
                    <Icon icon="mdi:trophy-outline" className="w-4 h-4" />
                  </Badge>
                  Уровень 4
                  {sortConfig?.key === 'tier-4' && (
                    <Icon 
                      icon={sortConfig.direction === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'} 
                      className="w-4 h-4" 
                    />
                  )}
                </div>
              </TableColumn>
              <TableColumn className="w-48">
                <div 
                  className="flex items-center gap-2 cursor-pointer hover:text-primary"
                  onClick={() => handleSort('tier-5')}
                >
                  <Badge content="5" color="default" size="sm">
                    <Icon icon="mdi:medal-outline" className="w-4 h-4" />
                  </Badge>
                  Уровень 5
                  {sortConfig?.key === 'tier-5' && (
                    <Icon 
                      icon={sortConfig.direction === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'} 
                      className="w-4 h-4" 
                    />
                  )}
                </div>
              </TableColumn>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="text-center py-10">
                      <Icon icon="mdi:magnify" className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Страны не найдены</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((country, index) => (
                  <TableRow key={index} className={country.totalLeagues === 0 ? "opacity-60" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{country.country}</span>
                        {country.totalLeagues > 0 && (
                          <Chip size="sm" color="primary" variant="flat">
                            {country.totalLeagues} лиг
                          </Chip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{renderTierCell(country, 1)}</TableCell>
                    <TableCell>{renderTierCell(country, 2)}</TableCell>
                    <TableCell>{renderTierCell(country, 3)}</TableCell>
                    <TableCell>{renderTierCell(country, 4)}</TableCell>
                    <TableCell>{renderTierCell(country, 5)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}