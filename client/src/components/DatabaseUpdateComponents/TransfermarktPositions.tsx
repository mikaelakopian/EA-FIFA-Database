import React, { useEffect, useState } from 'react';
import {
  Breadcrumbs,
  BreadcrumbItem,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
  Select,
  SelectItem,
  Chip,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure
} from "@heroui/react";

interface TransfermarktPositionsProps {
  onClose: () => void;
}

interface Position {
  id: string;
  name: string;
}

const TransfermarktPositions: React.FC<TransfermarktPositionsProps> = ({ onClose }) => {
  const [tmPositions, setTmPositions] = useState<Position[]>([]);
  const [sofifaPositions, setSofifaPositions] = useState<Position[]>([]);
  const [positionMappings, setPositionMappings] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tableKey, setTableKey] = useState<number>(0);
  
  // Modal states
  const {isOpen: isSuccessOpen, onOpen: onSuccessOpen, onClose: onSuccessClose} = useDisclosure();
  const {isOpen: isErrorOpen, onOpen: onErrorOpen, onClose: onErrorClose} = useDisclosure();
  const [modalMessage, setModalMessage] = useState<string>('');
  const [modalTitle, setModalTitle] = useState<string>('');

  // Calculate mapping statistics
  const actualMappedTmCount = Object.values(positionMappings).filter(ids => ids && ids.length > 0).length;
  const allSofifaIdsInMappings = Object.values(positionMappings).flat();
  const actualUniqueSofifaUsedInMappings = new Set(allSofifaIdsInMappings).size;

  const tmCoveragePercentage = tmPositions.length > 0 ? (actualMappedTmCount / tmPositions.length) * 100 : 0;
  const sofifaCoveragePercentage = sofifaPositions.length > 0 ? (actualUniqueSofifaUsedInMappings / sofifaPositions.length) * 100 : 0;

  const defaultMappingsConfig: Record<string, string[]> = {
    'Goalkeeper': ['0'], // GK
    'Sweeper': ['5'], // CB
    'Centre-Back': ['5'], // CB
    'Left-Back': ['7', '8'], // LB, LWB
    'Right-Back': ['3', '2'], // RB, RWB
    'Defensive Midfield': ['10'], // CDM
    'Central Midfield': ['14'], // CM
    'Right Midfield': ['12'], // RM
    'Left Midfield': ['16'], // LM
    'Attacking Midfield': ['18'], // CAM
    'Left Winger': ['27', '22'], // LW, LF
    'Right Winger': ['23', '20'], // RW, RF
    'Second Striker': ['21'], // CF
    'Centre-Forward': ['25', '21'], // ST, CF
  };

  const handleAutoMap = () => {
    if (tmPositions.length === 0 || sofifaPositions.length === 0) {
      setModalTitle('Error');
      setModalMessage('Please wait for both Transfermarkt and SoFIFA positions to load.');
      onErrorOpen();
      return;
    }

    const availableSofifaIds = new Set(sofifaPositions.map(p => p.id));
    const newMappings: Record<string, string[]> = {};
    let unmappedPositions: string[] = []; // Track positions that couldn't be mapped

    tmPositions.forEach(tmPos => {
      const tmPosName = tmPos.name;
      const sofifaIdsFromConfig = defaultMappingsConfig[tmPosName];

      if (sofifaIdsFromConfig) {
        const validSofifaIds = sofifaIdsFromConfig.filter(id => availableSofifaIds.has(id));
        newMappings[tmPos.id] = validSofifaIds;
        console.log(`[DEBUG] Mapped TM position "${tmPosName}" (ID: ${tmPos.id}) to SoFIFA IDs:`, validSofifaIds);
      } else {
        newMappings[tmPos.id] = [];
        unmappedPositions.push(`"${tmPosName}" (ID: ${tmPos.id})`);
        console.log(`[DEBUG] No mapping found for TM position "${tmPosName}" (ID: ${tmPos.id})`);
      }
    });
    
    if (unmappedPositions.length > 0) {
      console.warn('[DEBUG] Unmapped TM positions:', unmappedPositions);
    }
    
    console.log('[DEBUG] newMappings in handleAutoMap:', newMappings);
    
    // Force update by clearing first, then setting new values
    setPositionMappings({});
    setTimeout(() => {
      setPositionMappings(newMappings);
      setTableKey(prev => prev + 1);
      setModalTitle('Success');
      setModalMessage('Positions have been auto-mapped based on default rules!');
      onSuccessOpen();
    }, 100);
  };

  useEffect(() => {
    const fetchAllPositions = async () => {
      setLoading(true);
      setError(null);
      try {
        const [tmResponse, sofifaResponse] = await Promise.all([
          fetch("http://localhost:8000/transfermarkt/player_main_positions"),
          fetch("http://localhost:8000/sofifa/player_positions")
        ]);

        const errors: string[] = [];

        if (tmResponse.ok) {
          const data: Position[] = await tmResponse.json();
          setTmPositions(data);
          console.log('[DEBUG] Loaded TM positions:', data);
        } else {
          errors.push(`Transfermarkt error: ${tmResponse.status}`);
        }

        if (sofifaResponse.ok) {
          const dataRaw: Position[] = await sofifaResponse.json();
          const sorted = dataRaw.sort((a, b) => +a.id - +b.id);
          setSofifaPositions(sorted);
          console.log('[DEBUG] Loaded SoFIFA positions:', sorted);
        } else {
          errors.push(`SoFIFA error: ${sofifaResponse.status}`);
        }

        if (errors.length) setError(errors.join("; "));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    fetchAllPositions();
  }, []);

  // useEffect to log positionMappings changes
  useEffect(() => {
    console.log('[DEBUG] positionMappings updated:', positionMappings);
  }, [positionMappings]);

  const handleMappingChange = (rowTmPositionId: string, selectedSofifaIdSet: Set<React.Key> | null) => {
    setPositionMappings(prev => {
      const updated = { ...prev };
      if (selectedSofifaIdSet && selectedSofifaIdSet.size > 0) {
        updated[rowTmPositionId] = Array.from(selectedSofifaIdSet).map(String);
      } else {
        updated[rowTmPositionId] = [];
      }
      return updated;
    });
  };

  const handleSave = async () => {
    console.log('Attempting to save Mappings TM -> FC:', positionMappings);

    // Find TM and SoFIFA positions by ID for name lookup
    const tmPositionsById = tmPositions.reduce((acc, pos) => {
      acc[pos.id] = pos;
      return acc;
    }, {} as Record<string, Position>);

    const sofifaPositionsById = sofifaPositions.reduce((acc, pos) => {
      acc[pos.id] = pos;
      return acc;
    }, {} as Record<string, Position>);

    const transformedMappings: Record<string, [string, string][]> = {};

    for (const tmId in positionMappings) {
      const tmPosition = tmPositionsById[tmId];
      if (tmPosition) {
        const sofifaIdList = positionMappings[tmId];
        transformedMappings[tmPosition.name] = sofifaIdList
          .map(sfId => {
            const sofifaPosition = sofifaPositionsById[sfId];
            return sofifaPosition ? [sofifaPosition.name, sofifaPosition.id] : null;
          })
          .filter(Boolean) as [string, string][]; // Filter out nulls if a SoFIFA ID wasn't found (shouldn't happen)
      }
    }

    console.log('Transformed Mappings to be saved:', transformedMappings);

    try {
      const response = await fetch("http://localhost:8000/db/save_position_mappings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mappings: transformedMappings }), // Send transformed mappings
      });

      const result = await response.json();

      if (response.ok) {
        setModalTitle('Mappings Saved Successfully');
        setModalMessage(result.message || 'Mappings have been saved to the server.');
        onSuccessOpen();
      } else {
        setModalTitle('Error Saving Mappings');
        setModalMessage(result.detail || 'An error occurred while saving mappings.');
        onErrorOpen();
      }
    } catch (error) {
      console.error("Network or other error saving mappings:", error);
      setModalTitle('Network Error');
      setModalMessage("Could not connect to the server to save mappings. Please check your connection and try again.");
      onErrorOpen();
    }
  };

  return (
    <div>
      <Breadcrumbs onAction={(key) => key === 'database-update' && onClose()}>
        <BreadcrumbItem key="database-update" href="#">Database Update</BreadcrumbItem>
        <BreadcrumbItem key="positions-dictionary" isCurrent>
          Player Positions Mapping (TM to FC)
        </BreadcrumbItem>
      </Breadcrumbs>

      <div className="flex justify-between items-center mt-4 mb-2">
        <h2 className="text-xl font-semibold">Map Transfermarkt Positions to FC Positions</h2>
        <div className="flex gap-2">
          <Button 
            color="primary" 
            variant="flat" 
            onPress={handleAutoMap} 
            isDisabled={loading || tmPositions.length === 0 || sofifaPositions.length === 0}
          >
            Auto-map Positions
          </Button>
          <Button 
            color="success" 
            onPress={handleSave} 
            isDisabled={loading || !tmPositions.length}
          >
            Save Mappings
          </Button>
        </div>
      </div>

      {/* Mapping Statistics */}
      {!loading && !error && tmPositions.length > 0 && sofifaPositions.length > 0 && (
        <div className="mb-4 p-3 border border-default-200 rounded-lg bg-default-50">
          <h3 className="text-md font-semibold text-default-700 mb-2">Mapping Coverage:</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-default-600">Transfermarkt Positions Mapped:</p>
              <p className="font-bold text-primary">{actualMappedTmCount} / {tmPositions.length} ({tmCoveragePercentage.toFixed(1)}%)</p>
            </div>
            <div>
              <p className="text-default-600">SoFIFA (FC) Positions Used (Unique):</p>
              <p className="font-bold text-secondary">{actualUniqueSofifaUsedInMappings} / {sofifaPositions.length} ({sofifaCoveragePercentage.toFixed(1)}%)</p>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center items-center h-40">
          <CircularProgress size="lg" aria-label="Loading positions..." />
        </div>
      )}

      {error && (
        <div className="p-4 my-4 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && tmPositions.length === 0 && (
        <p className="text-default-500">No Transfermarkt positions found to map.</p>
      )}

      {!loading && !error && tmPositions.length > 0 && sofifaPositions.length === 0 && (
        <p className="text-default-500">Transfermarkt positions loaded, but FC positions are unavailable for mapping.</p>
      )}
      
      {!loading && !error && tmPositions.length > 0 && sofifaPositions.length > 0 && (
        <Table 
          key={tableKey}
          aria-label="Player Positions Mapping (TM to FC)" 
          className="mt-4"
        >
          <TableHeader>
            <TableColumn>TM Position ID</TableColumn>
            <TableColumn>TM Position Name</TableColumn>
            <TableColumn>Map to FC Position</TableColumn>
          </TableHeader>
          <TableBody items={tmPositions} emptyContent="No Transfermarkt positions to display.">
            {(tmPosRow: Position) => {
              const mappedSofifaIdArray = positionMappings[tmPosRow.id] || [];
              console.log(`[DEBUG] Rendering Select for TM ID: ${tmPosRow.id}, Mapped SoFIFA IDs:`, mappedSofifaIdArray);

              return (
                <TableRow key={tmPosRow.id}>
                  <TableCell>{tmPosRow.id}</TableCell>
                  <TableCell>{tmPosRow.name}</TableCell>
                  <TableCell>
                    {sofifaPositions.length > 0 ? (
                      <Select
                        key={`select-${tmPosRow.id}-${mappedSofifaIdArray.join(',')}`}
                        aria-label={`Map TM Position ${tmPosRow.name} to FC Position`}
                        items={sofifaPositions}
                        placeholder="Select FC position(s)"
                        selectionMode="multiple"
                        isMultiline={true}
                        defaultSelectedKeys={new Set(mappedSofifaIdArray)}
                        onSelectionChange={(keys) => {
                          console.log('[DEBUG] Select onSelectionChange fired');
                          console.log('[DEBUG] TM ID:', tmPosRow.name, tmPosRow.id);
                          console.log('[DEBUG] Selected FC Keys Set:', keys);
                          handleMappingChange(tmPosRow.id, keys as Set<React.Key> | null);
                        }}
                        renderValue={(selectedItems) => (
                          <div className="flex flex-wrap gap-1">
                            {selectedItems.map((item) => (
                              <Chip key={item.key ?? item.textValue} size="sm">
                                {item.data?.name ?? item.textValue}
                              </Chip>
                            ))}
                          </div>
                        )}
                        className="w-full"
                        classNames={{
                          trigger: "min-h-12 py-2",
                        }}
                      >
                        {(item: Position) => (
                          <SelectItem 
                            key={item.id} 
                            textValue={`${item.name} (ID: ${item.id})`}
                          >
                            {`${item.name} (ID: ${item.id})`}
                          </SelectItem>
                        )}
                      </Select>
                    ) : (
                      <span className="text-default-500 text-sm">Loading FC positions...</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            }}
          </TableBody>
        </Table>
      )}

      {/* Success Modal */}
      <Modal isOpen={isSuccessOpen} onClose={onSuccessClose}>
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">{modalTitle}</ModalHeader>
          <ModalBody>
            <p>{modalMessage}</p>
          </ModalBody>
          <ModalFooter>
            <Button color="primary" variant="light" onPress={onSuccessClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Error Modal */}
      <Modal isOpen={isErrorOpen} onClose={onErrorClose}>
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1 text-danger">{modalTitle}</ModalHeader>
          <ModalBody>
            <p className="text-danger">{modalMessage}</p>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={onErrorClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default TransfermarktPositions;
