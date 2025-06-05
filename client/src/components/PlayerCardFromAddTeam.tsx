import { useState, useEffect, useRef, memo, useMemo, useCallback } from "react";
import { 
  Card, 
  CardBody, 
  Image, 
  Dropdown, 
  DropdownTrigger, 
  DropdownMenu, 
  DropdownItem, 
  Popover, 
  PopoverTrigger, 
  PopoverContent, 
  Button,
  Chip 
} from "@heroui/react";
import { Icon } from "@iconify/react";

// Position mappings based on db_positions.json
const POSITION_MAPPINGS: { [key: string]: string } = {
  "Goalkeeper": "GK",
  "goalkeeper": "GK",
  "GK": "GK",
  "Sweeper": "CB",
  "sweeper": "CB",
  "Centre-Back": "CB",
  "centre-back": "CB",
  "Center-Back": "CB",
  "center-back": "CB",
  "CB": "CB",
  "Left-Back": "LB",
  "left-back": "LB",
  "LB": "LB",
  "Right-Back": "RB",
  "right-back": "RB",
  "RB": "RB",
  "Defensive Midfield": "CDM",
  "defensive midfield": "CDM",
  "CDM": "CDM",
  "Central Midfield": "CM",
  "central midfield": "CM",
  "CM": "CM",
  "Right Midfield": "RM",
  "right midfield": "RM",
  "RM": "RM",
  "Left Midfield": "LM",
  "left midfield": "LM",
  "LM": "LM",
  "Attacking Midfield": "CAM",
  "attacking midfield": "CAM",
  "CAM": "CAM",
  "Left Winger": "LW",
  "left winger": "LW",
  "LW": "LW",
  "Right Winger": "RW",
  "right winger": "RW",
  "RW": "RW",
  "Second Striker": "CF",
  "second striker": "CF",
  "CF": "CF",
  "Centre-Forward": "ST",
  "centre-forward": "ST",
  "Center-Forward": "ST",
  "center-forward": "ST",
  "ST": "ST",
  "Striker": "ST",
  "striker": "ST"
};

const getPositionAbbreviation = (position: string): string => {
  if (!position) return "CM";
  return POSITION_MAPPINGS[position] || POSITION_MAPPINGS[position.toLowerCase()] || position.toUpperCase().slice(0, 3);
};

// Nation mappings based on tm_fifa_nation_map.json
const NATION_MAPPINGS: { [key: string]: string } = {
  "Afghanistan": "149",
  "Albania": "1",
  "Algeria": "97",
  "American Samoa": "194",
  "American Virgin Islands": "96",
  "Andorra": "2",
  "Angola": "98",
  "Anguilla": "62",
  "Antigua and Barbuda": "63",
  "Argentina": "52",
  "Armenia": "3",
  "Aruba": "64",
  "Australia": "195",
  "Austria": "4",
  "Azerbaijan": "5",
  "Bahamas": "65",
  "Bahrain": "150",
  "Bangladesh": "151",
  "Barbados": "66",
  "Belarus": "6",
  "Belgium": "7",
  "Belize": "67",
  "Benin": "99",
  "Bermuda": "68",
  "Bhutan": "152",
  "Bolivia": "53",
  "Bosnia-Herzegovina": "8",
  "Botswana": "100",
  "Brazil": "54",
  "British Virgin Islands": "69",
  "Brunei Darussalam": "153",
  "Bulgaria": "9",
  "Burkina Faso": "101",
  "Burundi": "102",
  "Cambodia": "154",
  "Cameroon": "103",
  "Canada": "70",
  "Cape Verde": "104",
  "Cayman Islands": "71",
  "Central African Republic": "105",
  "Chad": "106",
  "Chile": "55",
  "China": "155",
  "Chinese Taipei": "213",
  "Colombia": "56",
  "Comoros": "214",
  "Congo": "107",
  "Cookinseln": "196",
  "Costa Rica": "72",
  "Cote d'Ivoire": "108",
  "Croatia": "10",
  "Cuba": "73",
  "Curacao": "85",
  "Cyprus": "11",
  "Czech Republic": "12",
  "Denmark": "13",
  "Djibouti": "109",
  "Dominica": "74",
  "Dominican Republic": "207",
  "DR Congo": "110",
  "Ecuador": "57",
  "Egypt": "111",
  "El Salvador": "76",
  "England": "14",
  "Equatorial Guinea": "112",
  "Eritrea": "113",
  "Estonia": "208",
  "eSwatini": "142",
  "Ethiopia": "114",
  "Faroe Islands": "16",
  "Fiji": "197",
  "Finland": "17",
  "France": "18",
  "Gabon": "115",
  "Georgia": "20",
  "Germany": "21",
  "Ghana": "117",
  "Gibraltar": "205",
  "Greece": "22",
  "Greenland": "206",
  "Grenada": "77",
  "Guadeloupe": "18",
  "Guam": "157",
  "Guatemala": "78",
  "Guinea": "118",
  "Guinea-Bissau": "119",
  "Guyana": "79",
  "Haiti": "80",
  "Honduras": "81",
  "Hongkong": "158",
  "Hungary": "23",
  "Iceland": "102",
  "India": "159",
  "Indonesia": "160",
  "Iran": "161",
  "Iraq": "162",
  "Ireland": "25",
  "Israel": "26",
  "Italy": "27",
  "Jamaica": "82",
  "Japan": "163",
  "Jordan": "164",
  "Kazakhstan": "165",
  "Kenya": "120",
  "Korea, North": "166",
  "Korea, South": "167",
  "Kosovo": "219",
  "Kuwait": "168",
  "Kyrgyzstan": "169",
  "Laos": "170",
  "Latvia": "28",
  "Lebanon": "171",
  "Lesotho": "121",
  "Liberia": "122",
  "Libya": "123",
  "Liechtenstein": "29",
  "Lithuania": "30",
  "Luxembourg": "31",
  "Macao": "172",
  "Madagascar": "124",
  "Malawi": "125",
  "Malaysia": "173",
  "Maldives": "174",
  "Mali": "126",
  "Malta": "32",
  "Martinique": "18",
  "Mauritania": "127",
  "Mauritius": "128",
  "Mexico": "83",
  "Moldova": "33",
  "Mongolia": "175",
  "Montenegro": "15",
  "Montserrat": "84",
  "Morocco": "129",
  "Mozambique": "130",
  "Myanmar": "176",
  "Namibia": "131",
  "Nepal": "177",
  "Netherlands": "34",
  "Neukaledonien": "215",
  "New Zealand": "198",
  "Nicaragua": "86",
  "Niger": "132",
  "Nigeria": "133",
  "North Macedonia": "19",
  "Northern Ireland": "35",
  "Norway": "36",
  "Oman": "178",
  "Pakistan": "179",
  "Palestine": "180",
  "Panama": "87",
  "Papua New Guinea": "199",
  "Paraguay": "58",
  "Peru": "59",
  "Philippines": "181",
  "Poland": "37",
  "Portugal": "38",
  "Puerto Rico": "88",
  "Qatar": "182",
  "Romania": "39",
  "Russia": "40",
  "Rwanda": "134",
  "Saint-Martin": "18",
  "Samoa": "200",
  "San Marino": "41",
  "Sao Tome and Principe": "135",
  "Saudi Arabia": "183",
  "Scotland": "42",
  "Senegal": "136",
  "Serbia": "51",
  "Seychelles": "137",
  "Sierra Leone": "138",
  "Singapore": "184",
  "Sint Maarten": "34",
  "Slovakia": "43",
  "Slovenia": "44",
  "Solomon Islands": "201",
  "Somalia": "139",
  "South Africa": "140",
  "Southern Sudan": "218",
  "Spain": "45",
  "Sri Lanka": "185",
  "St. Kitts & Nevis": "89",
  "St. Lucia": "90",
  "St. Vincent & Grenadinen": "91",
  "Sudan": "141",
  "Suriname": "92",
  "Sweden": "46",
  "Switzerland": "47",
  "Syria": "186",
  "Tahiti": "202",
  "Tajikistan": "187",
  "Tanzania": "143",
  "Thailand": "188",
  "The Gambia": "116",
  "Timor-Leste": "212",
  "Togo": "144",
  "Tonga": "203",
  "Trinidad and Tobago": "93",
  "Tunisia": "145",
  "Türkiye": "48",
  "Turkey": "48",
  "Turkmenistan": "189",
  "Turks- and Caicosinseln": "94",
  "Uganda": "146",
  "Ukraine": "49",
  "United Arab Emirates": "190",
  "United States": "95",
  "Uruguay": "60",
  "Uzbekistan": "191",
  "Vanuatu": "204",
  "Venezuela": "61",
  "Vietnam": "192",
  "Wales": "50",
  "Yemen": "193",
  "Zambia": "147",
  "Zimbabwe": "148"
};

const getNationId = (nationality: string): string => {
  if (!nationality) return "211"; // Rest of World fallback
  return NATION_MAPPINGS[nationality] || "211";
};

// Function to format market value for better display
const formatMarketValue = (value: string): string => {
  if (!value || value === "-" || value === "" || value.toLowerCase() === "n/a") {
    return "N/A";
  }
  
  // If it's already formatted (contains currency symbols), return as is
  if (value.includes('€') || value.includes('$') || value.includes('m') || value.includes('k')) {
    return value;
  }
  
  // Try to parse as number and format
  const numValue = parseFloat(value.replace(/[^0-9.]/g, ''));
  if (isNaN(numValue)) {
    return value; // Return original if can't parse
  }
  
  if (numValue >= 1000000) {
    return `€${(numValue / 1000000).toFixed(1)}m`;
  } else if (numValue >= 1000) {
    return `€${(numValue / 1000).toFixed(0)}k`;
  } else {
    return `€${numValue.toFixed(0)}`;
  }
};

interface PlayerSaveStatus {
  name: string;
  status: "pending" | "saving" | "saved" | "error";
  error?: string;
  overall_rating?: number;
  potential?: number;
  position?: string;
}

interface TransfermarktTeam {
  teamname: string;
  teamlogo: string;
  team_url: string;
  team_id: string;
  squad: number;
  avg_age: number;
  foreigners: number;
  avg_market_value: string;
  total_market_value: string;
}

interface PlayerCardFromAddTeamProps {
  player: PlayerSaveStatus;
  playerIndex: number;
  currentTeam: TransfermarktTeam;
  basePlayerData?: any;
  isCurrentPlayer?: boolean;
  displayOverallRating?: number;
  displayPotential?: number;
  displayStatus: "pending" | "saving" | "saved" | "error";
  leagueId?: string;
  projectId?: string;
}

// Improved animated counter with autonomous animation logic
function useAnimatedCounter(end: number, duration: number = 1000, startDelay: number = 0) {
  const [displayValue, setDisplayValue] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const startValueRef = useRef<number>(1);
  const previousEndRef = useRef<number | undefined>(undefined);
  const hasAnimatedRef = useRef<boolean>(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef<boolean>(false);
  const debugIdRef = useRef<string>(Math.random().toString(36).substr(2, 4));
  const callCountRef = useRef<number>(0);
  const lastCallTimeRef = useRef<number>(0);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingEndRef = useRef<number | null>(null);

  // Mark as mounted to handle initial renders properly
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Track call frequency and rapid calls
    const now = performance.now();
    const timeSinceLastCall = now - lastCallTimeRef.current;
    callCountRef.current++;
    lastCallTimeRef.current = now;
    
    // Debug logging for first element issues - add identifier to track specific instances
    const debugId = debugIdRef.current;
    const isRapidCall = timeSinceLastCall < 100; // Less than 100ms between calls
    
    console.log(`🚨 [useAnimatedCounter-${debugId}] CALL #${callCountRef.current} with end=${end}, previous=${previousEndRef.current}, displayValue=${displayValue}, mounted=${mountedRef.current}, timeSince=${timeSinceLastCall.toFixed(1)}ms, RAPID=${isRapidCall}`);

    // Cancel any existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    // Handle invalid or zero values - but don't animate
    if (!end || end <= 1) {
      console.log(`[useAnimatedCounter-${debugId}] Invalid end value: ${end}, setting displayValue to 1`);
      if (mountedRef.current) {
        setDisplayValue(1);
        setIsAnimating(false);
      }
      // Only update previousEndRef for 0 to track state, but not for undefined/null
      if (end === 0) {
        previousEndRef.current = end;
      }
      return;
    }

    // Check if this is a new rating that should trigger animation
    const isNewRating = previousEndRef.current !== end;
    
    console.log(`[useAnimatedCounter-${debugId}] isNewRating=${isNewRating}, previous=${previousEndRef.current}, new=${end}`);
    
    if (!isNewRating) {
      // Same rating, no need to animate - but ensure we show the correct value
      if (mountedRef.current && displayValue !== end) {
        console.log(`[useAnimatedCounter-${debugId}] Same rating but different display, updating ${displayValue} -> ${end}`);
        setDisplayValue(end);
      }
      if (mountedRef.current) {
        setIsAnimating(false);
      }
      return;
    }

    // Store pending end value for debouncing
    pendingEndRef.current = end;

    // Debounce rapid calls - wait for calls to settle before starting animation
    const processAnimation = () => {
      const finalEnd = pendingEndRef.current;
      if (!finalEnd || finalEnd <= 1 || !mountedRef.current) return;

      // Cancel any existing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      // Update previous end value to track changes
      previousEndRef.current = finalEnd;
      console.log(`[useAnimatedCounter-${debugId}] DEBOUNCED: Starting animation from ${displayValue} to ${finalEnd}`);

      // Start animation
      const startAnimation = () => {
        if (!mountedRef.current) return;
        
        console.log(`[useAnimatedCounter-${debugId}] Animation ACTUALLY starting: ${1} -> ${finalEnd}`);
        setIsAnimating(true);
        startTimeRef.current = performance.now();
        startValueRef.current = 1;
        setDisplayValue(1);
        
        const animate = (currentTime: number) => {
          if (!mountedRef.current) return;
          
          const elapsed = currentTime - startTimeRef.current;
          const progress = Math.min(elapsed / duration, 1);
          
          // Use smooth easing
          const easeProgress = progress * (2 - progress); // easeOutQuad
          const current = Math.round(startValueRef.current + (finalEnd - startValueRef.current) * easeProgress);
          
          setDisplayValue(current);

          if (progress < 1) {
            animationRef.current = requestAnimationFrame(animate);
          } else {
            console.log(`[useAnimatedCounter-${debugId}] Animation COMPLETED: ${current} -> ${finalEnd}`);
            if (mountedRef.current) {
              setDisplayValue(finalEnd); // Ensure we end with exact value
              setIsAnimating(false);
            }
            animationRef.current = null;
            hasAnimatedRef.current = true;
          }
        };

        animationRef.current = requestAnimationFrame(animate);
      };

      if (startDelay > 0) {
        timeoutRef.current = setTimeout(startAnimation, startDelay);
      } else {
        startAnimation();
      }
    };

    // Debounce: wait for rapid calls to settle
    const debounceDelay = isRapidCall ? 150 : 0; // 150ms debounce for rapid calls
    if (debounceDelay > 0) {
      console.log(`[useAnimatedCounter-${debugId}] RAPID CALL DETECTED - debouncing for ${debounceDelay}ms`);
      debounceTimeoutRef.current = setTimeout(processAnimation, debounceDelay);
    } else {
      processAnimation();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [end, duration, startDelay]);

  return { count: displayValue, isAnimating };
}

// Function to fetch calculated rating from server
async function fetchCalculatedRating(playerData: any, leagueId?: string, projectId?: string) {
  try {
    const response = await fetch('http://localhost:8000/players/calculate-rating', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        player_data: {
          player_name: playerData?.name,
          market_value_eur: playerData?.value || playerData?.market_value_eur,
          player_position: playerData?.position,
          date_of_birth_age: playerData?.age || playerData?.date_of_birth_age,
          player_nationality: playerData?.nationality
        },
        league_id: leagueId,
        project_id: projectId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error fetching calculated rating:', error);
    return null;
  }
}

// Function to fetch real rating breakdown from server
async function fetchRatingBreakdown(playerData: any, leagueId?: string, projectId?: string, existingRating?: number) {
  try {
    // Debug logging to see what values we're sending (can be removed in production)
    console.log('[Rating Breakdown] Request data:', {
      player_name: playerData?.name,
      league_id: leagueId,
      project_id: projectId,
      existing_rating: existingRating
    });
    
    const response = await fetch('http://localhost:8000/players/rating-breakdown', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        player_data: {
          player_name: playerData?.name,
          market_value_eur: playerData?.value || playerData?.market_value_eur,
          player_position: playerData?.position,
          date_of_birth_age: playerData?.age || playerData?.date_of_birth_age,
          player_nationality: playerData?.nationality
        },
        league_id: leagueId,
        project_id: projectId,
        existing_rating: existingRating
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result.breakdown;
  } catch (error) {
    console.error('Error fetching rating breakdown:', error);
    // Fallback to mock data
    return {
      breakdown: {
        components: [
          { name: "Базовый рейтинг лиги", value: 65, description: "Данные недоступны (ошибка сервера)" },
          { name: "Бонус за стоимость", value: 0, description: "Данные недоступны" },
          { name: "Множитель позиции", value: "×1.0", description: "Данные недоступны" },
          { name: "Модификатор возраста", value: 0, description: "Данные недоступны" },
        ]
      }
    };
  }
}

function PlayerCardFromAddTeam({
  player,
  playerIndex,
  currentTeam,
  basePlayerData,
  isCurrentPlayer = false,
  displayOverallRating,
  displayPotential,
  displayStatus,
  leagueId,
  projectId
}: PlayerCardFromAddTeamProps) {
  const [isRatingBreakdownOpen, setIsRatingBreakdownOpen] = useState(false);
  const [ratingBreakdown, setRatingBreakdown] = useState<any>(null);
  const [isLoadingBreakdown, setIsLoadingBreakdown] = useState(false);
  const [calculatedRating, setCalculatedRating] = useState<number | undefined>(
    displayStatus === 'saved' ? displayOverallRating : undefined
  );
  // Keep track of last valid rating to prevent disappearing
  const [lastValidRating, setLastValidRating] = useState<number | undefined>(undefined);
  // Removed isLoadingRating state to prevent flickering
  // Memoize expensive calculations
  const displayPlayerName = useMemo(() => basePlayerData?.name || player?.name || "Unknown Player", [basePlayerData?.name, player?.name]);
  const displayPlayerNumber = useMemo(() => basePlayerData?.number || (playerIndex !== undefined ? playerIndex + 1 : 1), [basePlayerData?.number, playerIndex]);
  const displayPlayerPosition = useMemo(() => getPositionAbbreviation(player?.position || basePlayerData?.position || "CM"), [player?.position, basePlayerData?.position]);
  const displayPlayerNationality = useMemo(() => basePlayerData?.nationality || "Unknown", [basePlayerData?.nationality]);
  const displayNationId = useMemo(() => getNationId(displayPlayerNationality), [displayPlayerNationality]);
  
  // Update last valid rating when we have a rating from any source
  useEffect(() => {
    const bestRating = calculatedRating ?? displayOverallRating ?? player?.overall_rating;
    if (bestRating !== undefined && bestRating !== lastValidRating) {
      setLastValidRating(bestRating);
      console.log(`[Rating Cache] Updated lastValidRating for ${displayPlayerName}: ${bestRating}`);
    }
  }, [calculatedRating, displayOverallRating, player?.overall_rating, lastValidRating, displayPlayerName]);
  
  // Use best available rating to prevent disappearing
  const currentRating = (() => {
    // Priority: calculatedRating > displayOverallRating > lastValidRating > player.overall_rating
    if (calculatedRating !== undefined) return calculatedRating;
    if (displayOverallRating !== undefined) return displayOverallRating;
    if (lastValidRating !== undefined) return lastValidRating;
    if (player?.overall_rating !== undefined) return player.overall_rating;
    return undefined;
  })();
  
  // Use best available potential from all sources
  const currentPotential = (() => {
    // Priority: displayPotential > player.potential > basePlayerData.potential
    if (displayPotential !== undefined) return displayPotential;
    if (player?.potential !== undefined) return player.potential;
    if (basePlayerData?.potential !== undefined) return basePlayerData.potential;
    return undefined;
  })();
  
  // Effect to fetch calculated rating when component mounts or data changes
  useEffect(() => {
    const loadCalculatedRating = async () => {
      // Only proceed if player has been saved and is not currently being processed
      if (displayStatus !== 'saved' || isCurrentPlayer) {
        return; // Skip if player hasn't been saved yet or is currently active
      }
      
      // If we already have a displayOverallRating and no calculated rating yet, use it immediately
      if (displayOverallRating !== undefined && calculatedRating === undefined) {
        setCalculatedRating(displayOverallRating);
      }
      
      // Only try to fetch new calculation if we have all necessary data
      if (!basePlayerData || !leagueId || !projectId) {
        // If we don't have league/project data, just use the displayOverallRating
        console.log('[PlayerCard] Missing league/project data, using displayOverallRating only');
        return;
      }
      
      try {
        const result = await fetchCalculatedRating(basePlayerData, leagueId, projectId);
        if (result && result.status === 'success') {
          setCalculatedRating(result.overall_rating);
        }
      } catch (error) {
        console.error('Failed to load calculated rating:', error);
        // Keep existing rating if calculation fails
      }
    };

    loadCalculatedRating();
  }, [displayPlayerName, basePlayerData?.value, basePlayerData?.position, leagueId, projectId, displayStatus, displayOverallRating, calculatedRating]);
  
  // Effect to handle status changes - set initial rating when status becomes 'saved'
  useEffect(() => {
    if (displayStatus === 'saved' || displayStatus === 'saving') {
      // For saved or saving players, always show the rating if available
      if (displayOverallRating !== undefined && calculatedRating === undefined) {
        setCalculatedRating(displayOverallRating);
      }
    }
    // Don't clear the rating for non-saved players anymore to prevent disappearing
    // The rating should persist once it's been set
  }, [displayStatus, displayOverallRating, calculatedRating]);
  
  // Effect to update rating when displayOverallRating changes
  useEffect(() => {
    if (displayStatus === 'saved' && displayOverallRating !== undefined) {
      // Always update if we get a new displayOverallRating for a saved player
      setCalculatedRating(displayOverallRating);
    }
  }, [displayOverallRating, displayStatus]);
  
  // Reduced debug logging to improve performance
  if (playerIndex < 3 && basePlayerData && isCurrentPlayer) {
    console.log(`[PlayerCard Debug] Player ${playerIndex} "${basePlayerData.name}":`, {
      displayStatus,
      displayOverallRating,
      calculatedRating,
      currentRating,
      leagueId,
      projectId,
      willShowRating: (isCurrentPlayer || displayStatus === 'saved') && currentRating !== undefined
    });
  }

  // Create Transfermarkt URL if we have player ID
  const createTransfermarktUrl = (playerData: any) => {
    if (playerData?.player_profile_url) {
      return playerData.player_profile_url;
    }
    if (playerData?.player_url) {
      return playerData.player_url;
    }
    if (playerData?.url) {
      // Check for the old field name that was previously used
      return playerData.url.startsWith('http') ? playerData.url : `https://www.transfermarkt.com${playerData.url}`;
    }
    if (playerData?.href) {
      return playerData.href.startsWith('http') ? playerData.href : `https://www.transfermarkt.com${playerData.href}`;
    }
    if (playerData?.link) {
      return playerData.link.startsWith('http') ? playerData.link : `https://www.transfermarkt.com${playerData.link}`;
    }
    if (playerData?.player_id || playerData?.id) {
      // Create URL from player ID if available
      const playerId = playerData.player_id || playerData.id;
      const playerName = (playerData.name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      return `https://www.transfermarkt.com/${playerName}/profil/spieler/${playerId}`;
    }
    return null;
  };

  const playerTransfermarktUrl = createTransfermarktUrl(basePlayerData);
  
  const displayPlayerValue = useMemo(() => formatMarketValue(basePlayerData?.value || basePlayerData?.market_value_eur || basePlayerData?.market_value || "-"), [basePlayerData?.value, basePlayerData?.market_value_eur, basePlayerData?.market_value]);

  // Helper functions for colors with smooth transitions
  const getRatingColorClass = (rating?: number): string => {
    if (!rating || rating < 50) return "bg-red-500"; // red
    if (rating >= 50 && rating <= 60) return "bg-orange-500"; // orange
    if (rating >= 61 && rating <= 70) return "bg-yellow-500"; // yellow
    if (rating >= 71 && rating <= 80) return "bg-green-400"; // light green
    if (rating >= 81) return "bg-green-600"; // green
    return "bg-gray-500";
  };
  
  // Get RGB values for smooth color transitions
  const getRatingColorRGB = (rating?: number): string => {
    if (!rating) return "156, 163, 175"; // gray-400
    
    // Smooth color interpolation based on rating
    if (rating < 50) {
      return "239, 68, 68"; // red-500
    } else if (rating <= 60) {
      // Interpolate between red and orange
      const t = (rating - 50) / 10;
      const r = Math.round(239 + (249 - 239) * t);
      const g = Math.round(68 + (115 - 68) * t);
      const b = Math.round(68 + (22 - 68) * t);
      return `${r}, ${g}, ${b}`;
    } else if (rating <= 70) {
      // Interpolate between orange and yellow
      const t = (rating - 60) / 10;
      const r = Math.round(249 + (234 - 249) * t);
      const g = Math.round(115 + (179 - 115) * t);
      const b = Math.round(22 + (8 - 22) * t);
      return `${r}, ${g}, ${b}`;
    } else if (rating <= 80) {
      // Interpolate between yellow and light green
      const t = (rating - 70) / 10;
      const r = Math.round(234 + (74 - 234) * t);
      const g = Math.round(179 + (222 - 179) * t);
      const b = Math.round(8 + (128 - 8) * t);
      return `${r}, ${g}, ${b}`;
    } else {
      // Interpolate between light green and green
      const t = Math.min((rating - 80) / 20, 1);
      const r = Math.round(74 + (34 - 74) * t);
      const g = Math.round(222 + (197 - 222) * t);
      const b = Math.round(128 + (94 - 128) * t);
      return `${r}, ${g}, ${b}`;
    }
  };

  const getPositionColorClass = (position: string): string => {
    const pos = position.toUpperCase();
    // Goalkeepers - yellow
    if (pos === 'GK') return "bg-yellow-500";
    // Defenders - blue
    if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos)) return "bg-blue-500";
    // Midfielders - green
    if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)) return "bg-green-500";
    // Forwards - red
    if (['LW', 'RW', 'CF', 'ST'].includes(pos)) return "bg-red-500";
    return "bg-yellow-500"; // default to yellow
  };

  // Autonomous animation - triggers automatically when rating changes
  const { count: animatedRating, isAnimating } = useAnimatedCounter(
    currentRating ?? 0, // Use nullish coalescing to avoid issues with 0
    1200, // Balanced duration for smooth animation
    0     // No delay to prevent issues with fast updates
  );

  // Debug log for animation
  if (isCurrentPlayer && isAnimating) {
    console.log(`[Animation Debug] Player ${displayPlayerName}:`, {
      isAnimating,
      currentRating,
      animatedRating,
      displayStatus,
      calculatedRating,
      displayOverallRating,
      lastValidRating
    });
  }

  // INTENSIVE DEBUG: Track all rating changes for first card
  const firstCardDebugRef = useRef<{lastRating?: number, callCount: number, lastCall: number}>({callCount: 0, lastCall: 0});
  
  if (playerIndex === 0) {
    const now = performance.now();
    const timeSinceLastCall = now - firstCardDebugRef.current.lastCall;
    firstCardDebugRef.current.callCount++;
    firstCardDebugRef.current.lastCall = now;
    
    const ratingChanged = firstCardDebugRef.current.lastRating !== currentRating;
    
    console.log(`🔥 [INTENSIVE FIRST CARD DEBUG] Call #${firstCardDebugRef.current.callCount} Player ${displayPlayerName}:`, {
      playerIndex,
      isCurrentPlayer,
      displayStatus,
      currentRating,
      animatedRating,
      isAnimating,
      displayOverallRating,
      calculatedRating,
      lastValidRating,
      'passedToUseAnimatedCounter': currentRating ?? 0,
      ratingChanged,
      'lastRating': firstCardDebugRef.current.lastRating,
      'timeSinceLastCall': `${timeSinceLastCall.toFixed(1)}ms`,
      'rapidCall': timeSinceLastCall < 100
    });
    
    firstCardDebugRef.current.lastRating = currentRating;
  }

  // Debug log for potential data (reduced verbosity)
  if (playerIndex === 0 && currentPotential !== undefined) {
    console.log(`[Potential Debug] Player ${displayPlayerName}:`, {
      displayPotential,
      currentPotential,
      'willShowPotentialInPopover': currentPotential !== undefined
    });
  }

  // Memoize the rating click handler
  const handleRatingClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!isRatingBreakdownOpen && !ratingBreakdown) {
      setIsLoadingBreakdown(true);
      try {
        const breakdown = await fetchRatingBreakdown(basePlayerData, leagueId, projectId, currentRating);
        console.log('[Rating Breakdown] Received data:', breakdown);
        setRatingBreakdown(breakdown);
      } catch (error) {
        console.error('Failed to load rating breakdown:', error);
      } finally {
        setIsLoadingBreakdown(false);
      }
    }
    
    setIsRatingBreakdownOpen(!isRatingBreakdownOpen);
  }, [isRatingBreakdownOpen, ratingBreakdown, basePlayerData, leagueId, projectId, currentRating]);


  return (
    <Dropdown backdrop="blur">
      <DropdownTrigger>
        <div className="w-full">
          <Card
            shadow="sm"
            radius="lg"
            className={`transition-all duration-300 cursor-pointer hover:scale-105 ${
              isCurrentPlayer || displayStatus === 'saving' 
                ? "bg-green-800" 
                : "bg-zinc-800"
            }`}
            disableRipple
          >
      <CardBody className="p-0 relative h-[92px] overflow-visible">
        <div className="flex h-full w-full">
          {/* Left column with position on top and number on bottom - even more compact width */}
          <div className="h-full flex flex-col" style={{ width: 'fit-content', minWidth: '2.25rem' }}>
            {/* Position indicator - top half - dynamic color based on position */}
            <div className={`${getPositionColorClass(displayPlayerPosition)} h-1/2 flex items-center justify-center rounded-br-xl px-1`}>
              <span className="text-white text-sm font-bold">{displayPlayerPosition}</span>
            </div>
            
            {/* Player number - bottom half - reduced padding */}
            <div className="h-1/2 flex items-center justify-center px-1">
              <span className={`${getPositionColorClass(displayPlayerPosition).replace('bg-', 'text-')} text-base font-bold`}>{displayPlayerNumber}</span>
            </div>
          </div>
          
          {/* Middle: Main card content */}
          <div className="flex flex-col flex-1 p-2 justify-between">
            {/* Top row: Flags and team logo - increased sizes */}
            <div className="flex items-center gap-2">
              {/* Player nationality flag - increased size and more rounded corners */}
              <Image
                src={`http://localhost:8000/images/flags/${displayNationId}`}
                alt={displayPlayerNationality}
                width={28}
                height={18}
                className="w-7 h-4 object-cover rounded-md overflow-hidden"
                removeWrapper
              />
              
              {/* Team logo - unchanged */}
              <Image
                src={currentTeam.teamlogo}
                alt={currentTeam.teamname}
                width={24}
                height={24}
                className="w-6 h-6 object-contain"
                removeWrapper
              />
            </div>
            
            {/* Player name - handle single names and make gray text lighter */}
            <div className="flex flex-col">
              {displayPlayerName.includes(' ') ? (
                <>
                  <span 
                    className="text-gray-300 text-sm font-medium leading-tight truncate"
                    title={displayPlayerName.split(' ')[0]}
                  >
                    {displayPlayerName.split(' ')[0]}
                  </span>
                  <span
                    className="text-white text-base font-bold leading-tight truncate"
                    title={displayPlayerName.split(' ').slice(1).join(' ')}
                  >
                    {displayPlayerName.split(' ').slice(1).join(' ')}
                  </span>
                </>
              ) : (
                <span 
                  className="text-white text-base font-bold leading-tight truncate py-1"
                  title={displayPlayerName}
                >
                  {displayPlayerName}
                </span>
              )}
            </div>
            
            {/* Player market value at bottom */}
            <div className="flex items-center">
              <Chip 
                size="sm" 
                color="success" 
                variant="flat"
                classNames={{
                  base: "h-5 min-h-5",
                  content: "px-1 py-0 text-xs font-semibold"
                }}
              >
                {displayPlayerValue !== "-" ? displayPlayerValue : "N/A"}
              </Chip>
            </div>
          </div>
          
          {/* Right: Rating square - clickable */}
          <div className="h-full flex items-start justify-end p-2">
            {(() => {
              // More comprehensive rating visibility logic
              const hasAnyRating = currentRating !== undefined || 
                                 calculatedRating !== undefined || 
                                 displayOverallRating !== undefined ||
                                 lastValidRating !== undefined;
              
              // Show rating if player is current, saved, or has any rating data
              const shouldShowRating = hasAnyRating && (
                isCurrentPlayer || 
                displayStatus === 'saved' || 
                displayStatus === 'saving' ||
                (lastValidRating !== undefined)
              );
              
              // Debug log for rating visibility
              if (isCurrentPlayer || shouldShowRating || hasAnyRating) {
                console.log(`[Rating Display] Player ${displayPlayerName}:`, {
                  shouldShowRating,
                  hasAnyRating,
                  isCurrentPlayer,
                  displayStatus,
                  currentRating,
                  calculatedRating,
                  displayOverallRating,
                  lastValidRating,
                  animatedRating
                });
              }
              
              return shouldShowRating;
            })() ? (
              <Popover 
                placement="left" 
                backdrop="blur"
                isOpen={isRatingBreakdownOpen}
                onOpenChange={setIsRatingBreakdownOpen}
              >
                <PopoverTrigger>
                  <div 
                    className="w-10 h-10 rounded-md flex items-center justify-center cursor-pointer hover:scale-105 relative overflow-hidden"
                    onClick={handleRatingClick}
                    style={{
                      backgroundColor: `rgb(${getRatingColorRGB(animatedRating)})`,
                      transform: isAnimating ? 'scale(1.2) perspective(1000px) rotateY(15deg)' : 'scale(1)',
                      transition: 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), background-color 0.8s ease-out',
                      boxShadow: isAnimating 
                        ? `0 10px 30px rgba(${getRatingColorRGB(animatedRating)}, 0.5), 0 0 40px rgba(${getRatingColorRGB(animatedRating)}, 0.3)` 
                        : '0 2px 8px rgba(0, 0, 0, 0.1)',
                      willChange: 'transform, background-color, box-shadow'
                    }}
                  >
                    {/* Animated background pulse effect */}
                    {isAnimating && (
                      <div 
                        className="absolute inset-0 bg-white opacity-20"
                        style={{
                          animation: 'pulse-wave 1s ease-out infinite',
                          background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)'
                        }}
                      />
                    )}
                    
                    {/* Rating number with smooth transitions */}
                    <span 
                      className="text-white text-lg font-bold relative z-10"
                      style={{
                        fontSize: isAnimating ? '1.3rem' : '1.125rem',
                        transform: isAnimating ? 'scale(1.15)' : 'scale(1)',
                        transition: 'all 0.5s ease-out',
                        textShadow: isAnimating 
                          ? '0 0 15px rgba(255,255,255,0.9), 0 0 25px rgba(255,255,255,0.6), 0 0 35px rgba(255,255,255,0.3)' 
                          : '0 1px 3px rgba(0,0,0,0.5)',
                        willChange: 'transform, font-size, text-shadow'
                      }}
                    >
                      {(() => {
                        // Track when rating actually changes in display for first card
                        if (playerIndex === 0) {
                          console.log(`🎭 [FIRST CARD DISPLAY] Showing: ${animatedRating}, isAnimating: ${isAnimating}, currentRating: ${currentRating}`);
                        }
                        return animatedRating;
                      })()}
                    </span>
                    
                    {/* Animated background pulse effect uses CSS-in-JS for keyframes */}
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-72">
                  <div className="px-1 py-2">
                    {/* Compact Header */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-8 h-8 ${getRatingColorClass(currentRating)} rounded-lg flex items-center justify-center`}>
                        <span className="text-white text-lg font-bold">{currentRating}</span>
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-foreground">Расчёт рейтинга</h3>
                        <p className="text-xs text-foreground-500">{displayPlayerName}</p>
                      </div>
                    </div>
                    
                    {/* Rating Breakdown */}
                    {isLoadingBreakdown ? (
                      <div className="flex items-center justify-center p-6">
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                          <span className="text-xs text-foreground-500">Загрузка...</span>
                        </div>
                      </div>
                    ) : ratingBreakdown?.breakdown ? (
                      <div className="space-y-2">
                        {/* Compact Rating Components */}
                        <div className="grid gap-1">
                          {/* Base Rating (BR) */}
                          <div className="flex items-center justify-between p-2 bg-content1 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 bg-primary rounded flex items-center justify-center">
                                <Icon icon="lucide:euro" className="h-3 w-3 text-white" />
                              </div>
                              <div>
                                <div className="text-xs font-medium text-foreground">Базовый рейтинг</div>
                                <div className="text-[10px] text-foreground-400">
                                  {ratingBreakdown.breakdown?.market_value_str || 'N/A'}
                                </div>
                              </div>
                            </div>
                            <span className="text-sm font-bold text-primary">
                              {typeof ratingBreakdown.breakdown?.base_rating === 'number' 
                                ? Math.round(ratingBreakdown.breakdown.base_rating) 
                                : 'N/A'}
                            </span>
                          </div>

                          {/* League Rating (LR) */}
                          <div className="flex items-center justify-between p-2 bg-content1 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 bg-success rounded flex items-center justify-center">
                                <Icon icon="lucide:trophy" className="h-3 w-3 text-white" />
                              </div>
                              <div>
                                <div className="text-xs font-medium text-foreground">Рейтинг лиги</div>
                                <div className="text-[10px] text-foreground-400">
                                  {ratingBreakdown.breakdown?.league_country || 'Unknown'} Д{ratingBreakdown.breakdown?.league_division || 'N/A'}
                                </div>
                              </div>
                            </div>
                            <span className="text-sm font-bold text-success">
                              {typeof ratingBreakdown.breakdown?.league_rating === 'number' 
                                ? Math.round(ratingBreakdown.breakdown.league_rating) 
                                : 'N/A'}
                            </span>
                          </div>

                          {/* League Influence Coefficient (LIC) */}
                          <div className="flex items-center justify-between p-2 bg-content1 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 bg-secondary rounded flex items-center justify-center">
                                <Icon icon="lucide:trending-up" className="h-3 w-3 text-white" />
                              </div>
                              <div>
                                <div className="text-xs font-medium text-foreground">Влияние лиги</div>
                                <div className="text-[10px] text-foreground-400">на финальный рейтинг</div>
                              </div>
                            </div>
                            <span className="text-sm font-bold text-secondary">
                              {typeof ratingBreakdown.breakdown?.league_influence_coefficient === 'number' 
                                ? `${Math.round(ratingBreakdown.breakdown.league_influence_coefficient * 100)}%`
                                : 'N/A'}
                            </span>
                          </div>
                        </div>

                        {/* Compact Formula */}
                        <div className="p-2 bg-warning-50 rounded-lg border border-warning-200">
                          <div className="flex items-center gap-1 mb-1">
                            <Icon icon="lucide:calculator" className="h-3 w-3 text-warning-600" />
                            <span className="text-xs font-medium text-warning-800">Формула</span>
                          </div>
                          <div className="font-mono text-[10px] text-warning-700 bg-warning-100 p-1.5 rounded border">
                            FR = BR×(1-LIC) + ((BR+LR)÷2)×LIC
                          </div>
                        </div>

                        {/* Compact Calculation Steps */}
                        <div className="space-y-1">
                          <div className="text-[10px] font-medium text-foreground-600">Этапы расчёта:</div>
                          
                          <div className="flex items-center justify-between p-1.5 bg-content2 rounded">
                            <span className="text-xs">Базовая часть</span>
                            <span className="text-xs font-bold text-foreground-700">
                              {typeof ratingBreakdown.breakdown?.br_component === 'number' 
                                ? Math.round(ratingBreakdown.breakdown.br_component * 10) / 10 
                                : 'N/A'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between p-1.5 bg-content2 rounded">
                            <span className="text-xs">Лиговая часть</span>
                            <span className="text-xs font-bold text-foreground-700">
                              {typeof ratingBreakdown.breakdown?.league_component === 'number' 
                                ? Math.round(ratingBreakdown.breakdown.league_component * 10) / 10 
                                : 'N/A'}
                            </span>
                          </div>
                        </div>
                          
                        {/* Compact Final Result */}
                        <div className="p-2 bg-gradient-to-r from-primary-50 to-secondary-50 rounded-lg border border-primary-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon icon="lucide:star" className="h-4 w-4 text-primary-600" />
                              <div>
                                <div className="text-sm font-bold text-foreground">Результат</div>
                                <div className="text-xs text-foreground-500">
                                  {typeof ratingBreakdown.breakdown.final_rating === 'number' ? Math.round(ratingBreakdown.breakdown.final_rating * 10) / 10 : 'N/A'} → {ratingBreakdown.overall_rating || currentRating}
                                </div>
                              </div>
                            </div>
                            <div className={`w-10 h-10 ${getRatingColorClass(ratingBreakdown.overall_rating || currentRating)} rounded-lg flex items-center justify-center shadow`}>
                              <span className="text-white text-lg font-bold">{ratingBreakdown.overall_rating || currentRating}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Compact Info */}
                        <div className="p-2 bg-default-100 rounded-lg">
                          <div className="flex items-start gap-2">
                            <Icon icon="lucide:info" className="h-3 w-3 text-default-500 mt-0.5 flex-shrink-0" />
                            <div className="text-[10px] text-default-600 leading-relaxed">
                              <strong>Принцип:</strong> дорогие игроки меньше зависят от уровня лиги, дешёвые — больше
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center p-6">
                        <div className="text-center">
                          <Icon icon="lucide:alert-circle" className="h-6 w-6 text-warning mx-auto mb-1" />
                          <p className="text-xs text-foreground-500">Нет данных</p>
                        </div>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}
          </div>
        </div>
      </CardBody>
    </Card>
        </div>
      </DropdownTrigger>
      
      <DropdownMenu 
        aria-label={`Actions for ${displayPlayerName}`}
        variant="flat"
        disableAnimation
      >
        <DropdownItem
          key="info"
          isReadOnly
          className="p-0"
          textValue={`Player info for ${displayPlayerName}`}
        >
          <Popover placement="right" backdrop="blur">
            <PopoverTrigger>
              <div className="flex items-center gap-2 p-2 w-full hover:bg-default-100 rounded-lg cursor-pointer">
                <Icon icon="lucide:info" className="h-4 w-4" />
                <div className="flex items-center gap-2 flex-1">
                  <Image
                    src={`http://localhost:8000/images/flags/${displayNationId}`}
                    alt={displayPlayerNationality}
                    className="w-5 h-3 object-cover rounded-sm"
                  />
                  <span className="font-medium">{displayPlayerName}</span>
                  <div className="ml-auto flex items-center gap-1">
                    {currentRating !== undefined && (
                      <div className={`px-2 py-0.5 ${getRatingColorClass(currentRating)} rounded text-white text-xs font-bold`}>
                        {currentRating}
                      </div>
                    )}
                    {currentPotential !== undefined && (
                      <div className="px-2 py-0.5 bg-purple-500 rounded text-white text-xs font-bold">
                        {currentPotential}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="p-4 space-y-4">
                {/* Header */}
                <div className="flex items-center gap-3 border-b border-default-200 pb-3">
                  <div className="relative">
                    <Image
                      src={`http://localhost:8000/images/flags/${displayNationId}`}
                      alt={displayPlayerNationality}
                      className="w-10 h-7 object-cover rounded-md"
                    />
                    <div className="absolute -bottom-1 -right-1">
                      <Image
                        src={currentTeam.teamlogo}
                        alt={currentTeam.teamname}
                        className="w-4 h-4 object-contain border-2 border-white rounded-full bg-white shadow-md"
                      />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{displayPlayerName}</h3>
                    <p className="text-sm text-default-500">Player Information</p>
                  </div>
                </div>
                
                {/* Stats Grid */}
                <div className={`grid gap-3 ${displayStatus === 'saved' && currentRating !== undefined ? 'grid-cols-2' : 'grid-cols-2'}`}>
                  <div className="bg-primary-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-4 h-4 ${getPositionColorClass(displayPlayerPosition)} rounded-sm flex items-center justify-center`}>
                        <span className="text-white text-xs font-bold">{displayPlayerPosition}</span>
                      </div>
                      <span className="text-sm font-medium">Position</span>
                    </div>
                    <p className="text-xl font-bold text-primary">{displayPlayerPosition}</p>
                    <p className="text-xs text-default-500">{player?.position || basePlayerData?.position || "Unknown"}</p>
                  </div>
                  
                  <div className="bg-secondary-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon icon="lucide:hash" className="h-4 w-4 text-secondary" />
                      <span className="text-sm font-medium">Number</span>
                    </div>
                    <p className="text-xl font-bold text-secondary">{displayPlayerNumber}</p>
                    <p className="text-xs text-default-500">jersey number</p>
                  </div>
                  
                  <div className="bg-warning-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Image
                        src={`http://localhost:8000/images/flags/${displayNationId}`}
                        alt={displayPlayerNationality}
                        className="w-4 h-3 object-cover rounded-sm"
                      />
                      <span className="text-sm font-medium">Nation</span>
                    </div>
                    <p className="text-sm font-bold text-warning">{displayPlayerNationality}</p>
                    <p className="text-xs text-default-500">nationality</p>
                  </div>
                  
                  <div className="bg-success-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon icon="lucide:euro" className="h-4 w-4 text-success-600" />
                      <span className="text-sm font-medium">Market Value</span>
                    </div>
                    <p className="text-sm font-bold text-success-600">{displayPlayerValue !== "-" ? displayPlayerValue : "Not available"}</p>
                    <p className="text-xs text-default-500">transfermarkt</p>
                  </div>
                  
                  {(currentRating !== undefined || currentPotential !== undefined) && (
                    <div className="bg-purple-50 p-3 rounded-lg col-span-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon icon="lucide:star" className="h-4 w-4 text-purple-600" />
                        <span className="text-sm font-medium">Player Ratings</span>
                      </div>
                      <div className="flex items-center gap-4">
                        {currentRating !== undefined && (
                          <div className="flex flex-col items-center">
                            <p className="text-2xl font-bold text-purple-600">{currentRating}</p>
                            <p className="text-xs text-default-500">Overall</p>
                          </div>
                        )}
                        {currentPotential !== undefined && (
                          <div className="flex flex-col items-center">
                            <p className="text-2xl font-bold text-pink-600">{currentPotential}</p>
                            <p className="text-xs text-default-500">Potential</p>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-default-500 mt-2">FIFA/FC ratings</p>
                    </div>
                  )}
                </div>
                
                {/* Team Info */}
                <div className="pt-2 border-t border-default-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Image
                      src={currentTeam.teamlogo}
                      alt={currentTeam.teamname}
                      className="w-5 h-5 object-contain"
                    />
                    <span className="font-medium text-sm">{currentTeam.teamname}</span>
                  </div>
                  {playerTransfermarktUrl && (
                    <Button
                      as="a"
                      href={playerTransfermarktUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      color="primary"
                      variant="flat"
                      className="w-full"
                      endContent={<Icon icon="lucide:external-link" className="h-3 w-3" />}
                    >
                      View Player on Transfermarkt
                    </Button>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </DropdownItem>
        
        {playerTransfermarktUrl && (
          <DropdownItem
            key="transfermarkt"
            startContent={<Icon icon="lucide:external-link" className="h-4 w-4" />}
            description="View player profile on Transfermarkt"
            textValue="View on Transfermarkt"
            onPress={() => window.open(playerTransfermarktUrl, '_blank')}
          >
            View on Transfermarkt
          </DropdownItem>
        )}
        
        <DropdownItem
          key="status"
          startContent={
            <div className={`w-3 h-3 rounded-full ${
              displayStatus === 'saved' ? 'bg-success-500' :
              displayStatus === 'saving' ? 'bg-warning-500' :
              displayStatus === 'error' ? 'bg-danger-500' :
              'bg-default-400'
            }`} />
          }
          description={`Current processing status: ${displayStatus}`}
          color={displayStatus === 'error' ? 'danger' : displayStatus === 'saved' ? 'success' : 'default'}
          variant="flat"
          isReadOnly
          textValue={`Status: ${displayStatus}`}
        >
          Status: {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}

// Memoize the component to prevent unnecessary re-renders
export default memo(PlayerCardFromAddTeam, (prevProps, nextProps) => {
  // Custom comparison function - more comprehensive
  return (
    prevProps.player.name === nextProps.player.name &&
    prevProps.player.status === nextProps.player.status &&
    prevProps.player.overall_rating === nextProps.player.overall_rating &&
    prevProps.player.potential === nextProps.player.potential &&
    prevProps.playerIndex === nextProps.playerIndex &&
    prevProps.isCurrentPlayer === nextProps.isCurrentPlayer &&
    prevProps.displayOverallRating === nextProps.displayOverallRating &&
    prevProps.displayPotential === nextProps.displayPotential &&
    prevProps.displayStatus === nextProps.displayStatus &&
    prevProps.leagueId === nextProps.leagueId &&
    prevProps.projectId === nextProps.projectId &&
    prevProps.currentTeam.team_id === nextProps.currentTeam.team_id &&
    prevProps.basePlayerData?.name === nextProps.basePlayerData?.name &&
    prevProps.basePlayerData?.value === nextProps.basePlayerData?.value &&
    prevProps.basePlayerData?.position === nextProps.basePlayerData?.position &&
    prevProps.basePlayerData?.potential === nextProps.basePlayerData?.potential
  );
});

