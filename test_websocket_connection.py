#!/usr/bin/env python3
"""
Простой тест WebSocket соединения для проверки ping/pong механизма
"""

import asyncio
import websockets
import json
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_websocket_connection():
    """Тестирует WebSocket соединение с сервером"""
    uri = "ws://localhost:8000/ws"
    
    try:
        logger.info("Подключение к WebSocket серверу...")
        async with websockets.connect(uri, ping_interval=None) as websocket:
            logger.info("✅ Подключение установлено")
            
            # Отправляем начальный ping
            await websocket.send(json.dumps({"type": "ping"}))
            logger.info("📤 Отправлен начальный ping")
            
            start_time = time.time()
            ping_count = 0
            pong_count = 0
            
            # Слушаем сообщения в течение 2 минут
            while time.time() - start_time < 120:  # 2 минуты
                try:
                    # Ждем сообщения с коротким таймаутом
                    message = await asyncio.wait_for(websocket.recv(), timeout=30.0)
                    data = json.loads(message)
                    
                    if data.get("type") == "ping":
                        logger.info("📥 Получен ping от сервера, отправляем pong")
                        await websocket.send(json.dumps({"type": "pong"}))
                        ping_count += 1
                        
                    elif data.get("type") == "pong":
                        logger.info("📥 Получен pong от сервера")
                        pong_count += 1
                        
                    elif data.get("type") == "connected":
                        logger.info("📥 Получено сообщение о подключении")
                        
                    else:
                        logger.info(f"📥 Получено сообщение: {data.get('type', 'unknown')}")
                        
                except asyncio.TimeoutError:
                    # Отправляем ping каждые 30 секунд при таймауте
                    current_time = time.time()
                    logger.info(f"⏰ Таймаут ожидания, отправляем ping (время: {current_time - start_time:.1f}с)")
                    await websocket.send(json.dumps({"type": "ping"}))
                    
                except json.JSONDecodeError as e:
                    logger.error(f"❌ Ошибка парсинга JSON: {e}")
                    
            logger.info(f"📊 Статистика за 2 минуты:")
            logger.info(f"   - Получено ping от сервера: {ping_count}")
            logger.info(f"   - Получено pong от сервера: {pong_count}")
            logger.info(f"   - Соединение оставалось активным: {time.time() - start_time:.1f} секунд")
            
    except websockets.exceptions.ConnectionClosed as e:
        logger.error(f"❌ Соединение закрыто: {e}")
    except Exception as e:
        logger.error(f"❌ Ошибка: {e}")

if __name__ == "__main__":
    print("🧪 Тестирование WebSocket соединения...")
    print("Убедитесь, что сервер запущен на http://localhost:8000")
    print("Тест будет выполняться 2 минуты...")
    print()
    
    asyncio.run(test_websocket_connection())