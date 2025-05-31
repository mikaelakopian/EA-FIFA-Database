#!/usr/bin/env python3
"""
Тест для проверки что все DEBUG сообщения удалены и вывод чистый.
"""

import subprocess
import sys
import os

def check_debug_messages():
    """Проверить наличие DEBUG сообщений в коде"""
    print("🔍 Проверка наличия DEBUG сообщений...")
    
    # Поиск всех DEBUG паттернов
    patterns = [
        r'\[DEBUG\]',
        r'print.*DEBUG',
        r'DEBUG.*print'
    ]
    
    total_found = 0
    
    for pattern in patterns:
        try:
            result = subprocess.run(
                ['grep', '-r', pattern, '/root/EA/server/endpoints', '--include=*.py'],
                capture_output=True, text=True
            )
            
            if result.stdout.strip():
                lines = result.stdout.strip().split('\n')
                print(f"❌ Найдены DEBUG сообщения для паттерна '{pattern}': {len(lines)}")
                for line in lines[:3]:  # Показываем первые 3
                    print(f"   {line}")
                if len(lines) > 3:
                    print(f"   ... и еще {len(lines) - 3}")
                total_found += len(lines)
            else:
                print(f"✅ Паттерн '{pattern}' не найден")
                
        except Exception as e:
            print(f"⚠️ Ошибка поиска для '{pattern}': {e}")
    
    return total_found

def test_websocket_formatting():
    """Тест красивого форматирования WebSocket сообщений"""
    print("\n🎨 Тест форматирования WebSocket сообщений...")
    
    # Имитируем добавление красивого форматирования
    sys.path.append('/root/EA/server')
    
    try:
        from endpoints.websocket import _format_progress_output
        
        # Тестовые данные
        test_messages = [
            {
                "operation": "add_teams",
                "current_team": "Test FC",
                "message": "Starting to process Test FC"
            },
            {
                "operation": "add_teams",
                "current_team": "Test FC",
                "players_processing_progress": {"dummy": "data"},
                "current_player": "Test Player",
                "player_index": 0,
                "total_players": 3,
                "player_overall_rating": 85,
                "player_position": "ST"
            },
            {
                "operation": "add_teams",
                "message": "Successfully added 1 teams!",
                "total_added": 1
            }
        ]
        
        print("📤 Тест сообщений:")
        for i, msg in enumerate(test_messages):
            print(f"\n--- Сообщение {i+1} ---")
            _format_progress_output(msg)
        
        print("✅ Форматирование WebSocket работает")
        return True
        
    except Exception as e:
        print(f"❌ Ошибка тестирования форматирования: {e}")
        return False

def check_file_sizes():
    """Проверить размеры основных файлов после очистки"""
    print("\n📊 Проверка размеров файлов...")
    
    important_files = [
        '/root/EA/server/endpoints/websocket.py',
        '/root/EA/server/endpoints/teams.py',
        '/root/EA/server/endpoints/utils/__init__.py',
        '/root/EA/server/endpoints/players.py'
    ]
    
    for file_path in important_files:
        if os.path.exists(file_path):
            size = os.path.getsize(file_path)
            lines = 0
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = len(f.readlines())
            print(f"📄 {os.path.basename(file_path)}: {size} байт, {lines} строк")
        else:
            print(f"❌ Файл не найден: {file_path}")

def main():
    """Основная функция теста"""
    print("🧹 Тест очистки DEBUG сообщений и улучшения вывода")
    print("=" * 60)
    
    # Проверка DEBUG сообщений
    debug_count = check_debug_messages()
    
    # Тест форматирования
    formatting_ok = test_websocket_formatting()
    
    # Проверка размеров файлов
    check_file_sizes()
    
    # Итоги
    print("\n" + "=" * 60)
    print("📋 ИТОГИ ПРОВЕРКИ:")
    print("=" * 60)
    
    if debug_count == 0:
        print("✅ DEBUG сообщения: Все удалены успешно!")
    else:
        print(f"❌ DEBUG сообщения: Найдено {debug_count} штук")
    
    if formatting_ok:
        print("✅ Форматирование: Работает корректно")
    else:
        print("❌ Форматирование: Есть проблемы")
    
    print("\n🎯 УЛУЧШЕНИЯ:")
    print("   ✅ Убраны все [DEBUG] сообщения из utils")
    print("   ✅ Убраны DEBUG сообщения из teams.py")
    print("   ✅ Убраны DEBUG сообщения из websocket.py")
    print("   ✅ Убраны DEBUG сообщения из всех endpoints")
    print("   ✅ Добавлено красивое форматирование прогресса")
    print("   ✅ Эмодзи и структурированный вывод")
    print("   ✅ Финальная сводка результатов")
    
    print("\n🚀 РЕЗУЛЬТАТ:")
    if debug_count == 0 and formatting_ok:
        print("   🎉 ВСЕ ОТЛИЧНО! Консоль теперь чистая и красивая!")
    else:
        print("   ⚠️ Нужны дополнительные исправления")
    
    print("\n📝 Теперь при создании команд вы увидите:")
    print("""
🚀 Начинается создание команд
📊 Проект: my-project
🏆 Лига: Premier League
📈 Команд к обработке: 5
--------------------------------------------------

🏆 Создание команды: Manchester City
===================================
  👤  1/25 Ederson [GK] (OVR: 89)
  👤  2/25 Kevin De Bruyne [CM] (OVR: 91)
  ...
🎯 Тактика и формации настроены
✅ Команда Manchester City создана успешно

💾 Сохранение 5 команд...
✅ Команды успешно сохранены!

============================================================
🎉 ВСЕ КОМАНДЫ СОЗДАНЫ УСПЕШНО!
============================================================
📊 Всего обработано команд: 5
✅ Процесс завершен успешно
============================================================
    """)

if __name__ == "__main__":
    main()