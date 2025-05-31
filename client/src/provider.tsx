import type { NavigateOptions } from "react-router-dom";

import { HeroUIProvider } from "@heroui/system";
import { useHref, useNavigate } from "react-router-dom";
import { ProgressProvider, useProgress } from "./context/ProgressContext";
import { Card, CardBody, Chip, Button, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

declare module "@react-types/shared" {
  interface RouterConfig {
    routerOptions: NavigateOptions;
  }
}

// Компонент для отображения статуса WebSocket соединения
const WebSocketStatus: React.FC = () => {
  const { wsConnected, forceReconnect } = useProgress();
  const [isReconnecting, setIsReconnecting] = React.useState(false);

  const handleForceReconnect = async () => {
    setIsReconnecting(true);
    forceReconnect();
    // Даем время на переподключение
    setTimeout(() => {
      setIsReconnecting(false);
    }, 3000);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className={`border-2 transition-all duration-300 ${
        wsConnected 
          ? "border-success-200 bg-success-50/80 backdrop-blur-md" 
          : "border-danger-200 bg-danger-50/80 backdrop-blur-md animate-pulse"
      }`}>
        <CardBody className="p-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                wsConnected ? "bg-success-500" : "bg-danger-500"
              } ${!wsConnected ? "animate-pulse" : ""}`}></div>
              <Chip 
                color={wsConnected ? "success" : "danger"} 
                variant="flat" 
                size="sm"
                startContent={
                  <Icon 
                    icon={wsConnected ? "lucide:wifi" : "lucide:wifi-off"} 
                    className="h-3 w-3" 
                  />
                }
              >
                {wsConnected ? "Connected" : "Disconnected"}
              </Chip>
            </div>
            
            {!wsConnected && (
              <Tooltip
                content="Force reconnect to WebSocket server"
                placement="top"
                delay={500}
                closeDelay={100}
                showArrow
              >
                <Button
                  size="sm"
                  color="danger"
                  variant="flat"
                  isLoading={isReconnecting}
                  onPress={handleForceReconnect}
                  aria-label={isReconnecting ? "Reconnecting to WebSocket" : "Force reconnect to WebSocket server"}
                  startContent={
                    !isReconnecting ? (
                      <Icon icon="lucide:refresh-cw" className="h-3 w-3" />
                    ) : undefined
                  }
                  className="min-w-unit-8 px-2"
                >
                  {isReconnecting ? "" : "Reconnect"}
                </Button>
              </Tooltip>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export function Provider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <ProgressProvider>
      <HeroUIProvider navigate={navigate} useHref={useHref}>
        {children}
        <WebSocketStatus />
      </HeroUIProvider>
    </ProgressProvider>
  );
}
