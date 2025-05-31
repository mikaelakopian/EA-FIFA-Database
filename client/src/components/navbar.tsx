import React from "react";
import {
  Button,
  Chip,
  Input,
  Kbd,
  Navbar as HeroUINavbar,
  NavbarContent,
  Badge,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useProgress } from "../context/ProgressContext";
import { BackgroundTasks } from "./BackgroundTasks";

export const Navbar = () => {
  const [serverStatus, setServerStatus] = React.useState<"online" | "offline" | "checking...">("checking...");
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
  const { progresses, wsConnected, getActiveProcesses, getTotalActiveCount, clearAllProgress } = useProgress();
  
  // Получаем активные процессы
  const activeProcesses = getActiveProcesses();
  const totalActiveCount = getTotalActiveCount();
  
  // Получаем все процессы (включая завершенные для отображения в popover)
  const allProcesses = progresses.filter(p => p.status && p.function_name);

  React.useEffect(() => {
    // Simulate server status check
    const checkStatus = setTimeout(() => {
      setServerStatus("online");
    }, 1500);

    return () => {
      clearTimeout(checkStatus);
    };
  }, []);

  const searchInput = (
    <Input
      aria-label="Search"
      classNames={{
        inputWrapper: "bg-content2 border-none",
        input: "text-sm",
      }}
      endContent={
        <Kbd className="hidden lg:inline-block" keys={["command"]}>
          K
        </Kbd>
      }
      labelPlacement="outside"
      placeholder="Search..."
      startContent={
        <Icon icon="lucide:search" className="text-default-400 text-sm" />
      }
      type="search"
      className="max-w-xs"
    />
  );

  // Определяем, есть ли активные задачи
  const hasActiveTask = totalActiveCount > 0;
  const badgeContent = hasActiveTask ? totalActiveCount.toString() : "";

  return (
    <HeroUINavbar
      classNames={{
        wrapper: "bg-[#1e1e1e] !px-0 max-w-full", 
        content: "gap-3",
      }}
      maxWidth="full"
    >
      <NavbarContent className="sm:basis-auto flex-grow" justify="start">
        <div className="flex items-center gap-2 w-full">
          {searchInput}
          
          <Popover 
            placement="bottom-end" 
            isOpen={isPopoverOpen} 
            onOpenChange={setIsPopoverOpen}
            triggerType="grid"
          >
            <PopoverTrigger>
              <div>
                <Badge 
                  content={badgeContent} 
                  color="danger" 
                  size="sm"
                  isInvisible={!hasActiveTask}
                  className={hasActiveTask ? "animate-pulse" : ""}
                >
                  <Button 
                    isIconOnly 
                    size="sm" 
                    variant="light" 
                    aria-label="Notifications"
                    className="text-default-500 transition-opacity hover:opacity-80"
                    onPress={() => setIsPopoverOpen(!isPopoverOpen)}
                  >
                    <Icon icon="lucide:bell" className="text-lg" />
                  </Button>
                </Badge>
              </div>
            </PopoverTrigger>
            <PopoverContent className="p-0 max-w-md">
              <BackgroundTasks
                processes={allProcesses}
                wsConnected={wsConnected}
              />
            </PopoverContent>
          </Popover>
          
          <Button 
            isIconOnly 
            size="sm" 
            variant="light"
            aria-label="Settings"
            className="text-default-500 transition-opacity hover:opacity-80"
          >
            <Icon icon="lucide:settings" className="text-lg" />
          </Button>
        </div>
      </NavbarContent>

      <NavbarContent className="basis-auto" justify="end">
        <div className="flex items-center gap-2">
          {/* Статус WebSocket */}
          {wsConnected && (
            <Chip color="success" variant="dot" size="sm" className="h-7">
              WebSocket Online
            </Chip>
          )}
          {!wsConnected && (
            <Chip color="warning" variant="dot" size="sm" className="h-7">
              WebSocket Offline
            </Chip>
          )}
          
          {/* Статус сервера */}
          {serverStatus === "online" && (
            <Chip color="success" variant="dot" size="sm" className="h-7">
              Server Online
            </Chip>
          )}
          {serverStatus === "offline" && (
            <Chip color="danger" variant="dot" size="sm" className="h-7">
              Server Offline
            </Chip>
          )}
          {serverStatus === "checking..." && (
            <Chip color="default" variant="dot" size="sm" className="h-7">
              Checking Status...
            </Chip>
          )}
        </div>

        <div className="flex">
          <Button
            size="sm"
            color="primary" 
            variant="flat"
            startContent={<Icon icon="lucide:heart" className="text-danger" />}
            className="font-medium text-sm"
          >
            Sponsor
          </Button>
        </div>
      </NavbarContent>
    </HeroUINavbar>
  );
};