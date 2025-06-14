import { useState, useEffect, useRef, memo, useCallback } from "react";
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
  Chip,
  Accordion,
  AccordionItem
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

// Function to get age coefficient details
const getAgeDetails = (age: number) => {
  if (age <= 15) return { modifier: 0.95, category: "Academy youth", description: "Академия (до 15 лет)", color: "red" };
  if (age === 16) return { modifier: 0.96, category: "Young academy", description: "Молодая академия", color: "red" };
  if (age === 17) return { modifier: 0.97, category: "Late academy", description: "Поздняя академия", color: "red" };
  if (age === 18) return { modifier: 0.98, category: "First year professional", description: "Первый профессиональный год", color: "orange" };
  if (age === 19) return { modifier: 0.99, category: "Young professional", description: "Молодой профессионал", color: "orange" };
  if (age === 20) return { modifier: 1.00, category: "Developing player", description: "Развивающийся игрок", color: "blue" };
  if (age === 21) return { modifier: 1.01, category: "Emerging talent", description: "Восходящий талант", color: "green" };
  if (age === 22) return { modifier: 1.02, category: "Young talent", description: "Молодой талант", color: "green" };
  if (age === 23) return { modifier: 1.03, category: "Rising player", description: "Растущий игрок", color: "green" };
  if (age === 24) return { modifier: 1.04, category: "Pre-peak talent", description: "Предпиковый талант", color: "green" };
  if (age === 25) return { modifier: 1.05, category: "Near peak", description: "Близко к пику", color: "green" };
  if (age === 26) return { modifier: 1.05, category: "Early peak", description: "Ранний пик", color: "green" };
  if (age === 27) return { modifier: 1.05, category: "Prime peak", description: "Основной пик", color: "green" };
  if (age === 28) return { modifier: 1.05, category: "Absolute peak", description: "Абсолютный пик", color: "green" };
  if (age === 29) return { modifier: 1.05, category: "Late prime", description: "Поздний прайм", color: "green" };
  if (age === 30) return { modifier: 1.04, category: "Late peak", description: "Поздний пик", color: "green" };
  if (age === 31) return { modifier: 1.03, category: "Early decline", description: "Ранний спад", color: "green" };
  if (age === 32) return { modifier: 1.02, category: "Gradual decline", description: "Постепенный спад", color: "green" };
  if (age === 33) return { modifier: 1.01, category: "Decline", description: "Спад", color: "green" };
  if (age === 34) return { modifier: 1.00, category: "Notable decline", description: "Заметный спад", color: "blue" };
  if (age === 35) return { modifier: 0.99, category: "Veteran decline", description: "Ветеранский спад", color: "orange" };
  if (age === 36) return { modifier: 0.98, category: "Senior veteran", description: "Старший ветеран", color: "orange" };
  if (age === 37) return { modifier: 0.97, category: "Late career", description: "Поздняя карьера", color: "red" };
  if (age === 38) return { modifier: 0.96, category: "Very late career", description: "Очень поздняя карьера", color: "red" };
  if (age === 39) return { modifier: 0.95, category: "End of career", description: "Конец карьеры", color: "red" };
  if (age === 40) return { modifier: 0.95, category: "Exceptional longevity", description: "Исключительное долголетие", color: "red" };
  return { modifier: 0.95, category: "Beyond typical career", description: "За пределами типичной карьеры", color: "red" };
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
  externalAnimationState?: {
    shouldAnimate: boolean;
    targetRating: number;
    triggered: boolean;
  };
  onAnimationComplete?: () => void;
}

function useAnimatedCounter(end: number | undefined, duration: number = 1000, startDelay: number = 0, onComplete?: () => void) {
  const [displayValue, setDisplayValue] = useState(() => {
    // Always start with 1 for animation
    return 1;
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number | null>(null);
  const previousEndRef = useRef<number | undefined>(undefined);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    console.log(`🔄 [useAnimatedCounter] end=${end}, previousEnd=${previousEndRef.current}, displayValue=${displayValue}, isAnimating=${isAnimating}`);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Handle undefined/invalid values
    if (end === undefined || end === null || end <= 1) {
      console.log(`❌ [useAnimatedCounter] Invalid/undefined end: ${end}`);
      if (mountedRef.current && displayValue !== 1) {
        setDisplayValue(1);
        setIsAnimating(false);
      }
      previousEndRef.current = end;
      return;
    }

    // Check if this is a meaningful change that should trigger animation
    const wasUndefined = previousEndRef.current === undefined;
    const isNewRating = previousEndRef.current !== end;
    const shouldAnimate = wasUndefined || isNewRating;
    
    // CRITICAL FIX: Don't interrupt ongoing animation!
    if (!shouldAnimate) {
      // Only update display value if we're not currently animating
      if (!isAnimating) {
        if (mountedRef.current && displayValue !== end) {
          setDisplayValue(end);
        }
      }
      return;
    }

    // Cancel any existing animation only if we're starting a new different animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    // CRITICAL FIX: Update previousEnd BEFORE starting animation to prevent re-triggers
    previousEndRef.current = end;

    const startAnimation = () => {
      if (!mountedRef.current) return;
      
      // When rating becomes available (undefined -> number) or changes, start from 1
      // Otherwise start from current display value
      const startValue = (wasUndefined || displayValue === 1) ? 1 : displayValue;
      const startTime = performance.now();
      
      console.log(`🚀 [useAnimatedCounter] STARTING ANIMATION: ${startValue} → ${end}`);
      setIsAnimating(true);
      setDisplayValue(startValue);
      hasAnimatedRef.current = true;
      
      const animate = (currentTime: number) => {
        if (!mountedRef.current) return;
        
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = progress * (2 - progress); // easeOutQuad
        const current = Math.round(startValue + (end - startValue) * easeProgress);
        
        setDisplayValue(current);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          if (mountedRef.current) {
            setDisplayValue(end);
            setIsAnimating(false);
            if (onComplete) onComplete();
          }
          animationRef.current = null;
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    };

    if (startDelay > 0) {
      timeoutRef.current = setTimeout(startAnimation, startDelay);
    } else {
      startAnimation();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [end, duration, startDelay, onComplete]);

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
    return {
      breakdown: {
        components: [
          { name: "Базовый рейтинг лиги", value: 65, description: "Данные недоступны" },
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
  projectId,
  externalAnimationState,
  onAnimationComplete
}: PlayerCardFromAddTeamProps) {

  const [isRatingBreakdownOpen, setIsRatingBreakdownOpen] = useState(false);
  const [ratingBreakdown, setRatingBreakdown] = useState<any>(null);
  const [isLoadingBreakdown, setIsLoadingBreakdown] = useState(false);
  const [calculatedRating, setCalculatedRating] = useState<number | undefined>(
    displayStatus === 'saved' ? displayOverallRating : undefined
  );
  const [lastValidRating, setLastValidRating] = useState<number | undefined>(undefined);
  // Player display data
  const displayPlayerName = basePlayerData?.name || player?.name || "Unknown Player";
  const displayPlayerNumber = basePlayerData?.number || (playerIndex !== undefined ? playerIndex + 1 : 1);
  const displayPlayerPosition = getPositionAbbreviation(player?.position || basePlayerData?.position || "CM");
  const displayPlayerNationality = basePlayerData?.nationality || "Unknown";
  const displayNationId = getNationId(displayPlayerNationality);
  
  // Update last valid rating when we have a rating from any source
  useEffect(() => {
    const bestRating = calculatedRating ?? displayOverallRating ?? player?.overall_rating;
    if (bestRating !== undefined && bestRating !== lastValidRating) {
      setLastValidRating(bestRating);
    }
  }, [calculatedRating, displayOverallRating, player?.overall_rating, lastValidRating, displayPlayerName]);
  
  // Use best available rating to prevent disappearing
  const currentRating = (() => {
    // For first card, use external animation state if available
    if (playerIndex === 0 && externalAnimationState?.shouldAnimate && externalAnimationState?.targetRating) {
      return externalAnimationState.targetRating;
    }
    
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
        return;
      }
      
      try {
        const result = await fetchCalculatedRating(basePlayerData, leagueId, projectId);
        if (result && result.status === 'success') {
          setCalculatedRating(result.overall_rating);
        }
      } catch (error) {
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
  
  const displayPlayerValue = formatMarketValue(basePlayerData?.value || basePlayerData?.market_value_eur || basePlayerData?.market_value || "-");

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

  const animationCompleteCallback = playerIndex === 0 ? onAnimationComplete : undefined;

  // Directly display the rating without animation
  const displayRating = currentRating || 1;




  const handleRatingClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!isRatingBreakdownOpen && !ratingBreakdown) {
      setIsLoadingBreakdown(true);
      try {
        const breakdown = await fetchRatingBreakdown(basePlayerData, leagueId, projectId, currentRating);
        setRatingBreakdown(breakdown);
      } catch (error) {
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
            {currentRating !== undefined && (
              isCurrentPlayer || 
              displayStatus === 'saved' || 
              displayStatus === 'saving'
            ) ? (
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
                      backgroundColor: `rgb(${getRatingColorRGB(displayRating)})`,
                    }}
                  >
                    {/* Rating number */}
                    <span className="text-white text-lg font-bold">
                      {displayRating}
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
                          {/* Base Rating (BR) - Accordion with Details */}
                          <Accordion 
                            variant="splitted" 
                            isCompact 
                            className="px-0"
                            itemClasses={{
                              base: "py-0 px-0",
                              title: "font-medium text-xs",
                              trigger: "px-2 py-1 h-auto min-h-0",
                              content: "text-xs pb-2 pt-1 px-2",
                            }}
                          >
                            <AccordionItem
                              key="base-rating"
                              aria-label="Базовый рейтинг (BR)"
                              title={
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 bg-primary-600 rounded flex items-center justify-center">
                                      <Icon icon="lucide:star" className="h-3 w-3 text-white" />
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium text-primary-900">Базовый рейтинг (BR)</div>
                                      <div className="text-[10px] text-primary-700">
                                        с учетом возраста
                                      </div>
                                    </div>
                                  </div>
                                  <span className="text-lg font-bold text-primary-800">
                                    {typeof ratingBreakdown.breakdown?.base_rating === 'number' 
                                      ? Math.round(ratingBreakdown.breakdown.base_rating) 
                                      : 'N/A'}
                                  </span>
                                </div>
                              }
                              className="bg-primary-100 border border-primary-300 rounded-lg"
                            >
                              <div className="space-y-3">
                                {/* Formula explanation */}
                                <div className="bg-primary-50 p-2 rounded border">
                                  <div className="text-[10px] text-primary-600 font-medium mb-1">Формула расчета:</div>
                                  <div className="text-[10px] text-primary-700 font-mono">
                                    BR = Рейтинг на пике × Возрастной модификатор
                                  </div>
                                </div>
                                
                                {/* Peak Rating Details */}
                                <div className="bg-amber-100 p-2 rounded-lg border border-amber-300">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <div className="w-4 h-4 bg-amber-600 rounded flex items-center justify-center">
                                        <Icon icon="lucide:trending-up" className="h-2.5 w-2.5 text-white" />
                                      </div>
                                      <span className="text-xs font-medium text-amber-900">Рейтинг на пике</span>
                                    </div>
                                    <span className="text-sm font-bold text-amber-800">
                                      {typeof ratingBreakdown.breakdown?.base_rating_peak === 'number' 
                                        ? Math.round(ratingBreakdown.breakdown.base_rating_peak) 
                                        : 'N/A'}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-amber-700">
                                    Максимальный рейтинг для рыночной стоимости {ratingBreakdown.breakdown?.market_value_str || 'N/A'} в возрасте 25-29 лет
                                  </p>
                                </div>

                                {/* Age Modifier Details */}
                                <div className={`p-2 rounded-lg border ${
                                  ratingBreakdown.breakdown?.age_modifier && ratingBreakdown.breakdown.age_modifier > 1.0
                                    ? 'bg-green-100 border-green-300'
                                    : ratingBreakdown.breakdown?.age_modifier && ratingBreakdown.breakdown.age_modifier < 1.0
                                    ? 'bg-red-100 border-red-300'
                                    : 'bg-blue-100 border-blue-300'
                                }`}>
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-4 h-4 rounded flex items-center justify-center ${
                                        ratingBreakdown.breakdown?.age_modifier && ratingBreakdown.breakdown.age_modifier > 1.0
                                          ? 'bg-green-600'
                                          : ratingBreakdown.breakdown?.age_modifier && ratingBreakdown.breakdown.age_modifier < 1.0
                                          ? 'bg-red-600'
                                          : 'bg-blue-600'
                                      }`}>
                                        <Icon icon="lucide:calendar" className="h-2.5 w-2.5 text-white" />
                                      </div>
                                      <span className={`text-xs font-medium ${
                                        ratingBreakdown.breakdown?.age_modifier && ratingBreakdown.breakdown.age_modifier > 1.0
                                          ? 'text-green-900'
                                          : ratingBreakdown.breakdown?.age_modifier && ratingBreakdown.breakdown.age_modifier < 1.0
                                          ? 'text-red-900'
                                          : 'text-blue-900'
                                      }`}>
                                        {ratingBreakdown.breakdown?.age_modifier && ratingBreakdown.breakdown.age_modifier > 1.0
                                          ? 'Возрастной бонус'
                                          : ratingBreakdown.breakdown?.age_modifier && ratingBreakdown.breakdown.age_modifier < 1.0
                                          ? 'Возрастной штраф'
                                          : 'Возрастной модификатор'}
                                      </span>
                                    </div>
                                    <span className={`text-sm font-bold ${
                                      ratingBreakdown.breakdown?.age_modifier && ratingBreakdown.breakdown.age_modifier > 1.0
                                        ? 'text-green-800'
                                        : ratingBreakdown.breakdown?.age_modifier && ratingBreakdown.breakdown.age_modifier < 1.0
                                        ? 'text-red-800'
                                        : 'text-blue-800'
                                    }`}>
                                      {ratingBreakdown.breakdown?.age_modifier 
                                        ? `×${(ratingBreakdown.breakdown.age_modifier).toFixed(2)}`
                                        : 'N/A'}
                                    </span>
                                  </div>
                                  
                                  {/* Current age details */}
                                  {ratingBreakdown.breakdown?.player_age && (() => {
                                    const ageDetails = getAgeDetails(ratingBreakdown.breakdown.player_age);
                                    return (
                                      <div className="space-y-2">
                                        <div className="text-[10px]">
                                          <strong>{ratingBreakdown.breakdown.player_age} лет</strong> - {ageDetails.description}
                                        </div>
                                        
                                        {/* Age ranges summary */}
                                        <div className="bg-default-50 p-2 rounded border space-y-1">
                                          <div className="text-[10px] font-medium mb-1">Возрастные диапазоны:</div>
                                          <div className="space-y-0.5 text-[9px]">
                                            <div className="flex justify-between">
                                              <span className="text-red-600">Академия (≤17):</span>
                                              <span className="font-mono">×0.95-0.97</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-orange-600">Молодые (18-19):</span>
                                              <span className="font-mono">×0.98-0.99</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-green-600">Пик (25-29):</span>
                                              <span className="font-mono">×1.05</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-blue-600">Нейтрально (20, 34):</span>
                                              <span className="font-mono">×1.00</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-red-600">Ветераны (37+):</span>
                                              <span className="font-mono">×0.95-0.97</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>

                                {/* Final calculation */}
                                <div className="bg-primary-50 p-2 rounded border">
                                  <div className="text-[10px] text-primary-600 font-medium mb-1">Итоговый расчет:</div>
                                  <div className="text-[10px] text-primary-700 font-mono">
                                    {typeof ratingBreakdown.breakdown?.base_rating_peak === 'number' && ratingBreakdown.breakdown?.age_modifier
                                      ? `${Math.round(ratingBreakdown.breakdown.base_rating_peak)} × ${ratingBreakdown.breakdown.age_modifier.toFixed(2)} = ${Math.round(ratingBreakdown.breakdown.base_rating)}`
                                      : 'Данные недоступны'}
                                  </div>
                                </div>
                              </div>
                            </AccordionItem>
                          </Accordion>

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
                          <div className="space-y-1">
                            <div className="font-mono text-[10px] text-warning-700 bg-warning-100 p-1.5 rounded border">
                              BR = Пик × Возраст
                            </div>
                            <div className="font-mono text-[10px] text-warning-700 bg-warning-100 p-1.5 rounded border">
                              FR = BR×(1-LIC) + ((BR+LR)÷2)×LIC
                            </div>
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
                              <strong>Принципы:</strong><br/>
                              • Рыночная стоимость - основной фактор<br/>
                              • Пик способностей 25-29 лет (×1.05)<br/>
                              • Возрастной диапазон: 0.95 - 1.05<br/>
                              • Дорогие игроки меньше зависят от лиги
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
            <PopoverContent className="w-72">
              <div className="p-3 space-y-3">
                {/* Header - More Compact */}
                <div className="flex items-center gap-2 border-b border-default-200 pb-2">
                  <div className="relative">
                    <Image
                      src={`http://localhost:8000/images/flags/${displayNationId}`}
                      alt={displayPlayerNationality}
                      className="w-8 h-6 object-cover rounded-md"
                    />
                    <div className="absolute -bottom-1 -right-1">
                      <Image
                        src={currentTeam.teamlogo}
                        alt={currentTeam.teamname}
                        className="w-3.5 h-3.5 object-contain border border-white rounded-full bg-white shadow-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-base font-bold leading-tight">{displayPlayerName}</h3>
                    <p className="text-xs text-default-500">Player Information</p>
                  </div>
                </div>
                
                {/* Stats Grid - More Compact */}
                <div className="grid gap-2 grid-cols-2">
                  {/* Position - Special formatting for GK */}
                  <div className={`${displayPlayerPosition === 'GK' ? 'bg-yellow-50' : 'bg-primary-50'} p-2 rounded-lg`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <div className={`w-3.5 h-3.5 ${getPositionColorClass(displayPlayerPosition)} rounded-sm flex items-center justify-center`}>
                        <span className="text-white text-[10px] font-bold">{displayPlayerPosition}</span>
                      </div>
                      <span className="text-xs font-medium">Position</span>
                    </div>
                    <p className="text-lg font-bold text-primary">{displayPlayerPosition}</p>
                    <p className="text-[10px] text-default-500 leading-tight">
                      {displayPlayerPosition === 'GK' ? 'Goalkeeper' : (player?.position || basePlayerData?.position || "Unknown")}
                    </p>
                  </div>
                  
                  <div className="bg-secondary-50 p-2 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Icon icon="lucide:hash" className="h-3.5 w-3.5 text-secondary" />
                      <span className="text-xs font-medium">Number</span>
                    </div>
                    <p className="text-lg font-bold text-secondary">{displayPlayerNumber}</p>
                    <p className="text-[10px] text-default-500 leading-tight">jersey number</p>
                  </div>
                  
                  <div className="bg-warning-50 p-2 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Image
                        src={`http://localhost:8000/images/flags/${displayNationId}`}
                        alt={displayPlayerNationality}
                        className="w-3.5 h-2.5 object-cover rounded-sm"
                      />
                      <span className="text-xs font-medium">Nation</span>
                    </div>
                    <p className="text-sm font-bold text-warning leading-tight">{displayPlayerNationality}</p>
                    <p className="text-[10px] text-default-500 leading-tight">nationality</p>
                  </div>
                  
                  <div className="bg-info-50 p-2 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Icon icon="lucide:calendar" className="h-3.5 w-3.5 text-info-600" />
                      <span className="text-xs font-medium">Age</span>
                    </div>
                    <p className="text-lg font-bold text-info-600">{(() => {
                      const ageField = basePlayerData?.age || basePlayerData?.date_of_birth_age || "";
                      if (!ageField || ageField === "N/A" || ageField === "") return "?";
                      
                      // Extract age from format like "Jan 2, 2004 (21)"
                      const ageMatch = ageField.match(/\((\d+)\)/);
                      if (ageMatch) {
                        return ageMatch[1];
                      }
                      
                      // Try to extract just numbers if it's a direct age
                      const directAge = ageField.match(/^\d+$/);
                      if (directAge) {
                        return directAge[0];
                      }
                      
                      // If there's any number in the string, extract it
                      const anyNumber = ageField.match(/\d+/);
                      if (anyNumber) {
                        return anyNumber[0];
                      }
                      
                      return "?";
                    })()}</p>
                    <p className="text-[10px] text-default-500 leading-tight">years old</p>
                  </div>
                  
                  <div className="bg-success-50 p-2 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Icon icon="lucide:euro" className="h-3.5 w-3.5 text-success-600" />
                      <span className="text-xs font-medium">Market Value</span>
                    </div>
                    <p className="text-sm font-bold text-success-600 leading-tight">{displayPlayerValue !== "-" ? displayPlayerValue : "N/A"}</p>
                    <p className="text-[10px] text-default-500 leading-tight">transfermarkt</p>
                  </div>
                  
                  {(currentRating !== undefined || currentPotential !== undefined) && (
                    <div className="bg-purple-50 p-2 rounded-lg">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon icon="lucide:star" className="h-3.5 w-3.5 text-purple-600" />
                        <span className="text-xs font-medium">Player Ratings</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {currentRating !== undefined && (
                          <div className="flex flex-col items-center">
                            <p className="text-lg font-bold text-purple-600">{currentRating}</p>
                            <p className="text-[10px] text-default-500 leading-tight">Overall</p>
                          </div>
                        )}
                        {currentPotential !== undefined && (
                          <div className="flex flex-col items-center">
                            <p className="text-lg font-bold text-pink-600">{currentPotential}</p>
                            <p className="text-[10px] text-default-500 leading-tight">Potential</p>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-default-500 mt-1 leading-tight">FIFA/FC ratings</p>
                    </div>
                  )}
                </div>
                
                {/* Team Info - More Compact */}
                <div className="pt-1.5 border-t border-default-200">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Image
                      src={currentTeam.teamlogo}
                      alt={currentTeam.teamname}
                      className="w-4 h-4 object-contain"
                    />
                    <span className="font-medium text-xs">{currentTeam.teamname}</span>
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
                      className="w-full h-7 text-xs"
                      endContent={<Icon icon="lucide:external-link" className="h-2.5 w-2.5" />}
                    >
                      View on Transfermarkt
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

export default memo(PlayerCardFromAddTeam, (prevProps, nextProps) => {
  return (
    prevProps.player.name === nextProps.player.name &&
    prevProps.player.status === nextProps.player.status &&
    prevProps.player.overall_rating === nextProps.player.overall_rating &&
    prevProps.playerIndex === nextProps.playerIndex &&
    prevProps.isCurrentPlayer === nextProps.isCurrentPlayer &&
    prevProps.displayOverallRating === nextProps.displayOverallRating &&
    prevProps.displayStatus === nextProps.displayStatus &&
    prevProps.currentTeam.team_id === nextProps.currentTeam.team_id &&
    prevProps.basePlayerData?.name === nextProps.basePlayerData?.name &&
    prevProps.basePlayerData?.value === nextProps.basePlayerData?.value &&
    JSON.stringify(prevProps.externalAnimationState) === JSON.stringify(nextProps.externalAnimationState)
  );
});

