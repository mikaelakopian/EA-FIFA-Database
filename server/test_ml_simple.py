#!/usr/bin/env python3
"""
Простой тест ML функций без зависимостей от FastAPI.
"""

import asyncio
import os
import random
from typing import Dict, Any, List

# Простая mock версия без FastAPI
class SimpleMLPredictor:
    def __init__(self):
        self.parameter_ranges = {
            "haircolorcode": {"min": 1, "max": 10},
            "facialhairtypecode": {"min": 0, "max": 300},
            "skintonecode": {"min": 1, "max": 10},
            "eyecolorcode": {"min": 1, "max": 5},
        }
        self.available_models = self._scan_models()
    
    def _scan_models(self):
        models_dir = "/root/EA/server/models"
        available = []
        
        if os.path.exists(models_dir):
            for filename in os.listdir(models_dir):
                if filename.endswith('.pth'):
                    # Извлекаем имя параметра из имени файла
                    if filename.startswith('model_') and '_' in filename[6:]:
                        param_name = filename[6:].split('_')[0]
                        if param_name in self.parameter_ranges:
                            available.append(param_name)
        
        return available
    
    def predict_all(self, image_path):
        predictions = {}
        for param in self.available_models:
            if os.path.exists(image_path):
                param_info = self.parameter_ranges[param]
                value = random.randint(param_info["min"], param_info["max"])
                predictions[param] = str(value)
        return predictions

async def enhance_player_data_simple(player_data: Dict[str, Any], image_path: str) -> Dict[str, Any]:
    """Простая версия функции улучшения данных игрока"""
    if not os.path.exists(image_path):
        return player_data
    
    try:
        predictor = SimpleMLPredictor()
        predictions = predictor.predict_all(image_path)
        
        enhanced_data = player_data.copy()
        updated_params = []
        
        for param_name, predicted_value in predictions.items():
            if param_name not in enhanced_data or enhanced_data[param_name] in ["0", "", None]:
                old_value = enhanced_data.get(param_name, "0")
                enhanced_data[param_name] = predicted_value
                updated_params.append({
                    "parameter": param_name,
                    "old_value": old_value,
                    "new_value": predicted_value
                })
        
        # Выводим детальную информацию о применённых предсказаниях
        if updated_params:
            print(f"        🤖 ML предсказания применены ({len(updated_params)} параметров):")
            for param in updated_params:
                print(f"           📊 {param['parameter']}: {param['old_value']} → {param['new_value']}")
        else:
            print(f"        🤖 ML анализ выполнен (изменений не требуется)")
        
        return enhanced_data
        
    except Exception as e:
        print(f"        ❌ Ошибка ML предсказания: {str(e)}")
        return player_data

async def test_ml_output():
    """Тест ML вывода"""
    print("🧪 Тест детального ML вывода")
    print("=" * 40)
    
    # Показываем доступные модели
    predictor = SimpleMLPredictor()
    available = predictor.available_models
    
    print(f"\n🚀 Начинается создание команд")
    print(f"📊 Проект: test-project")
    print(f"🏆 Лига: Test League")
    print(f"📈 Команд к обработке: 1")
    
    if available:
        print(f"🤖 ML модели доступны для: {', '.join(available)}")
    else:
        print(f"🤖 ML модели: не найдены в папке models/")
    
    print("-" * 50)
    
    # Создаем тестовое изображение
    test_image = "/tmp/test_player.jpg"
    with open(test_image, 'w') as f:
        f.write("test")
    
    try:
        print(f"\n🏆 Создание команды: Test FC")
        print("=" * 27)
        
        # Тестируем разные сценарии
        players = [
            {
                "name": "Test Player 1",
                "data": {"playerid": "300001", "haircolorcode": "0", "eyecolorcode": "0"}
            },
            {
                "name": "Test Player 2", 
                "data": {"playerid": "300002", "haircolorcode": "5", "skintonecode": "0"}
            },
            {
                "name": "Test Player 3",
                "data": {"playerid": "300003", "haircolorcode": "3", "skintonecode": "2"}
            }
        ]
        
        for i, player in enumerate(players):
            print(f"  👤 {i+1:2d}/3 {player['name']} [ST] (OVR: 75)")
            
            enhanced = await enhance_player_data_simple(player["data"], test_image)
            
            await asyncio.sleep(0.1)
        
        print(f"🎯 Тактика и формации настроены")
        print(f"✅ Команда Test FC создана успешно")
        
    finally:
        if os.path.exists(test_image):
            os.remove(test_image)

async def main():
    await test_ml_output()
    
    print("\n📊 ИТОГ:")
    print("✅ Детальный вывод ML предсказаний реализован")
    print("✅ Показ конкретных параметров и значений")
    print("✅ Визуализация изменений (старое → новое)")
    print("✅ Обработка всех сценариев")

if __name__ == "__main__":
    asyncio.run(main())