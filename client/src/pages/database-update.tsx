import DefaultLayout from "../layouts/default";
import {
  Button,
  ButtonGroup,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Spacer,
  Alert,
  Card,
  CardBody,
  Chip,
} from "@heroui/react";
import { CircularProgress } from "@heroui/react";
import { useState, useEffect } from "react";
import { useProgress } from "../context/ProgressContext";
import { Icon } from "@iconify/react";
import TransfermarktPositions from "../components/DatabaseUpdateComponents/TransfermarktPositions";

export function DatabaseUpdatePage() {
  const [alert, setAlert] = useState<null | { type: "success" | "error"; text: string }>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showPositionsDict, setShowPositionsDict] = useState(false);
  
  // Используем глобальный контекст прогресса
  const { progresses, wsConnected, getActiveProcesses } = useProgress();

  // Получаем активные процессы
  const activeProcesses = getActiveProcesses();
  // Получаем все процессы включая завершенные
  const allProcesses = progresses.filter(p => p.status && p.function_name);

  useEffect(() => {
    // Устанавливаем интервал обновления времени
    const updateInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(updateInterval);
    };
  }, []);

  // Асинхронный запрос на FastAPI endpoint
  const triggerSofifaScrape = async () => {
    try {
      const response = await fetch("http://localhost:8000/teams/sofifa/scrape_transfermarkt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (response.ok) {
        const data = await response.json();
        setAlert({
          type: "success",
          text: data?.message || "Поиск ссылок команд FC25 запущен! Это может занять несколько минут.",
        });
      } else {
        setAlert({
          type: "error",
          text: `Ошибка: не удалось запустить поиск. (${response.status})`,
        });
      }
    } catch (error) {
      setAlert({
        type: "error",
        text: `Ошибка сети: ${error}`,
      });
    }
  };

  // Асинхронный запрос для игроков
  const triggerPlayerSofifaScrape = async () => {
    try {
      const response = await fetch("http://localhost:8000/players/sofifa/scrape_transfermarkt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (response.ok) {
        const data = await response.json();
        setAlert({
          type: "success",
          text: data?.message || "Поиск ссылок игроков FC25 запущен! Это может занять несколько минут.",
        });
      } else {
        setAlert({
          type: "error",
          text: `Ошибка: не удалось запустить поиск игроков. (${response.status})`,
        });
      }
    } catch (error) {
      setAlert({
        type: "error",
        text: `Ошибка сети: ${error}`,
      });
    }
  };

  // Асинхронный запрос для скрапинга составов Transfermarkt
  const triggerTransfermarktSquadsScrape = async () => {
    try {
      const response = await fetch("http://localhost:8000/transfermarkt/scrape_squads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (response.ok) {
        const data = await response.json();
        setAlert({
          type: "success",
          text: data?.message || "Загрузка составов команд с Transfermarkt запущена! Это может занять значительное время.",
        });
      } else {
        setAlert({
          type: "error",
          text: `Ошибка: не удалось запустить загрузку составов. (${response.status})`,
        });
      }
    } catch (error) {
      setAlert({
        type: "error",
        text: `Ошибка сети: ${error}`,
      });
    }
  };

  // Асинхронный запрос для парсинга лиг Transfermarkt
  const triggerTransfermarktLeaguesScrape = async () => {
    try {
      const response = await fetch("http://localhost:8000/transfermarkt/scrape_leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (response.ok) {
        const data = await response.json();
        setAlert({
          type: "success",
          text: data?.message || "Загрузка лиг с Transfermarkt запущена! Это может занять значительное время.",
        });
      } else {
        setAlert({
          type: "error",
          text: `Ошибка: не удалось запустить загрузку лиг. (${response.status})`,
        });
      }
    } catch (error) {
      setAlert({
        type: "error",
        text: `Ошибка сети: ${error}`,
      });
    }
  };

  // Функция отмены процесса с мгновенной обратной связью
  const cancelProcess = async (functionName: string) => {
    // Сразу показываем что отмена в процессе
    setAlert({
      type: "success", 
      text: "Отправка запроса на отмену процесса...",
    });

    try {
      // Определяем какой endpoint использовать в зависимости от типа процесса
      let cancelUrl = "";
      if (functionName.includes("transfermarkt") || functionName === "process_transfermarkt_squads") {
        cancelUrl = `http://localhost:8000/transfermarkt/cancel_process?function_name=${encodeURIComponent(functionName)}`;
      } else {
        cancelUrl = `http://localhost:8000/cancel_process?function_name=${encodeURIComponent(functionName)}`;
      }
      
      const response = await fetch(cancelUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (response.ok) {
        const data = await response.json();
        setAlert({
          type: "success",
          text: data?.message || "Запрос на отмену отправлен успешно. Процесс будет остановлен в ближайшее время.",
        });
      } else {
        setAlert({
          type: "error",
          text: `Ошибка при отмене процесса: ${response.status}`,
        });
      }
    } catch (error) {
      setAlert({
        type: "error",
        text: `Ошибка сети при отмене: ${error}`,
      });
    }
  };

  // Обработчик для Transfermarkt
  const handleTransfermarktAction = (key: string) => {
    switch (key) {
      case "tm_find_fc25_team_links":
        triggerSofifaScrape();
        break;
      case "tm_find_fc25_player_links":
        triggerPlayerSofifaScrape();
        break;
      case "tm_scrape_squads":
        triggerTransfermarktSquadsScrape();
        break;
      case "tm_scrape_leagues":
        triggerTransfermarktLeaguesScrape();
        break;
      case "tm_load_teams":
        setAlert({
          type: "success",
          text: "Загрузка команд из Transfermarkt (демо)",
        });
        break;
      case "tm_load_players":
        setAlert({
          type: "success",
          text: "Загрузка игроков из Transfermarkt (демо)",
        });
        break;
      default:
        console.log(`Неизвестное действие Transfermarkt: ${key}`);
    }
  };

  return (
    <DefaultLayout>
      <div className="w-full p-4">
        {/* Индикатор подключения WebSocket */}
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-default-600">
            WebSocket: {wsConnected ? 'Подключен' : 'Отключен'}
          </span>
          {activeProcesses.length > 0 && (
            <span className="text-sm text-primary-600 font-medium">
              Активных процессов: {activeProcesses.length}
            </span>
          )}
        </div>

        <ButtonGroup variant="solid" color="primary" className="mb-6">
          {/* Transfermarkt Dropdown */}
          <Dropdown>
            <DropdownTrigger>
              <Button>Transfermarkt</Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Действия Transfermarkt"
              onAction={(key) => handleTransfermarktAction(key as string)}
            >
              <DropdownItem key="tm_find_fc25_team_links" className="font-bold text-primary">
                Поиск ссылок команд FC25
              </DropdownItem>
              <DropdownItem key="tm_find_fc25_player_links" className="font-bold text-success">
                Поиск ссылок игроков FC25
              </DropdownItem>
              <DropdownItem key="tm_scrape_squads" className="font-bold text-warning">
                Загрузить составы команд
              </DropdownItem>
              <DropdownItem key="tm_scrape_leagues">
                Загрузить лиги
              </DropdownItem>
              <DropdownItem key="tm_load_teams">
                Загрузить команды
              </DropdownItem>
              <DropdownItem key="tm_load_players">
                Загрузить игроков
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
          <Dropdown>
          <DropdownTrigger>
              <Button>Базы Данных</Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Действия с Базами Данных"
              onAction={(key) => {
                if (key === "db_teams") setShowPositionsDict(true);
              }}
            >
              <DropdownItem key="db_teams">
                Словарь позиций игроков
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
          {/* ... другие Dropdown ... */}
        </ButtonGroup>

        {/* Прогресс из глобального контекста */}
        {allProcesses.length > 0 ? (
          <div className="space-y-4 mb-4">
            {allProcesses.map((progress, index) => (
              <div key={`${progress.function_name}-${index}`} className="max-w-md">
                <Card className="border border-default-200">
                  <CardBody className="p-3">
                    {/* Основная информация */}
                    <div className="flex items-center gap-3 mb-3">
                      <CircularProgress
                        value={progress.percentage || 0}
                        size="sm"
                        color={
                          progress.status === "completed" ? "success" : 
                          progress.status === "cancelled" ? "warning" :
                          progress.status === "error" ? "danger" : "primary"
                        }
                        showValueLabel={true}
                        aria-label={`Progress for ${progress.teamname || progress.playername || 'process'} at ${Math.round(progress.percentage || 0)}%`}
                        valueLabel={`${Math.round(progress.percentage || 0)}%`}
                        classNames={{
                          svg: "w-12 h-12",
                          value: "text-xs font-medium"
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-default-800 truncate">
                          {progress.teamname || progress.playername || "Обработка..."}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Chip 
                            size="sm" 
                            color={
                              progress.status === "completed" ? "success" : 
                              progress.status === "cancelled" ? "warning" :
                              progress.status === "error" ? "danger" : "primary"
                            }
                            variant="flat"
                            className="text-xs h-5"
                          >
                            {progress.status === "cancelled" ? "отменен" : progress.status}
                          </Chip>
                          {progress.found_link !== undefined && (
                            <span className={`text-xs ${progress.found_link ? 'text-success-600' : 'text-warning-600'}`}>
                              {progress.found_link ? '✓ Найдено' : '⚠ Не найдено'}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Кнопка отмены - только для активных процессов */}
                      {(progress.status === "processing" || progress.status === "starting") && progress.function_name && (
                        <Button
                          isIconOnly
                          size="sm"
                          color="danger"
                          variant="flat"
                          aria-label="Отменить процесс"
                          onPress={() => cancelProcess(progress.function_name!)}
                          className="min-w-unit-8 w-8 h-8"
                        >
                          <Icon icon="lucide:x" className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {/* Название функции */}
                    {progress.function_name && (
                      <div className={`mb-3 rounded-lg p-2 border ${
                        progress.status === "completed" 
                          ? "bg-success-50 border-success-200" 
                          : "bg-primary-50 border-primary-200"
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${
                            progress.status === "completed" ? "text-success-800" : "text-primary-800"
                          }`}>
                            {progress.function_name}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Статистика в две строки */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-default-600">
                        <span>
                          {progress.function_name === "process_players_and_save_links" ? "Игроков" : 
                           progress.function_name === "process_transfermarkt_squads" ? "Команд" : 
                           progress.function_name === "process_transfermarkt_leagues" ? "Лиг" : "Команд"}: {progress.current || 0}/{progress.total || 0}
                        </span>
                        {progress.function_name === "process_transfermarkt_squads" ? (
                          <span>Успешно: {progress.successful_teams || 0} ({progress.success_percentage?.toFixed(1) || 0}%)</span>
                        ) : progress.function_name === "process_transfermarkt_leagues" ? (
                          <span>Конфедерация: {progress.confederation || "—"}</span>
                        ) : (
                          <span>Найдено: {progress.found_links || 0} ({progress.found_percentage?.toFixed(1) || 0}%)</span>
                        )}
                      </div>
                      <div className="flex justify-between text-xs text-default-600">
                        <span>Время: {progress.elapsed_time || "0 сек"}</span>
                        {progress.estimated_time_remaining && progress.status !== "completed" && (
                          <span>Осталось: {progress.estimated_time_remaining}</span>
                        )}
                      </div>
                      {progress.function_name === "process_transfermarkt_squads" && progress.players_found !== undefined && (
                        <div className="flex justify-between text-xs text-default-600">
                          <span>Игроков найдено: {progress.players_found}</span>
                          {progress.has_error && (
                            <span className="text-warning-600">⚠ Есть ошибки</span>
                          )}
                        </div>
                      )}
                      {progress.function_name === "process_transfermarkt_leagues" && progress.page && (
                        <div className="flex justify-between text-xs text-default-600">
                          <span>Страница: {progress.page}</span>
                          <span>Лиг на странице: {progress.page_leagues || 0}</span>
                        </div>
                      )}
                    </div>

                    {/* Тонкий прогресс-бар */}
                    <div className="mt-3">
                      <div className="w-full bg-default-200 rounded-full h-1.5">
                        <div 
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            progress.status === "completed" ? "bg-success" : "bg-primary"
                          }`}
                          style={{ width: `${progress.percentage || 0}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Сообщение о завершении */}
                    {progress.status === "completed" && (
                      <div className="mt-3 text-xs text-success-600 flex items-center gap-1">
                        <span>🎉</span>
                        <span>Завершено за {progress.total_elapsed_time}</span>
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>
            ))}
          </div>
        ) : null}

        {/* Показываем Alert, если есть */}
        {alert && (
          <Alert
            color={alert.type === "success" ? "success" : "danger"}
            className="mb-4"
            isVisible
            isClosable
            onClose={() => setAlert(null)}
          >
            {alert.text}
          </Alert>
        )}

        <Spacer y={4} />
        {showPositionsDict ? (
          <TransfermarktPositions onClose={() => setShowPositionsDict(false)} />
        ) : (
          <p>Основное содержимое страницы обновления базы данных...</p>
        )}
      </div>
    </DefaultLayout>
  );
}

export default DatabaseUpdatePage;