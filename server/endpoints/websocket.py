from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
import asyncio
import json
import logging
from typing import Set
import time
import threading
import sys

router = APIRouter()
logger = logging.getLogger(__name__)

# Глобальный список подключённых клиентов с thread-safe защитой
active_connections: Set[WebSocket] = set()
connections_lock = threading.Lock()

# Глобальное хранилище текущего прогресса
current_progress = None
progress_lock = threading.Lock()

# Переменные для красивого вывода
last_team_name = None
last_player_count = 0
last_operation = None

def _format_progress_output(progress_data):
    """Форматирует красивый вывод прогресса создания команд и игроков"""
    global last_team_name, last_player_count, last_operation
    
    try:
        operation = progress_data.get("operation", "")
        function_name = progress_data.get("function_name", "")
        current_team = progress_data.get("current_team", "")
        message = progress_data.get("message", "")
        
        # Определяем тип операции
        if operation == "add_teams" or function_name == "add_teams":
            
            # Начало новой команды
            if current_team and current_team != last_team_name:
                if last_team_name:  # Если не первая команда, добавляем разделитель
                    print()
                print(f"🏆 Создание команды: {current_team}")
                print("=" * (len(current_team) + 20))
                last_team_name = current_team
                last_player_count = -1  # Reset to -1 to track first player
            
            # Обработка игроков
            players_progress = progress_data.get("players_processing_progress", {})
            if players_progress:
                current_player = progress_data.get("current_player", "")
                player_index = progress_data.get("player_index", None)
                total_players = progress_data.get("total_players", 0)
                
                # Только показываем основную информацию о игроке когда есть player_index и total_players
                if current_player and player_index is not None and total_players > 0:
                    # Проверяем, что это новый игрок или первый игрок
                    if player_index != last_player_count:
                        player_rating = progress_data.get("player_overall_rating", "")
                        player_position = progress_data.get("player_position", "")
                        
                        rating_str = f" (OVR: {player_rating})" if player_rating else ""
                        position_str = f" [{player_position}]" if player_position else ""
                        
                        print(f"  👤 {player_index + 1:2d}/{total_players} {current_player}{position_str}{rating_str}")
                        
                        last_player_count = player_index
                        
                # Показываем конкретные операции для игроков (только когда НЕТ player_index/total_players)
                elif message and current_player and player_index is None:
                    if "ML predictions" in message or "AI" in message:
                        print(f"    🤖 Анализ фото с помощью ИИ для {current_player}...")
                        # Детали ML предсказаний будут выведены самой ML функцией
                    elif "Downloading photo" in message:
                        print(f"    📥 Загрузка фото для {current_player}")
                    elif "name to playernames" in message:
                        # Не показываем это сообщение, так как оно уже выводится в players.py
                        pass
            
            # Сообщения об операциях без детального прогресса игроков
            elif message and not players_progress:
                if "Starting" in message or "начинается" in message.lower():
                    if current_team:
                        print(f"🔄 Обработка команды: {current_team}")
                elif "Successfully" in message or "успешно" in message.lower():
                    if "players" in message.lower() or "игроков" in message.lower():
                        print(f"✅ Игроки сохранены")
                elif "tactics" in message.lower() or "тактика" in message.lower():
                    print(f"🎯 Тактика и формации настроены")
                elif "completed" in message.lower() or "завершено" in message.lower():
                    print(f"✅ Команда {current_team} создана успешно")
                    print()
                elif "Successfully added" in message and "teams" in message:
                    # Финальная сводка
                    print("\n" + "=" * 60)
                    print("🎉 ВСЕ КОМАНДЫ СОЗДАНЫ УСПЕШНО!")
                    print("=" * 60)
                    total_teams = progress_data.get("total_added", 0)
                    if total_teams > 0:
                        print(f"📊 Всего обработано команд: {total_teams}")
                        print(f"✅ Процесс завершен успешно")
                    print("=" * 60)
        
        # Другие операции (не создание команд)
        elif operation and operation != last_operation:
            if operation not in ["add_teams"]:
                print(f"🔄 {operation}: {message}")
                last_operation = operation
    
    except Exception as e:
        # В случае ошибки форматирования, просто игнорируем
        logger.debug(f"Error formatting progress output: {e}")
        pass

async def broadcast_progress(progress_data):
    """Отправка данных прогресса всем подключенным клиентам"""
    global current_progress
    
    # Сохраняем текущий прогресс с блокировкой
    with progress_lock:
        if progress_data.get("type") == "progress":
            current_progress = progress_data
        elif progress_data.get("status") == "completed":
            current_progress = None
    
    # Получаем копию активных соединений с блокировкой
    with connections_lock:
        connections = active_connections.copy()
    
    if not connections:
        return
    
    to_remove = set()
    message = json.dumps(progress_data)
    
    # Отправляем сообщения параллельно с таймаутом
    send_tasks = []
    for ws in connections:
        send_tasks.append(send_with_timeout(ws, message, to_remove))
    
    await asyncio.gather(*send_tasks, return_exceptions=True)
    
    # Удаляем неактивные соединения
    if to_remove:
        with connections_lock:
            for ws in to_remove:
                active_connections.discard(ws)
                logger.info("Removed inactive WebSocket connection")

async def send_with_timeout(ws: WebSocket, message: str, to_remove: set, timeout: float = 5.0):
    """Отправка сообщения с таймаутом"""
    try:
        await asyncio.wait_for(ws.send_text(message), timeout=timeout)
        logger.debug(f"Sent message to client")
    except asyncio.TimeoutError:
        logger.warning(f"Timeout sending to WebSocket")
        to_remove.add(ws)
    except Exception as e:
        logger.error(f"Error sending to WebSocket: {e}")
        to_remove.add(ws)

@router.websocket("/ws/progress")
async def websocket_progress(websocket: WebSocket):
    await websocket.accept()
    
    with connections_lock:
        active_connections.add(websocket)
        connection_count = len(active_connections)
    
    logger.info(f"WebSocket connected. Total connections: {connection_count}")
    
    try:
        # Отправляем начальное сообщение для подтверждения соединения
        await websocket.send_text(json.dumps({"type": "connected", "message": "WebSocket connected"}))
        
        while True:
            # Ждем сообщения от клиента или просто поддерживаем соединение
            try:
                # Таймаут для ping/pong
                await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                # Отправляем ping для поддержания соединения
                await websocket.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected normally")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        with connections_lock:
            active_connections.discard(websocket)
            connection_count = len(active_connections)
        logger.info(f"WebSocket removed. Total connections: {connection_count}")

@router.websocket("/ws")
async def websocket_main(websocket: WebSocket):
    """Основной WebSocket endpoint с улучшенной обработкой ошибок"""
    try:
        await websocket.accept()
        
        # Добавляем соединение с блокировкой
        with connections_lock:
            active_connections.add(websocket)
            connection_count = len(active_connections)
        
        logger.info(f"WebSocket connected on /ws. Total connections: {connection_count}")
        
        # Отправляем начальное сообщение для подтверждения соединения
        await websocket.send_text(json.dumps({"type": "connected", "message": "WebSocket connected"}))
        
        # Отправляем текущий прогресс, если есть
        with progress_lock:
            if current_progress:
                await websocket.send_text(json.dumps(current_progress))
        
        last_ping = time.time()
        
        while True:
            try:
                # Ждем сообщения от клиента с таймаутом
                message = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                
                # Обработка ping от клиента
                try:
                    data = json.loads(message)
                    if data.get("type") == "ping":
                        await websocket.send_text(json.dumps({"type": "pong"}))
                        last_ping = time.time()
                except json.JSONDecodeError:
                    pass
                    
            except asyncio.TimeoutError:
                # Проверяем, не слишком ли давно был последний ping
                if time.time() - last_ping > 60:
                    logger.warning("No ping received for 60 seconds, closing connection")
                    break
                    
                # Отправляем ping для поддержания соединения
                try:
                    await asyncio.wait_for(
                        websocket.send_text(json.dumps({"type": "ping"})),
                        timeout=5.0
                    )
                except asyncio.TimeoutError:
                    logger.warning("Timeout sending ping, closing connection")
                    break
                except Exception:
                    break
                    
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected normally")
    except Exception as e:
        logger.error(f"WebSocket error: {type(e).__name__}: {e}")
    finally:
        # Удаляем соединение с блокировкой
        with connections_lock:
            active_connections.discard(websocket)
            connection_count = len(active_connections)
        
        logger.info(f"WebSocket removed from /ws. Total connections: {connection_count}")
        
        # Закрываем соединение, если оно еще открыто
        try:
            await websocket.close()
        except Exception:
            pass

# Функция для безопасной отправки прогресса из синхронного кода
def send_progress_sync(progress_data):
    """Синхронная функция для отправки прогресса с улучшенной обработкой ошибок"""
    try:
        # Добавляем timestamp если его нет
        if 'timestamp' not in progress_data:
            progress_data['timestamp'] = time.time()
        
        # Красивый вывод для создания команд и игроков
        _format_progress_output(progress_data)
        
        # Сохраняем текущий прогресс
        global current_progress
        with progress_lock:
            if progress_data.get("type") == "progress":
                current_progress = progress_data
            elif progress_data.get("status") == "completed":
                current_progress = None
        
        # Получаем копию активных соединений
        with connections_lock:
            connections = active_connections.copy()
        
        if not connections:
            return
        
        # Создаем новый event loop в отдельном потоке для отправки сообщений
        def send_messages():
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                async def send_to_all():
                    message = json.dumps(progress_data)
                    to_remove = set()
                    
                    for ws in connections:
                        try:
                            await asyncio.wait_for(ws.send_text(message), timeout=5.0)
                        except Exception as e:
                            logger.debug(f"Error sending to WebSocket: {e}")
                            to_remove.add(ws)
                    
                    # Удаляем неактивные соединения
                    if to_remove:
                        with connections_lock:
                            for ws in to_remove:
                                active_connections.discard(ws)
                
                loop.run_until_complete(send_to_all())
                loop.close()
                
            except Exception as e:
                logger.debug(f"Error in send_messages thread: {e}")
        
        # Запускаем в отдельном потоке
        thread = threading.Thread(target=send_messages, daemon=True)
        thread.start()
        
    except Exception as e:
        logger.error(f"Critical error in send_progress_sync: {type(e).__name__}: {e}")

@router.get("/progress/current")
async def get_current_progress():
    """Получить текущий прогресс с блокировкой"""
    with progress_lock:
        if current_progress:
            return current_progress
        else:
            return JSONResponse(
                status_code=404,
                content={"message": "Нет активного процесса"}
            )

@router.get("/ws/status")
async def websocket_status():
    """Получить статус WebSocket соединений"""
    with connections_lock:
        return {
            "active_connections": len(active_connections),
            "has_current_progress": current_progress is not None
        }