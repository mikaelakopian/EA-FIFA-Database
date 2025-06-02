import { useState, useEffect } from "react";
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
  Button 
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
  displayStatus: "pending" | "saving" | "saved" | "error";
}

// Custom hook for animated counter
function useAnimatedCounter(end: number, duration: number = 1000, startDelay: number = 0, shouldAnimate: boolean = true) {
  const [count, setCount] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!shouldAnimate || !end || end <= 1) {
      setCount(end || 1);
      setIsAnimating(false);
      return;
    }

    const timeout = setTimeout(() => {
      setIsAnimating(true);
      const startTime = Date.now();
      const range = end - 1;

      const updateCount = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentCount = Math.round(1 + range * easeOutQuart);
        
        setCount(currentCount);

        if (progress < 1) {
          requestAnimationFrame(updateCount);
        } else {
          setIsAnimating(false);
        }
      };

      requestAnimationFrame(updateCount);
    }, startDelay);

    return () => clearTimeout(timeout);
  }, [end, duration, startDelay, shouldAnimate]);

  return { count, isAnimating };
}

export default function PlayerCardFromAddTeam({
  player,
  playerIndex,
  currentTeam,
  basePlayerData,
  isCurrentPlayer = false,
  displayOverallRating,
  displayStatus
}: PlayerCardFromAddTeamProps) {
  // Add proper null checks to prevent "Cannot read properties of undefined" errors
  const displayPlayerName = basePlayerData?.name || player?.name || "Unknown Player";
  const displayPlayerNumber = basePlayerData?.number || (playerIndex !== undefined ? playerIndex + 1 : 1);
  const displayPlayerPosition = getPositionAbbreviation(player?.position || basePlayerData?.position || "CM");
  const displayPlayerNationality = basePlayerData?.nationality || "Unknown";
  const displayNationId = getNationId(displayPlayerNationality);

  // Helper functions for colors
  const getRatingColorClass = (rating?: number): string => {
    if (!rating || rating < 50) return "bg-red-500"; // red
    if (rating >= 50 && rating <= 60) return "bg-orange-500"; // orange
    if (rating >= 61 && rating <= 70) return "bg-yellow-500"; // yellow
    if (rating >= 71 && rating <= 80) return "bg-green-400"; // light green
    if (rating >= 81) return "bg-green-600"; // green
    return "bg-gray-500";
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

  // Animated counter for rating - only animate when saving
  const shouldAnimate = isCurrentPlayer && displayStatus === 'saving';
  const { count: animatedRating, isAnimating } = useAnimatedCounter(
    displayOverallRating || 0, 
    800, // 800ms duration
    200, // Delay before starting
    shouldAnimate // Only animate when saving player
  );


  return (
    <Dropdown backdrop="blur">
      <DropdownTrigger>
        <div className="w-full">
          <Card
            shadow="sm"
            radius="lg"
            className={`transition-all duration-200 cursor-pointer hover:scale-105 ${
              isCurrentPlayer 
                ? "border border-success-400 bg-white dark:bg-content1" 
                : displayStatus === "saved"
                ? "border border-success-200 bg-white dark:bg-content1"
                : "border border-default-200 bg-white dark:bg-content1"
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
                    className="text-default-300 text-sm font-medium leading-tight truncate"
                    title={displayPlayerName.split(' ')[0]}
                  >
                    {displayPlayerName.split(' ')[0]}
                  </span>
                  <span
                    className="text-black dark:text-white text-base font-bold leading-tight truncate"
                    title={displayPlayerName.split(' ').slice(1).join(' ')}
                  >
                    {displayPlayerName.split(' ').slice(1).join(' ')}
                  </span>
                </>
              ) : (
                <span 
                  className="text-black dark:text-white text-base font-bold leading-tight truncate py-1"
                  title={displayPlayerName}
                >
                  {displayPlayerName}
                </span>
              )}
            </div>
            
            {/* Info icon at bottom */}
            <div className="flex items-center">
              <div className="w-5 h-5 bg-default-200 dark:bg-default-700 rounded-full flex items-center justify-center">
                <Icon icon="lucide:info" className="text-default-500 w-3 h-3" />
              </div>
            </div>
          </div>
          
          {/* Right: Rating square */}
          <div className="h-full flex items-start justify-end p-2">
            {displayOverallRating !== undefined && (
              <div className={`w-10 h-10 ${getRatingColorClass(animatedRating)} rounded-md flex items-center justify-center transition-all duration-200 ${
                isAnimating ? 'scale-110 shadow-lg' : 'scale-100'
              }`}>
                <span className={`text-white text-lg font-bold transition-all duration-100 ${
                  isAnimating ? 'text-yellow-100' : 'text-white'
                }`}>
                  {animatedRating}
                </span>
              </div>
            )}
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
                <div className="flex items-center gap-2">
                  <Image
                    src={`http://localhost:8000/images/flags/${displayNationId}`}
                    alt={displayPlayerNationality}
                    className="w-5 h-3 object-cover rounded-sm"
                  />
                  <span className="font-medium">{displayPlayerName}</span>
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
                <div className="grid grid-cols-2 gap-3">
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
                  
                  {displayOverallRating !== undefined && (
                    <div className="bg-success-50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon icon="lucide:star" className="h-4 w-4 text-success" />
                        <span className="text-sm font-medium">Rating</span>
                      </div>
                      <p className="text-xl font-bold text-success">{displayOverallRating}</p>
                      <p className="text-xs text-default-500">overall rating</p>
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
                  {currentTeam.team_url && (
                    <Button
                      as="a"
                      href={currentTeam.team_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      color="primary"
                      variant="flat"
                      className="w-full"
                      endContent={<Icon icon="lucide:external-link" className="h-3 w-3" />}
                    >
                      View Team on Transfermarkt
                    </Button>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </DropdownItem>
        
        {basePlayerData?.player_url && (
          <DropdownItem
            key="transfermarkt"
            startContent={<Icon icon="lucide:external-link" className="h-4 w-4" />}
            description="View player profile on Transfermarkt"
            textValue="View on Transfermarkt"
            onPress={() => window.open(basePlayerData.player_url, '_blank')}
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

