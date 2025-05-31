import React from "react";
import {
  Card,
  CardBody,
  Chip,
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  CircularProgress,
} from "@heroui/react";
import { Icon } from "@iconify/react";

// Define the structure of player data for the table
interface PlayerForTable {
  number: string;
  name: string;
  position: string;
  nationality: string;
  value: string;
  url: string;
  processing_status?: 'pending' | 'processing' | 'completed' | 'error';
  processing_progress?: number;
  player_id?: string;
}

// Define the structure for the teamData prop specific to player processing
interface PlayerProcessingData {
  player_processing_status?: string;
  player_processing_message?: string;
  players_parsed_count?: number;
  parsed_players_for_table?: PlayerForTable[];
  current_processing_player?: string; // ID of player currently being processed
  players_processing_progress?: Record<string, {
    status: 'pending' | 'processing' | 'completed' | 'error';
    progress: number;
    message?: string;
  }>;
  teamname?: string; // Add teamname to identify the team
}

interface PlayerProcessingProps {
  teamData?: PlayerProcessingData;
  isCompleted: boolean; // Overall completion status for the team
  isCurrent: boolean;   // Is this team the one currently being processed globally?
  currentCategory: string | null; // The specific category being processed for this team (if isCurrent)
  // categoryOrder might be needed if decisions depend on whether player processing has passed
  // For now, assuming display is primarily based on teamData presence and player_processing_status
}

const PlayerProcessing: React.FC<PlayerProcessingProps> = ({
  teamData,
  isCompleted,
  isCurrent,
  currentCategory,
}) => {
  const [localPlayerProgress, setLocalPlayerProgress] = React.useState<Record<string, {
    status: 'pending' | 'processing' | 'completed' | 'error';
    progress: number;
    message?: string;
  }>>({});
  
  // Determine if the player processing step itself has been completed or is the active one
  // Show the card when parsing is done or when we're currently in parsing/saving phase
  const showPlayerProcessingCard = 
    teamData?.player_processing_status &&
    (isCompleted || (isCurrent && (currentCategory === "⚽ Processing team players" || currentCategory === "💾 Saving team players")));

  const isParsingPhase = currentCategory === "⚽ Processing team players";
  const isSavingPhase = currentCategory === "💾 Saving team players";

  // Scroll to the player table when it first appears
  React.useEffect(() => {
    if (showPlayerProcessingCard && teamData?.parsed_players_for_table && teamData.parsed_players_for_table.length > 0) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const element = document.getElementById(`player-table-${teamData.teamname || 'team'}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [showPlayerProcessingCard, teamData?.parsed_players_for_table?.length, teamData?.teamname]);

  // Update local player progress when server data changes
  React.useEffect(() => {
    if (teamData?.players_processing_progress) {
      setLocalPlayerProgress(prev => ({
        ...prev,
        ...teamData.players_processing_progress
      }));
    }
  }, [teamData?.players_processing_progress]);

  // Update current processing player with animation delay
  React.useEffect(() => {
    if (isSavingPhase && teamData?.current_processing_player) {
      const playerKey = teamData.current_processing_player;
      
      // Add 1 second delay before starting player processing
      const timeout = setTimeout(() => {
        setLocalPlayerProgress(prev => ({
          ...prev,
          [playerKey]: {
            status: 'processing',
            progress: 0,
            message: 'Processing player data...'
          }
        }));
        
        // Simulate progress animation for better visual feedback
        let progress = 0;
        const progressInterval = setInterval(() => {
          progress += 10;
          setLocalPlayerProgress(prev => ({
            ...prev,
            [playerKey]: {
              status: 'processing',
              progress: Math.min(progress, 90), // Don't go to 100% until server confirms
              message: 'Processing player data...'
            }
          }));
          
          if (progress >= 90) {
            clearInterval(progressInterval);
          }
        }, 100);
        
        // Clear interval after 2 seconds max
        setTimeout(() => clearInterval(progressInterval), 2000);
      }, 1000);
      
      return () => clearTimeout(timeout);
    }
  }, [isSavingPhase, teamData?.current_processing_player]);

  // Scroll to current processing player
  React.useEffect(() => {
    if (isSavingPhase && teamData?.current_processing_player) {
      setTimeout(() => {
        const element = document.getElementById(`player-row-${teamData.current_processing_player}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 1100); // Delay to account for processing delay
    }
  }, [isSavingPhase, teamData?.current_processing_player]);

  if (!showPlayerProcessingCard) {
    return null;
  }

  return (
    <Card>
      <CardBody className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Icon icon="lucide:users-round" className="h-4 w-4 text-cyan-600" />
          <h4 className="font-semibold text-default-700 text-sm">Player Processing</h4>
          {teamData.player_processing_status && (
            <Chip
              size="sm"
              color={
                teamData.player_processing_status === "success" ? "success" :
                teamData.player_processing_status === "error" ? "danger" : "warning"
              }
              variant="flat"
            >
              {teamData.player_processing_status}
            </Chip>
          )}
        </div>
        <div className="space-y-2 text-sm">
          {teamData.player_processing_message && (
            <div>
              <div className="text-xs text-default-500 mb-1">Status Message</div>
              <div
                className={`font-medium text-xs ${
                  teamData.player_processing_status === "success" ? "text-success-600" :
                  teamData.player_processing_status === "error" ? "text-danger-600" : "text-warning-600"
                }`}
              >
                {teamData.player_processing_message}
              </div>
            </div>
          )}
          {typeof teamData.players_parsed_count === 'number' && (
            <div>
              <div className="text-xs text-default-500 mb-1">Players Parsed</div>
              <div className="font-medium text-default-700 text-xs">
                {teamData.players_parsed_count}
              </div>
            </div>
          )}
          {teamData.player_processing_status === "success" && 
           teamData.players_parsed_count !== undefined && 
           teamData.players_parsed_count > 0 && (
            <div className="pt-2 border-t border-default-200">
              <div className="flex items-center gap-2 text-success-600">
                <Icon icon="lucide:check-circle" className="h-4 w-4" />
                <span className="text-sm font-medium">Team players processed successfully.</span>
              </div>
            </div>
          )}
          {/* Display Parsed Players Table */}
          {teamData.parsed_players_for_table && teamData.parsed_players_for_table.length > 0 && (
            <div className="mt-3 pt-3 border-t border-default-200" id={`player-table-${teamData.teamname || 'team'}`}>
              <h5 className="text-xs font-semibold text-default-600 mb-2">
                Full Player List ({teamData.parsed_players_for_table.length})
              </h5>
              <div className="pr-1 relative">
                <Table
                  aria-label="Player list table"
                  isStriped
                  removeWrapper
                >
                  <TableHeader>
                    <TableColumn className="w-12">#</TableColumn>
                    <TableColumn className="flex-1">Player Name</TableColumn>
                    <TableColumn className="w-24">Position</TableColumn>
                    <TableColumn className="w-32">Nationality</TableColumn>
                    <TableColumn className="w-20 text-right">Value</TableColumn>
                    <TableColumn className="w-24 text-center">Status</TableColumn>
                  </TableHeader>
                  <TableBody items={teamData.parsed_players_for_table || []} emptyContent={"No players to display."}>
                    {(item) => {
                      const playerKey = `${item.number}-${item.name}`;
                      const processingInfo = localPlayerProgress[playerKey] || teamData?.players_processing_progress?.[playerKey];
                      const isCurrentlyProcessing = teamData?.current_processing_player === playerKey && isSavingPhase;
                      
                      return (
                        <TableRow 
                          key={String(item.number || Math.random()) + '-' + String(item.name || 'name') + '-' + String(item.url || 'url') + '-' + String(Math.random())}
                          id={`player-row-${playerKey}`}
                          className={isCurrentlyProcessing ? "bg-primary-50 border-l-4 border-l-primary-500" : ""}
                        >
                          <TableCell><>{item.number || ''}</></TableCell>
                          <TableCell className="truncate">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:text-primary-500 hover:underline"
                              title={item.name || ''}
                            >
                              <>{item.name || ''}</>
                            </a>
                          </TableCell>
                          <TableCell><>{item.position || ''}</></TableCell>
                          <TableCell><>{item.nationality || ''}</></TableCell>
                          <TableCell className="text-right"><>{item.value || ''}</></TableCell>
                          <TableCell className="text-center">
                            {isSavingPhase ? (
                              <div className="flex items-center justify-center gap-2">
                                {processingInfo?.status === 'processing' ? (
                                  <CircularProgress
                                    size="sm"
                                    value={processingInfo.progress}
                                    color="primary"
                                    showValueLabel={true}
                                    classNames={{
                                      svg: "w-12 h-12",
                                      indicator: "stroke-primary",
                                      track: "stroke-default-200",
                                      value: "text-xs font-medium"
                                    }}
                                  />
                                ) : processingInfo?.status === 'completed' ? (
                                  <Chip
                                    size="sm"
                                    color="success"
                                    variant="flat"
                                    startContent={<Icon icon="lucide:check" className="h-3 w-3" />}
                                  >
                                    Saved
                                  </Chip>
                                ) : processingInfo?.status === 'error' ? (
                                  <Chip
                                    size="sm"
                                    color="danger"
                                    variant="flat"
                                    startContent={<Icon icon="lucide:x" className="h-3 w-3" />}
                                  >
                                    Error
                                  </Chip>
                                ) : isCurrentlyProcessing ? (
                                  <div className="flex items-center gap-2">
                                    <CircularProgress
                                      size="sm"
                                      value={0}
                                      color="primary"
                                      isIndeterminate
                                      classNames={{
                                        svg: "w-6 h-6",
                                      }}
                                    />
                                    <span className="text-xs text-primary-600 font-medium">Processing...</span>
                                  </div>
                                ) : (
                                  <Chip
                                    size="sm"
                                    color="default"
                                    variant="flat"
                                  >
                                    Pending
                                  </Chip>
                                )}
                              </div>
                            ) : item.player_id ? (
                              <Chip
                                size="sm"
                                color="success"
                                variant="flat"
                                startContent={<Icon icon="lucide:check" className="h-3 w-3" />}
                              >
                                Saved
                              </Chip>
                            ) : (
                              <Chip
                                size="sm"
                                color="default"
                                variant="flat"
                              >
                                Ready
                              </Chip>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    }}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

export default React.memo(PlayerProcessing);
