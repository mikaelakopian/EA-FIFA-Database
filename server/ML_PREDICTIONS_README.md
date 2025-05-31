# ML Player Parameter Predictions

Система машинного обучения для предсказания параметров игроков по их фотографиям в EA FC Studio.

## Обзор

Новая система позволяет автоматически определять внешние характеристики игроков (цвет волос, тип лица, телосложение и т.д.) на основе их фотографий с помощью нейронных сетей.

## Структура файлов

```
/root/EA/server/
├── endpoints/
│   └── PlayerParametersPredictionsModel.py    # Основной модуль ML предсказаний
├── models/                                     # Директория с обученными моделями
│   └── model_haircolorcode_best.pth           # Пример модели для цвета волос
└── test_ml_predictions.py                     # Тестовый скрипт
```

## Формат моделей

Модели должны быть сохранены в формате PyTorch (.pth) и следовать именованию:

```
model_[parameter_name]_[suffix].pth
```

Примеры:
- `model_haircolorcode_best.pth` - предсказывает параметр `haircolorcode`
- `model_skintonecode_v2.pth` - предсказывает параметр `skintonecode`
- `model_eyecolorcode_final.pth` - предсказывает параметр `eyecolorcode`

## Поддерживаемые параметры

Система автоматически определяет диапазоны значений для следующих параметров:

| Параметр | Диапазон | Описание |
|----------|----------|----------|
| `haircolorcode` | 1-10 | Цвет волос |
| `facialhairtypecode` | 0-300 | Тип растительности на лице |
| `hairtypecode` | 1-1100 | Тип прически |
| `headtypecode` | 1-30 | Тип головы |
| `skintonecode` | 1-10 | Тон кожи |
| `eyecolorcode` | 1-5 | Цвет глаз |
| `eyebrowcode` | 60000-70000 | Тип бровей |
| `bodytypecode` | 1-8 | Тип телосложения |
| `headclasscode` | 0-2 | Класс головы |

## Интеграция с созданием игроков

Система автоматически интегрирована в процесс создания игроков:

1. **Загрузка фото**: Когда система скачивает фото игрока с Transfermarkt
2. **ML анализ**: Применяются все доступные модели для предсказания параметров
3. **Обновление данных**: Предсказанные значения заменяют случайно сгенерированные
4. **Прогресс**: Пользователь видит "Analyzing photo for [Player Name] with AI..."

## API Endpoints

### GET `/player-parameters/available-models`
Получить список доступных моделей

**Ответ:**
```json
{
  "available_parameters": ["haircolorcode", "skintonecode"],
  "total_models": 2
}
```

### POST `/player-parameters/predict`
Предсказать параметры игрока по фото

**Параметры:**
- `image_path` (str): Путь к изображению
- `parameters` (List[str], optional): Список конкретных параметров для предсказания

**Ответ:**
```json
{
  "image_path": "/path/to/image.jpg",
  "predictions": {
    "haircolorcode": "3",
    "skintonecode": "7"
  },
  "total_predictions": 2
}
```

## Использование в коде

### Базовое предсказание
```python
from endpoints.PlayerParametersPredictionsModel import predict_player_parameters_from_photo

# Предсказать все доступные параметры
predictions = await predict_player_parameters_from_photo("/path/to/image.jpg")

# Предсказать конкретные параметры
predictions = await predict_player_parameters_from_photo(
    "/path/to/image.jpg", 
    ["haircolorcode", "skintonecode"]
)
```

### Улучшение данных игрока
```python
from endpoints.PlayerParametersPredictionsModel import enhance_player_data_with_predictions

player_data = {
    "playerid": "300000",
    "haircolorcode": "0",  # Будет заменено на предсказанное значение
    "name": "Player Name"
}

enhanced_data = await enhance_player_data_with_predictions(
    player_data, 
    "/path/to/player/photo.jpg"
)
```

## Архитектура модели

Базовая архитектура для всех моделей:

```python
class PlayerParameterModel(nn.Module):
    def __init__(self, num_classes: int = 10):
        super().__init__()
        self.features = nn.Sequential(
            # CNN layers for feature extraction
            nn.Conv2d(3, 64, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),
            # ... более слоев
        )
        self.classifier = nn.Sequential(
            # Classification layers
            nn.Linear(512 * 7 * 7, 4096),
            nn.ReLU(inplace=True),
            nn.Linear(4096, num_classes)
        )
```

## Добавление новых моделей

1. **Обучите модель** используя архитектуру `PlayerParameterModel`
2. **Сохраните модель** в формат PyTorch:
   ```python
   torch.save(model.state_dict(), 'model_parametername_version.pth')
   ```
3. **Поместите файл** в `/root/EA/server/models/`
4. **Добавьте диапазон** в `parameter_ranges` если нужно:
   ```python
   "new_parameter": {"min": 1, "max": 50, "type": "int"}
   ```
5. **Перезапустите сервер** - модель загрузится автоматически

## Тестирование

Запустите тестовый скрипт для проверки системы:

```bash
cd /root/EA/server
python test_ml_predictions.py
```

Скрипт проверит:
- ✅ Доступность зависимостей (PyTorch, PIL)
- 📁 Наличие моделей в директории
- 🤖 Инициализацию предсказателя
- 🔧 Работу API функций

## Логирование

Система использует подробное логирование:

```
INFO: Loaded model for parameter: haircolorcode
INFO: Predicted haircolorcode: 3
INFO: Enhanced player data: haircolorcode = 3
```

В консоли создания игроков:
```
🤖 Applied ML predictions for Player Name
⚠️ ML prediction failed for Player Name: [error details]
```

## Требования

### Python пакеты
```
torch>=1.9.0
torchvision>=0.10.0
Pillow>=8.0.0
fastapi>=0.70.0
```

### Системные требования
- **CPU**: Любой современный процессор
- **GPU**: Опционально (CUDA для ускорения)
- **RAM**: Минимум 2GB для загрузки моделей
- **Место**: ~50MB на модель

## Troubleshooting

### Ошибка "No model available for parameter"
- Проверьте наличие .pth файла в `/root/EA/server/models/`
- Убедитесь что имя файла соответствует формату `model_parametername_*.pth`

### Ошибка "CUDA out of memory"
- Система автоматически переключится на CPU
- Уменьшите размер модели или добавьте RAM

### Ошибка "Error loading model"
- Проверьте совместимость версии PyTorch
- Убедитесь что модель была сохранена правильно

### Медленные предсказания
- Убедитесь что используется GPU если доступен
- Рассмотрите оптимизацию моделей (quantization, pruning)

## Планы развития

- 🔄 Автоматическое дообучение моделей на новых данных
- 📊 Метрики качества предсказаний
- 🎯 Специализированные модели для вратарей/полевых игроков
- 🌐 Веб-интерфейс для управления моделями
- 📱 Поддержка различных форматов изображений
- ⚡ Оптимизация скорости предсказаний