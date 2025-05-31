import React, { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Switch,
  Divider,
  NumberInput,
  Checkbox,
} from "@heroui/react";
import { Icon } from "@iconify/react";

interface TransferableTeam {
  teamid: string;
  teamname: string;
  country: string;
  countryid: string;
  current_leagueid: string;
  current_leaguename: string;
  current_prevleagueid: string;
}

interface League {
  leagueid: string;
  leaguename: string;
  countryid: string;
  level: string;
  leaguetype: string;
  iswomencompetition: string;
  isinternationalleague: string;
  iscompetitionscarfenabled: string;
  isbannerenabled: string;
  iscompetitionpoleflagenabled: string;
  iscompetitioncrowdcardsenabled: string;
  leaguetimeslice: string;
  iswithintransferwindow: string;
}

interface TransfermarktLeague {
  competition: string;
  competition_url: string;
  competition_logo_url?: string;
  tier: number;
  clubs: number;
  total_value?: string;
}

interface Nation {
  nationid: string;
  nationname: string;
  isocountrycode: string;
}

interface AddLeagueModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onLeagueAdded: (league: League) => void;
  projectId?: string;
  onDataRefresh?: () => void;
}

export default function AddLeagueModal({
  isOpen,
  onOpenChange,
  onLeagueAdded,
  projectId,
  onDataRefresh,
}: AddLeagueModalProps) {
  const [formData, setFormData] = useState({
    leagueid: "",
    leaguename: "",
    countryid: "14", // England as default
    level: 1,
    leaguetype: "0", // Most common
    iswomencompetition: false,
    isinternationalleague: false,
    iscompetitionscarfenabled: "2", // Disabled as most common
    isbannerenabled: "2", // Disabled as most common
    iscompetitionpoleflagenabled: "2", // Disabled as most common
    iscompetitioncrowdcardsenabled: "2", // Disabled as most common
    leaguetimeslice: "6", // Most common
    iswithintransferwindow: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [nations, setNations] = useState<{ [nationId: string]: Nation }>({});
  const [isValidating, setIsValidating] = useState(false);
  const [transfermarktLeagues, setTransfermarktLeagues] = useState<any[]>([]);
  const [isLoadingTransfermarkt, setIsLoadingTransfermarkt] = useState(false);
  const [suggestedLeague, setSuggestedLeague] = useState<any>(null);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [transferableTeams, setTransferableTeams] = useState<TransferableTeam[]>([]);
  const [isLoadingTransferableTeams, setIsLoadingTransferableTeams] = useState(false);
  const [selectedTeamsForTransfer, setSelectedTeamsForTransfer] = useState<Set<string>>(new Set());

  // Load nations data when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const fetchNations = async () => {
        try {
          const nationsUrl = projectId ? 
            `http://localhost:8000/nations?project_id=${projectId}` : 
            "http://localhost:8000/nations";

          const nationsResponse = await fetch(nationsUrl);
          if (nationsResponse.ok) {
            const nationsData: Nation[] = await nationsResponse.json();
            
            // Convert array to object with nationid as key
            const nationsMap: { [nationId: string]: Nation } = {};
            nationsData.forEach((nation) => {
              nationsMap[nation.nationid] = nation;
            });
            
            setNations(nationsMap);
          }
        } catch (error) {
          console.error("Error fetching nations:", error);
        }
      };

      fetchNations();
    }
  }, [isOpen, projectId]);

  // Validate country+level combination when either changes
  React.useEffect(() => {
    const validateCombination = async () => {
      if (formData.countryid && formData.level && !suggestedLeague) {
        setIsValidating(true);
        try {
          const validationUrl = projectId ? 
            `http://localhost:8000/leagues/validate?country_id=${formData.countryid}&level=${formData.level}&project_id=${projectId}` :
            `http://localhost:8000/leagues/validate?country_id=${formData.countryid}&level=${formData.level}`;

          const response = await fetch(validationUrl);
          if (response.ok) {
            const result = await response.json();
            if (!result.available) {
              setErrors(prev => ({
                ...prev,
                combination: `League already exists: "${result.existing_league.leaguename}" (ID: ${result.existing_league.leagueid})`
              }));
            } else {
              setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.combination;
                return newErrors;
              });
            }
          }
        } catch (error) {
          console.error("Error validating combination:", error);
        } finally {
          setIsValidating(false);
        }
      } else {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.combination;
          return newErrors;
        });
      }
    };

    // Debounce validation
    const timeoutId = setTimeout(validateCombination, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.countryid, formData.level, projectId, suggestedLeague]);

  // Fetch Transfermarkt leagues when country and level change
  React.useEffect(() => {
    const fetchTransfermarktLeagues = async () => {
      if (formData.countryid && formData.level && nations[formData.countryid]) {
        setIsLoadingTransfermarkt(true);
        try {
          const countryName = nations[formData.countryid].nationname;
          const response = await fetch(
            `http://localhost:8000/leagues/transfermarkt?country=${encodeURIComponent(countryName)}&tier=${formData.level}`
          );
          
          if (response.ok) {
            const result = await response.json();
            setTransfermarktLeagues(result.leagues || []);
          } else {
            setTransfermarktLeagues([]);
          }
        } catch (error) {
          console.error("Error fetching Transfermarkt leagues:", error);
          setTransfermarktLeagues([]);
        } finally {
          setIsLoadingTransfermarkt(false);
        }
      } else {
        setTransfermarktLeagues([]);
      }
    };

    // Debounce Transfermarkt fetch
    const timeoutId = setTimeout(fetchTransfermarktLeagues, 700);
    return () => clearTimeout(timeoutId);
  }, [formData.countryid, formData.level, nations]);

  // Fetch suggested league ID when country and level change
  React.useEffect(() => {
    const fetchSuggestedLeague = async () => {
      if (formData.countryid && formData.level) {
        setIsLoadingSuggestion(true);
        try {
          const response = await fetch(
            `http://localhost:8000/leagues/find-id?country_id=${formData.countryid}&level=${formData.level}`
          );
          
          if (response.ok) {
            const result = await response.json();
            if (result.found) {
              setSuggestedLeague(result.league);
              // Always update league ID when country/level changes
              setFormData(prev => ({
                ...prev,
                leagueid: result.league.leagueid
              }));
            } else {
              setSuggestedLeague(null);
              // Clear league ID if no suggestion found
              setFormData(prev => ({
                ...prev,
                leagueid: ""
              }));
            }
          } else {
            setSuggestedLeague(null);
            setFormData(prev => ({
              ...prev,
              leagueid: ""
            }));
          }
        } catch (error) {
          console.error("Error fetching suggested league:", error);
          setSuggestedLeague(null);
          setFormData(prev => ({
            ...prev,
            leagueid: ""
          }));
        } finally {
          setIsLoadingSuggestion(false);
        }
      } else {
        setSuggestedLeague(null);
        setFormData(prev => ({
          ...prev,
          leagueid: ""
        }));
      }
    };

    // Debounce suggestion fetch
    const timeoutId = setTimeout(fetchSuggestedLeague, 300);
    return () => clearTimeout(timeoutId);
  }, [formData.countryid, formData.level]);

  // Auto-generate league name from Transfermarkt data
  React.useEffect(() => {
    if (formData.countryid && formData.level && nations[formData.countryid] && transfermarktLeagues.length > 0) {
      const countryName = nations[formData.countryid].nationname;
      const primaryLeague = transfermarktLeagues[0]; // Take the first/primary league
      
      if (primaryLeague) {
        const generatedName = `${countryName} ${primaryLeague.competition} (${formData.level})`;
        
        // Only update if the current name is empty or matches the previous auto-generated pattern
        if (!formData.leaguename || 
            formData.leaguename.includes('(') && formData.leaguename.includes(')')) {
          setFormData(prev => ({
            ...prev,
            leaguename: generatedName
          }));
        }
      }
    }
  }, [formData.countryid, formData.level, nations, transfermarktLeagues]);

  // Fetch transferable teams for first division leagues
  React.useEffect(() => {
    const fetchTransferableTeams = async () => {
      if (formData.countryid && formData.level === 1 && projectId) {
        setIsLoadingTransferableTeams(true);
        try {
          const response = await fetch(
            `http://localhost:8000/leagueteamlinks/transferable-teams?country_id=${formData.countryid}&project_id=${projectId}`
          );
          
          if (response.ok) {
            const teams = await response.json();
            setTransferableTeams(teams);
            // Automatically select all teams
            setSelectedTeamsForTransfer(new Set(teams.map((team: TransferableTeam) => team.teamid)));
          } else {
            setTransferableTeams([]);
            setSelectedTeamsForTransfer(new Set());
          }
        } catch (error) {
          console.error("Error fetching transferable teams:", error);
          setTransferableTeams([]);
          setSelectedTeamsForTransfer(new Set());
        } finally {
          setIsLoadingTransferableTeams(false);
        }
      } else {
        setTransferableTeams([]);
        setSelectedTeamsForTransfer(new Set());
      }
    };

    // Debounce transferable teams fetch
    const timeoutId = setTimeout(fetchTransferableTeams, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.countryid, formData.level, projectId]);

  // Helper function to get country flag URL
  const getCountryFlagUrl = (countryId: string): string => {
    return `http://localhost:8000/images/flags/${countryId}`;
  };

  const getCountryName = (countryId: string): string => {
    return nations[countryId]?.nationname || `Country ${countryId}`;
  };

  const getTeamLogoUrl = (teamId: string): string => {
    return `http://localhost:8000/images/teams/${teamId}`;
  };

  const handleTeamSelection = (teamId: string, isSelected: boolean) => {
    setSelectedTeamsForTransfer(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(teamId);
      } else {
        newSet.delete(teamId);
      }
      return newSet;
    });
  };

  const handleSelectAllTeams = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedTeamsForTransfer(new Set(transferableTeams.map(team => team.teamid)));
    } else {
      setSelectedTeamsForTransfer(new Set());
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.leagueid.trim()) {
      newErrors.leagueid = "League ID is required";
    }

    if (!formData.leaguename.trim()) {
      newErrors.leaguename = "League name is required";
    }

    if (!formData.countryid) {
      newErrors.countryid = "Country is required";
    }

    if (formData.level < 1 || formData.level > 5) {
      newErrors.level = "League level must be between 1 and 5";
    }

    // Check if combination validation failed (only if not using suggested league)
    if (errors.combination && !suggestedLeague) {
      newErrors.combination = errors.combination;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const leagueData = {
        leagueid: formData.leagueid.trim(),
        leaguename: formData.leaguename.trim(),
        countryid: formData.countryid,
        level: formData.level.toString(),
        leaguetype: formData.leaguetype,
        iswomencompetition: formData.iswomencompetition ? "1" : "0",
        isinternationalleague: formData.isinternationalleague ? "1" : "0",
        iscompetitionscarfenabled: formData.iscompetitionscarfenabled,
        isbannerenabled: formData.isbannerenabled,
        iscompetitionpoleflagenabled: formData.iscompetitionpoleflagenabled,
        iscompetitioncrowdcardsenabled: formData.iscompetitioncrowdcardsenabled,
        leaguetimeslice: formData.leaguetimeslice,
        iswithintransferwindow: formData.iswithintransferwindow ? "1" : "0",
      };

      const url = projectId
        ? `http://localhost:8000/leagues?project_id=${projectId}`
        : "http://localhost:8000/leagues";

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(leagueData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to add league");
      }

      const newLeague = await response.json();
      
      // Transfer selected teams if any are selected and this is a first division league
      if (formData.level === 1 && selectedTeamsForTransfer.size > 0 && projectId) {
        try {
          const transfers = Array.from(selectedTeamsForTransfer).map(teamId => {
            const team = transferableTeams.find(t => t.teamid === teamId);
            return {
              teamid: String(teamId),
              from_leagueid: String(team?.current_leagueid || ""),
              to_leagueid: String(formData.leagueid.trim())
            };
          });

          const transferResponse = await fetch(
            `http://localhost:8000/leagueteamlinks/transfer-teams?project_id=${projectId}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(transfers),
            }
          );

          if (!transferResponse.ok) {
            const errorData = await transferResponse.json();
            console.error("Failed to transfer teams:", errorData);
            console.error("Transfer request data:", transfers);
          } else {
            const result = await transferResponse.json();
            console.log("Teams transferred successfully:", result);
            
            // Call refresh function to update team counts in parent component
            if (onDataRefresh) {
              onDataRefresh();
            }
          }
        } catch (transferError) {
          console.error("Error transferring teams:", transferError);
        }
      }

      onLeagueAdded(newLeague);

      // Reset form
      setFormData({
        leagueid: "",
        leaguename: "",
        countryid: "14",
        level: 1,
        leaguetype: "0",
        iswomencompetition: false,
        isinternationalleague: false,
        iscompetitionscarfenabled: "2",
        isbannerenabled: "2",
        iscompetitionpoleflagenabled: "2",
        iscompetitioncrowdcardsenabled: "2",
        leaguetimeslice: "6",
        iswithintransferwindow: false,
      });

      // Clear validation state
      setErrors({});

      // Clear Transfermarkt leagues
      setTransfermarktLeagues([]);

      // Clear suggested league
      setSuggestedLeague(null);

      // Clear transferable teams
      setTransferableTeams([]);
      setSelectedTeamsForTransfer(new Set());

      onOpenChange(false);

    } catch (error) {
      console.error("Error adding league:", error);
      alert(`Failed to add league: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  // Convert nations object to array for dropdown
  const countriesArray = Object.values(nations).map(nation => ({
    id: nation.nationid,
    name: nation.nationname,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="2xl"
      placement="center"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Icon icon="lucide:trophy" className="text-primary h-5 w-5" />
                <span>Add New League</span>
              </div>
            </ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-4">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h4 className="text-medium font-semibold text-default-700">Basic Information</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="League ID"
                      placeholder="Auto-generated from country and level"
                      value={formData.leagueid}
                      onChange={(e) => handleInputChange("leagueid", e.target.value)}
                      isRequired
                      isReadOnly={!!suggestedLeague}
                      isInvalid={!!errors.leagueid}
                      errorMessage={errors.leagueid}
                      description={suggestedLeague ? 
                        `Found existing league: "${suggestedLeague.leaguename}"` : 
                        isLoadingSuggestion ? "Searching for existing league..." : 
                        "No existing league found - you can enter a custom ID"
                      }
                      startContent={<Icon icon="lucide:hash" className="text-default-400 h-4 w-4" />}
                      endContent={
                        <div className="flex items-center gap-1">
                          {isLoadingSuggestion && (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                          )}
                          {suggestedLeague && (
                            <Button
                              size="sm"
                              variant="light"
                              color="warning"
                              onPress={() => {
                                setSuggestedLeague(null);
                                setFormData(prev => ({ ...prev, leagueid: "" }));
                              }}
                              className="min-w-unit-0 w-6 h-6 p-0"
                            >
                              <Icon icon="lucide:x" className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      }
                      color={suggestedLeague ? "success" : "default"}
                    />

                    <Input
                      label="League Name"
                      placeholder="Enter league name or auto-generated from Transfermarkt"
                      value={formData.leaguename}
                      onChange={(e) => handleInputChange("leaguename", e.target.value)}
                      isRequired
                      isInvalid={!!errors.leaguename}
                      errorMessage={errors.leaguename}
                      description={
                        transfermarktLeagues.length > 0 && formData.leaguename.includes('(') && formData.leaguename.includes(')') ?
                        "Auto-generated from Transfermarkt data" :
                        "Enter a custom league name"
                      }
                      startContent={<Icon icon="lucide:trophy" className="text-default-400 h-4 w-4" />}
                      endContent={
                        transfermarktLeagues.length > 0 && formData.leaguename.includes('(') && formData.leaguename.includes(')') && (
                          <Button
                            size="sm"
                            variant="light"
                            color="warning"
                            onPress={() => {
                              setFormData(prev => ({ ...prev, leaguename: "" }));
                            }}
                            className="min-w-unit-0 w-6 h-6 p-0"
                          >
                            <Icon icon="lucide:x" className="h-3 w-3" />
                          </Button>
                        )
                      }
                      color={
                        transfermarktLeagues.length > 0 && formData.leaguename.includes('(') && formData.leaguename.includes(')') ?
                        "success" : "default"
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="Country"
                      placeholder="Select country"
                      selectedKeys={formData.countryid ? [formData.countryid] : []}
                      onSelectionChange={(keys) => handleInputChange("countryid", Array.from(keys)[0] || "")}
                      isRequired
                      isInvalid={!!(errors.countryid || errors.combination)}
                      errorMessage={errors.countryid || (errors.combination && "Please select a different country or level")}
                      renderValue={(items) => {
                        return items.map((item) => {
                          const country = countriesArray.find(c => c.id === item.key);
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
                      {countriesArray.map((country) => (
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

                    <NumberInput
                      label="League Level"
                      placeholder="Enter league level"
                      value={formData.level}
                      onValueChange={(value) => handleInputChange("level", value)}
                      minValue={1}
                      maxValue={5}
                      isRequired
                      isInvalid={!!(errors.level || errors.combination)}
                      errorMessage={errors.level || (errors.combination && errors.combination)}
                      startContent={<Icon icon="lucide:layers" className="text-default-400 h-4 w-4" />}
                      endContent={isValidating && (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="League Type"
                      selectedKeys={[formData.leaguetype]}
                      onSelectionChange={(keys) => handleInputChange("leaguetype", Array.from(keys)[0])}
                    >
                      <SelectItem key="0">Regular League</SelectItem>
                      <SelectItem key="1">Cup Competition</SelectItem>
                      <SelectItem key="2">Tournament</SelectItem>
                    </Select>

                    <Select
                      label="Time Slice"
                      selectedKeys={[formData.leaguetimeslice]}
                      onSelectionChange={(keys) => handleInputChange("leaguetimeslice", Array.from(keys)[0])}
                    >
                      <SelectItem key="0">No Time Slice</SelectItem>
                      <SelectItem key="3">Time Slice 3</SelectItem>
                      <SelectItem key="4">Time Slice 4</SelectItem>
                      <SelectItem key="5">Time Slice 5</SelectItem>
                      <SelectItem key="6">Time Slice 6</SelectItem>
                      <SelectItem key="7">Time Slice 7</SelectItem>
                      <SelectItem key="8">Time Slice 8</SelectItem>
                      <SelectItem key="9">Time Slice 9</SelectItem>
                      <SelectItem key="12">Time Slice 12</SelectItem>
                      <SelectItem key="13">Time Slice 13</SelectItem>
                    </Select>
                  </div>
                </div>

                {/* Transfermarkt Leagues */}
                {(formData.countryid && formData.level && (transfermarktLeagues.length > 0 || isLoadingTransfermarkt)) && (
                  <>
                    <Divider />
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h4 className="text-medium font-semibold text-default-700">Transfermarkt Leagues</h4>
                        {isLoadingTransfermarkt && (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                        )}
                      </div>
                      
                      {isLoadingTransfermarkt ? (
                        <div className="text-sm text-default-500">Loading leagues from Transfermarkt...</div>
                      ) : transfermarktLeagues.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-sm text-default-600">
                            Found {transfermarktLeagues.length} league(s) for {nations[formData.countryid]?.nationname} (Division {formData.level}):
                          </p>
                          <div className="grid gap-2">
                            {transfermarktLeagues.map((league, index) => (
                              <div key={index} className="p-3 border border-default-200 rounded-lg bg-default-50">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      {league.competition_logo_url && (
                                        <img
                                          src={league.competition_logo_url}
                                          alt={`${league.competition} logo`}
                                          className="w-5 h-5 object-contain"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                          }}
                                        />
                                      )}
                                      <span className="font-medium text-sm">{league.competition}</span>
                                      <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                                        Tier {league.tier}
                                      </span>
                                    </div>
                                    <div className="text-xs text-default-500 space-y-1">
                                      <div>Clubs: {league.clubs}</div>
                                      {league.total_value && (
                                        <div>Total Value: {league.total_value}</div>
                                      )}
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="flat"
                                    color="primary"
                                    startContent={<Icon icon="lucide:external-link" className="h-3 w-3" />}
                                    onPress={() => window.open(league.competition_url, '_blank')}
                                  >
                                    View
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-default-500">
                          No leagues found on Transfermarkt for {nations[formData.countryid]?.nationname} (Division {formData.level})
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Transferable Teams for First Division */}
                {(formData.level === 1 && formData.countryid && projectId && (transferableTeams.length > 0 || isLoadingTransferableTeams)) && (
                  <>
                    <Divider />
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h4 className="text-medium font-semibold text-default-700">Teams to Transfer</h4>
                        {isLoadingTransferableTeams && (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                        )}
                      </div>
                      
                      {isLoadingTransferableTeams ? (
                        <div className="text-sm text-default-500">Loading teams...</div>
                      ) : transferableTeams.length > 0 ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-default-600">
                              Found {transferableTeams.length} team(s) from {nations[formData.countryid]?.nationname} that will be transferred to this first division league:
                            </p>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="flat"
                                color="primary"
                                onPress={() => handleSelectAllTeams(true)}
                                isDisabled={selectedTeamsForTransfer.size === transferableTeams.length}
                              >
                                Select All
                              </Button>
                              <Button
                                size="sm"
                                variant="flat"
                                color="default"
                                onPress={() => handleSelectAllTeams(false)}
                                isDisabled={selectedTeamsForTransfer.size === 0}
                              >
                                Clear All
                              </Button>
                            </div>
                          </div>
                          
                          <div className="grid gap-2 max-h-48 overflow-y-auto">
                            {transferableTeams.map((team) => (
                              <div key={team.teamid} className="p-3 border border-default-200 rounded-lg bg-default-50">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <Checkbox
                                      isSelected={selectedTeamsForTransfer.has(team.teamid)}
                                      onValueChange={(isSelected) => handleTeamSelection(team.teamid, isSelected)}
                                    />
                                    <div className="flex items-center gap-2">
                                      <img
                                        src={getTeamLogoUrl(team.teamid)}
                                        alt={`${team.teamname} logo`}
                                        className="w-6 h-6 object-contain"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                      />
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">{team.teamname}</div>
                                        <div className="text-xs text-default-500">
                                          Currently in: {team.current_leaguename} (ID: {team.current_leagueid})
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-xs text-default-400">
                                    Team ID: {team.teamid}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {selectedTeamsForTransfer.size > 0 && (
                            <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg">
                              <div className="flex items-center gap-2 text-sm text-primary-700">
                                <Icon icon="lucide:info" className="h-4 w-4" />
                                <span>
                                  {selectedTeamsForTransfer.size} team(s) will be transferred to this league when created
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-default-500">
                          No teams found for {nations[formData.countryid]?.nationname}
                        </div>
                      )}
                    </div>
                  </>
                )}

                <Divider />

                {/* League Properties */}
                <div className="space-y-4">
                  <h4 className="text-medium font-semibold text-default-700">League Properties</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Switch
                      isSelected={formData.iswomencompetition}
                      onValueChange={(value) => handleInputChange("iswomencompetition", value)}
                    >
                      Women's Competition
                    </Switch>

                    <Switch
                      isSelected={formData.isinternationalleague}
                      onValueChange={(value) => handleInputChange("isinternationalleague", value)}
                    >
                      International League
                    </Switch>

                    <Switch
                      isSelected={formData.iswithintransferwindow}
                      onValueChange={(value) => handleInputChange("iswithintransferwindow", value)}
                    >
                      Within Transfer Window
                    </Switch>
                  </div>
                </div>

                <Divider />

                {/* Competition Features */}
                <div className="space-y-4">
                  <h4 className="text-medium font-semibold text-default-700">Competition Features</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="Competition Scarfs"
                      selectedKeys={[formData.iscompetitionscarfenabled]}
                      onSelectionChange={(keys) => handleInputChange("iscompetitionscarfenabled", Array.from(keys)[0])}
                    >
                      <SelectItem key="0">Enabled</SelectItem>
                      <SelectItem key="1">Partially Enabled</SelectItem>
                      <SelectItem key="2">Disabled</SelectItem>
                    </Select>

                    <Select
                      label="Banners"
                      selectedKeys={[formData.isbannerenabled]}
                      onSelectionChange={(keys) => handleInputChange("isbannerenabled", Array.from(keys)[0])}
                    >
                      <SelectItem key="0">Enabled</SelectItem>
                      <SelectItem key="1">Partially Enabled</SelectItem>
                      <SelectItem key="2">Disabled</SelectItem>
                    </Select>

                    <Select
                      label="Pole Flags"
                      selectedKeys={[formData.iscompetitionpoleflagenabled]}
                      onSelectionChange={(keys) => handleInputChange("iscompetitionpoleflagenabled", Array.from(keys)[0])}
                    >
                      <SelectItem key="0">Enabled</SelectItem>
                      <SelectItem key="1">Partially Enabled</SelectItem>
                      <SelectItem key="2">Disabled</SelectItem>
                    </Select>

                    <Select
                      label="Crowd Cards"
                      selectedKeys={[formData.iscompetitioncrowdcardsenabled]}
                      onSelectionChange={(keys) => handleInputChange("iscompetitioncrowdcardsenabled", Array.from(keys)[0])}
                    >
                      <SelectItem key="0">Enabled</SelectItem>
                      <SelectItem key="1">Partially Enabled</SelectItem>
                      <SelectItem key="2">Disabled</SelectItem>
                    </Select>
                  </div>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                color="default"
                variant="light"
                onPress={onClose}
                isDisabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                color="primary"
                onPress={handleSubmit}
                isLoading={isSubmitting}
                isDisabled={isSubmitting || isValidating || !!errors.combination}
                startContent={!isSubmitting && <Icon icon="lucide:plus" className="h-4 w-4" />}
              >
                {isSubmitting ? "Adding..." : "Add League"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
} 