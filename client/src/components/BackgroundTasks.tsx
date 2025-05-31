import React from "react";
import {
  Card,
  CardBody,
  CircularProgress,
  Divider,
  Chip,
} from "@heroui/react";
import { Icon } from "@iconify/react";

interface ProcessData {
  function_name?: string;
  status?: string;
  percentage?: number;
  teamname?: string;
  playername?: string;
  current?: number;
  total?: number;
  estimated_time_remaining?: string;
  found_links?: number;
  found_percentage?: number;
}

interface BackgroundTasksProps {
  processes: ProcessData[];
  wsConnected: boolean;
}

export const BackgroundTasks: React.FC<BackgroundTasksProps> = ({ 
  processes, 
  wsConnected 
}) => {
  const [expandedProcesses, setExpandedProcesses] = React.useState<Set<string>>(new Set());

  const toggleProcessDetails = (processKey: string) => {
    setExpandedProcesses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(processKey)) {
        newSet.delete(processKey);
      } else {
        newSet.add(processKey);
      }
      return newSet;
    });
  };

  return (
    <Card>
      <CardBody className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold">Фоновые задачи</h4>
          <div className="flex items-center gap-2">
            {wsConnected && (
              <Chip size="sm" color="success" variant="flat">
                <Icon icon="lucide:wifi" className="w-3 h-3" />
              </Chip>
            )}
            {!wsConnected && (
              <Chip size="sm" color="warning" variant="flat">
                <Icon icon="lucide:wifi-off" className="w-3 h-3" />
              </Chip>
            )}
          </div>
        </div>
        
        <Divider className="mb-3" />
        
        {processes.length > 0 ? (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {processes.map((processData, index) => {
              const processKey = `${processData.function_name}-${index}`;
              const isExpanded = expandedProcesses.has(processKey);
              
              return (
                <div key={processKey} className="space-y-3">
                  {/* Название функции - кликабельное */}
                  <div
                    className={`rounded-lg p-2 border cursor-pointer ${
                      processData.status === "completed"
                        ? "bg-success-50 border-success-200"
                        : "bg-primary-50 border-primary-200"
                    }`}
                    onClick={() => toggleProcessDetails(processKey)}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <CircularProgress
                        value={processData.percentage || 0}
                        size="sm"
                        color={processData.status === "completed" ? "success" : "primary"}
                        showValueLabel={false}
                        strokeWidth={5}
                        classNames={{
                          svg: "w-5 h-5",
                        }}
                      />
                      <span className={`text-sm font-medium ${
                        processData.status === "completed" ? "text-success-800" : "text-primary-800"
                      }`}>
                        {processData.function_name || "Обработка данных"}
                      </span>
                      <Icon
                        icon="lucide:chevron-down"
                        className={`w-4 h-4 ml-auto transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        } ${
                          processData.status === "completed" ? "text-success-600" : "text-primary-600"
                        }`}
                      />
                    </div>
                  </div>

                  {/* Детали процесса - показываются только при раскрытии */}
                  {isExpanded && (
                    <div className="space-y-3 pl-2">
                      <div className="flex items-center gap-3">
                        <CircularProgress
                          value={processData.percentage || 0}
                          size="sm"
                          color={processData.status === "completed" ? "success" : "primary"}
                          showValueLabel={true}
                          valueLabel={`${Math.round(processData.percentage || 0)}%`}
                          classNames={{
                            svg: "w-10 h-10",
                            value: "text-xs font-medium"
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-default-800 truncate">
                            {processData.teamname || processData.playername || "Обработка..."}
                          </div>
                          <div className="text-xs text-default-600">
                            {processData.current || 0} из {processData.total || 0} {
                              processData.function_name === "process_players_and_save_links" ? "игроков" : "команд"
                            }
                          </div>
                        </div>
                      </div>
                      
                      {processData.estimated_time_remaining && processData.status !== "completed" && (
                        <div className="flex justify-between text-xs text-default-600">
                          <span>Осталось времени:</span>
                          <span>{processData.estimated_time_remaining}</span>
                        </div>
                      )}
                      
                      {processData.found_links !== undefined && (
                        <div className="flex justify-between text-xs text-default-600">
                          <span>Найдено ссылок:</span>
                          <span>{processData.found_links} ({processData.found_percentage?.toFixed(1)}%)</span>
                        </div>
                      )}
                      
                      {processData.status === "completed" && (
                        <div className="text-xs text-success-600 text-center mt-2 bg-success-50 rounded-lg p-2">
                          🎉 Задача завершена!
                        </div>
                      )}
                    </div>
                  )}
                  
                  {index < processes.length - 1 && <Divider />}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-sm text-default-500">
            <Icon icon="lucide:check-circle" className="w-8 h-8 mx-auto mb-2 text-default-300" />
            <div>Нет активных задач</div>
          </div>
        )}
      </CardBody>
    </Card>
  );
};